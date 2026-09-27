// ─── packages/policy/src/fingerprint.ts ───
// Deterministic target fingerprint computation and validation.

import type { ActionTarget, DOMElement, BBox } from '@sih26171/protocol';

export type TargetLike =
  | string
  | ActionTarget
  | DOMElement
  | {
      id?: string;
      element_id?: string;
      selector_hint?: string;
      text_hint?: string;
      text?: string;
      tag?: string;
      role?: string | null;
      bbox?: BBox;
    };

/**
 * Computes a stable, deterministic fingerprint string for a target element.
 */
export function computeTargetFingerprint(target: TargetLike | null | undefined): string {
  if (!target) return 'none';
  if (typeof target === 'string') return target;

  const id = ('element_id' in target ? target.element_id : target.id) || '';
  const tag = ('tag' in target && target.tag ? target.tag.toLowerCase() : '') || '';
  const role = ('role' in target && target.role ? target.role.toLowerCase() : '') || '';
  const rawText = ('text_hint' in target ? target.text_hint : target.text) || '';
  const text = rawText.replace(/\s+/g, ' ').trim().slice(0, 40).toLowerCase();
  const selector = (('selector_hint' in target ? target.selector_hint : '') || '').toLowerCase();

  const bbox = target.bbox;
  const bboxStr = bbox
    ? `${bbox.x.toFixed(2)},${bbox.y.toFixed(2)},${bbox.w.toFixed(2)},${bbox.h.toFixed(2)}`
    : '0,0,0,0';

  return `${id}::${tag}::${role}::${selector}::${text}::${bboxStr}`;
}

/**
 * Validates whether the current target matches the fingerprint captured when approval was requested.
 */
export function validateTargetFingerprint(
  expectedFingerprint: string,
  currentTarget: TargetLike | null | undefined
): boolean {
  if (!expectedFingerprint || !currentTarget) return false;

  const current = computeTargetFingerprint(currentTarget);
  if (expectedFingerprint === current) return true;

  // Resilient check: if stable ID matches and text/role match, tolerate slight coordinate shifts
  const [expId, expTag, expRole, , expText] = expectedFingerprint.split('::');
  const [curId, curTag, curRole, , curText] = current.split('::');

  if (expId && expId === curId) {
    if (expTag && curTag && expTag !== curTag) return false;
    if (expRole && curRole && expRole !== curRole) return false;
    if (expText && curText && expText !== curText) return false;
    return true;
  }

  return false;
}
