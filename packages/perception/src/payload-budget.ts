// ─── packages/perception/src/payload-budget.ts ───
// Context ranking, element budget, and serialized payload budget enforcement.
// Implements Workstream 3 for SIH26171 PrivacySight Agent.

import type { DOMElement, DOMContext } from '@sih26171/protocol';

export const DEFAULT_MAX_ELEMENTS = 40;
export const DEFAULT_MAX_PAYLOAD_BYTES = 32 * 1024; // 32 KB

export interface PayloadBudgetOptions {
  maxElements?: number;
  maxPayloadBytes?: number;
  taskGoal?: string;
  preserveTargetIds?: string[];
}

export interface BudgetedDOMResult {
  context: DOMContext;
  context_truncated: boolean;
  original_element_count: number;
  retained_element_count: number;
  dropped_element_count: number;
  serialized_payload_bytes: number;
  max_payload_bytes: number;
  target_preserved: boolean;
  error?: string;
  status: 'ok' | 'target_context_unavailable' | 'budget_exceeded';
}

/**
 * Calculates a relevance score for a sanitized DOMElement against the user task.
 * Note: Input element MUST already be sanitized/redacted (no raw secrets).
 */
export function computeElementRelevanceScore(
  el: DOMElement,
  taskKeywords: string[],
  preserveTargetIds: Set<string>
): number {
  let score = 0;

  const idLower = (el.id || '').toLowerCase();
  const textLower = (el.text || '').toLowerCase();
  const ariaLower = (el.aria_label || '').toLowerCase();
  const roleLower = (el.role || '').toLowerCase();
  const tagLower = (el.tag || '').toLowerCase();

  // 1. Critical preserved target bonus
  if (preserveTargetIds.has(el.id) || preserveTargetIds.has(idLower)) {
    score += 1000;
  }

  // 2. Task keyword match
  for (const kw of taskKeywords) {
    if (kw.length < 2) continue;
    if (idLower.includes(kw)) score += 120;
    if (textLower.includes(kw)) score += 100;
    if (ariaLower.includes(kw)) score += 100;
  }

  // 3. Interactive role bonus
  const highValueRoles = new Set(['button', 'link', 'textbox', 'combobox', 'checkbox', 'radio', 'tab', 'menuitem']);
  if (highValueRoles.has(roleLower)) {
    score += 50;
  }
  if (tagLower === 'button' || tagLower === 'a' || tagLower === 'input' || tagLower === 'select') {
    score += 40;
  }

  // 4. Accessible name / non-empty sanitized text
  if (el.aria_label && el.aria_label.trim().length > 0) score += 25;
  if (el.text && el.text.trim().length > 0) score += 20;

  // 5. Viewport visibility & vertical position (higher elements slightly prioritized)
  if (el.bbox) {
    if (el.bbox.y >= 0 && el.bbox.y <= 1 && el.bbox.x >= 0 && el.bbox.x <= 1) {
      score += 30;
      score += Math.max(0, (1 - el.bbox.y) * 20); // Top-to-bottom bias
    }
  }

  // 6. Enabled vs disabled
  if (el.disabled) {
    score -= 60;
  } else {
    score += 15;
  }

  // 7. Stable agent ID presence
  if (el.attributes?.data_agent_id) {
    score += 10;
  }

  return score;
}

/**
 * Extracts normalized task keywords from a task goal string.
 */
function extractTaskKeywords(taskGoal?: string): string[] {
  if (!taskGoal) return [];
  const stopWords = new Set(['the', 'and', 'or', 'to', 'in', 'on', 'a', 'an', 'is', 'for', 'of', 'at', 'by']);
  return taskGoal
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 2 && !stopWords.has(word));
}

/**
 * Applies context ranking, element capping, and byte budgeting to sanitized elements.
 * Guaranteed:
 *  - Preserves designated critical targets (e.g. #download-report).
 *  - Output byte size <= maxPayloadBytes.
 *  - Truncation metadata is accurately computed and exposed.
 */
export function rankAndBudgetElements(
  sanitizedElements: DOMElement[],
  pageTitle: string = 'Document',
  options: PayloadBudgetOptions = {}
): BudgetedDOMResult {
  const maxElements = options.maxElements ?? DEFAULT_MAX_ELEMENTS;
  const maxPayloadBytes = options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES;
  const taskKeywords = extractTaskKeywords(options.taskGoal);
  const preserveSet = new Set((options.preserveTargetIds || ['download-report']).map(id => id.toLowerCase()));

  const originalCount = sanitizedElements.length;

  // Filter out any hidden or aria-hidden elements that slipped through
  const visibleElements = sanitizedElements.filter(el => {
    if (el.visible === false) return false;
    if (el.attributes?.['aria-hidden'] === 'true') return false;
    if (el.attributes?.hidden !== null && el.attributes?.hidden !== undefined) return false;
    return true;
  });

  // Calculate scores and sort deterministically
  const scored = visibleElements.map(el => ({
    element: el,
    score: computeElementRelevanceScore(el, taskKeywords, preserveSet),
  }));

  // Sort descending by score, tie-break with geometric position and ID
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const yDiff = (a.element.bbox?.y ?? 0) - (b.element.bbox?.y ?? 0);
    if (Math.abs(yDiff) > 0.02) return yDiff;
    const xDiff = (a.element.bbox?.x ?? 0) - (b.element.bbox?.x ?? 0);
    if (Math.abs(xDiff) > 0.02) return xDiff;
    return a.element.id.localeCompare(b.element.id);
  });

  // Check if critical targets exist in the original set
  const originalTargets = new Set<string>();
  for (const el of visibleElements) {
    if (preserveSet.has(el.id.toLowerCase())) {
      originalTargets.add(el.id.toLowerCase());
    }
  }

  // Element count slicing
  let retained = scored.slice(0, maxElements).map(s => s.element);

  // Guarantee: if a critical target was present in original set, it MUST be preserved in retained set
  for (const targetId of originalTargets) {
    const isRetained = retained.some(el => el.id.toLowerCase() === targetId);
    if (!isRetained) {
      const targetItem = scored.find(s => s.element.id.toLowerCase() === targetId);
      if (targetItem) {
        // Swap out the lowest scored non-preserved element
        if (retained.length >= maxElements) {
          retained.pop();
        }
        retained.push(targetItem.element);
      }
    }
  }

  // Byte budget enforcement loop
  const encoder = new TextEncoder();

  let context: DOMContext = { page_title: pageTitle, elements: retained };
  let serialized = JSON.stringify(context);
  let bytes = encoder.encode(serialized).length;

  // If byte budget exceeded, iteratively drop lowest-ranked non-preserved elements
  if (bytes > maxPayloadBytes) {
    while (bytes > maxPayloadBytes && retained.length > 0) {
      // Find lowest ranked element that is NOT a preserved target
      let dropIndex = -1;
      for (let i = retained.length - 1; i >= 0; i--) {
        if (!preserveSet.has(retained[i].id.toLowerCase())) {
          dropIndex = i;
          break;
        }
      }

      if (dropIndex === -1) {
        // Only preserved targets left and STILL exceeds budget!
        return {
          context: { page_title: pageTitle, elements: [] },
          context_truncated: true,
          original_element_count: originalCount,
          retained_element_count: 0,
          dropped_element_count: originalCount,
          serialized_payload_bytes: bytes,
          max_payload_bytes: maxPayloadBytes,
          target_preserved: false,
          error: `target context unavailable: payload budget exceeded (${bytes}B > ${maxPayloadBytes}B) even with minimal targets`,
          status: 'target_context_unavailable',
        };
      }

      retained.splice(dropIndex, 1);
      context = { page_title: pageTitle, elements: retained };
      serialized = JSON.stringify(context);
      bytes = encoder.encode(serialized).length;
    }
  }

  // Check if requested targets are preserved
  let allTargetsPreserved = true;
  for (const targetId of originalTargets) {
    if (!retained.some(el => el.id.toLowerCase() === targetId)) {
      allTargetsPreserved = false;
      break;
    }
  }

  if (originalTargets.size > 0 && !allTargetsPreserved) {
    return {
      context,
      context_truncated: true,
      original_element_count: originalCount,
      retained_element_count: retained.length,
      dropped_element_count: originalCount - retained.length,
      serialized_payload_bytes: bytes,
      max_payload_bytes: maxPayloadBytes,
      target_preserved: false,
      error: 'target context unavailable: critical target dropped by payload budget',
      status: 'target_context_unavailable',
    };
  }

  const truncated = retained.length < originalCount;

  return {
    context,
    context_truncated: truncated,
    original_element_count: originalCount,
    retained_element_count: retained.length,
    dropped_element_count: originalCount - retained.length,
    serialized_payload_bytes: bytes,
    max_payload_bytes: maxPayloadBytes,
    target_preserved: allTargetsPreserved,
    status: 'ok',
  };
}
