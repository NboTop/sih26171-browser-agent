// ─── packages/perception/src/dom-extractor.ts ───
// Extracts interactive and visible DOM elements with stable IDs,
// bounding boxes normalized to viewport, semantic roles, and sanitized text.
// Runs in the content script context (has access to `document`).

import type {
  DOMElement,
  DOMElementAttributes,
  BBox,
  DOMContext,
  ExtensionConfig,
  DEFAULT_CONFIG,
} from '@sih26171/protocol';

// ─── Stable Element ID Strategy ───
// We assign a stable `data-agent-id` attribute to elements on first extraction.
// The ID is generated from a monotonic counter per page lifecycle.
// Re-extractions reuse existing data-agent-id if present.

let elementCounter = 0;

/** Reset the counter — call on full page navigation. */
export function resetElementCounter(): void {
  elementCounter = 0;
}

function getOrAssignAgentId(el: Element): string {
  const existing = el.getAttribute('data-agent-id');
  if (existing) return existing;
  elementCounter++;
  const id = `e_${String(elementCounter).padStart(3, '0')}`;
  el.setAttribute('data-agent-id', id);
  return id;
}

// ─── Selectors for Interactive/Visible Elements ───

const INTERACTIVE_SELECTORS = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="textbox"]',
  '[contenteditable="true"]',
  '[tabindex]',
  '[onclick]',
  'label',
  'summary',
  'details',
  '[data-agent-id]',
].join(', ');

// ─── Visibility Check ───

function isElementVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) < 0.1) return false;

  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  // Off-screen elements
  if (
    rect.bottom < 0 ||
    rect.right < 0 ||
    rect.top > window.innerHeight ||
    rect.left > window.innerWidth
  ) {
    return false;
  }

  return true;
}

// ─── BBox Computation ───

function computeNormalizedBBox(el: Element): BBox {
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  return {
    x: Math.max(0, Math.min(1, rect.left / vw)),
    y: Math.max(0, Math.min(1, rect.top / vh)),
    w: Math.max(0, Math.min(1, rect.width / vw)),
    h: Math.max(0, Math.min(1, rect.height / vh)),
  };
}

// ─── Text Extraction (sanitized) ───

function getVisibleText(el: Element, maxLength: number): string {
  // For inputs, never extract the actual value
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    // Return placeholder or label text, never the value
    return (
      (el as HTMLInputElement).placeholder ||
      el.getAttribute('aria-label') ||
      ''
    ).slice(0, maxLength);
  }

  // For selects, return the selected option's text label
  if (el instanceof HTMLSelectElement) {
    const selected = el.options[el.selectedIndex];
    return selected ? selected.text.slice(0, maxLength) : '';
  }

  // For other elements, use innerText (visible text only, not hidden)
  const text = (el as HTMLElement).innerText || el.textContent || '';
  // Collapse whitespace
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

// ─── Value State ───

function getValueState(el: Element): DOMElement['value_state'] {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || el.type === 'radio') {
      if (el.indeterminate) return 'indeterminate';
      return el.checked ? 'checked' : 'unchecked';
    }
    return el.value.length > 0 ? 'filled' : 'empty';
  }
  if (el instanceof HTMLTextAreaElement) {
    return el.value.length > 0 ? 'filled' : 'empty';
  }
  if (el instanceof HTMLSelectElement) {
    return el.selectedIndex >= 0 ? 'filled' : 'empty';
  }
  return 'empty';
}

// ─── Role Extraction ───

function getRole(el: Element): string | null {
  // Explicit ARIA role
  const ariaRole = el.getAttribute('role');
  if (ariaRole) return ariaRole;

  // Implicit roles by tag
  const tag = el.tagName.toLowerCase();
  const implicitRoles: Record<string, string> = {
    a: 'link',
    button: 'button',
    input: 'textbox',
    select: 'combobox',
    textarea: 'textbox',
    img: 'img',
    nav: 'navigation',
    main: 'main',
    form: 'form',
    table: 'table',
    header: 'banner',
    footer: 'contentinfo',
  };

  // Refine input role
  if (tag === 'input' && el instanceof HTMLInputElement) {
    switch (el.type) {
      case 'checkbox': return 'checkbox';
      case 'radio': return 'radio';
      case 'submit': return 'button';
      case 'button': return 'button';
      case 'range': return 'slider';
      case 'search': return 'searchbox';
      default: return 'textbox';
    }
  }

  return implicitRoles[tag] || null;
}

// ─── Main Extraction ───

export interface ExtractionResult {
  context: DOMContext;
  extraction_ms: number;
}

/**
 * Extracts all interactive/visible DOM elements into the canonical DOMElement shape.
 *
 * Algorithm:
 * 1. Query all elements matching interactive selectors.
 * 2. Filter to visible elements only.
 * 3. Assign stable data-agent-id attributes.
 * 4. Compute normalized bounding boxes.
 * 5. Extract sanitized text (never raw values).
 * 6. Cap at max_elements, sorted by visual position (top-to-bottom, left-to-right).
 */
export function extractDOM(
  maxElements: number = 200,
  maxTextLength: number = 120
): ExtractionResult {
  const start = performance.now();

  const allElements = document.querySelectorAll(INTERACTIVE_SELECTORS);
  const results: DOMElement[] = [];

  for (const el of allElements) {
    if (!isElementVisible(el)) continue;

    const id = getOrAssignAgentId(el);
    const tag = el.tagName.toLowerCase();
    const bbox = computeNormalizedBBox(el);

    const domEl: DOMElement = {
      id,
      tag,
      role: getRole(el),
      text: getVisibleText(el, maxTextLength),
      aria_label: el.getAttribute('aria-label'),
      input_type: el instanceof HTMLInputElement ? el.type : null,
      value_state: getValueState(el),
      disabled: (el as HTMLInputElement).disabled === true,
      visible: true,
      bbox,
      attributes: {
        autocomplete: el.getAttribute('autocomplete'),
        data_agent_id: id,
      },
    };

    results.push(domEl);
  }

  // Sort by visual position: top-to-bottom, then left-to-right
  results.sort((a, b) => {
    const yDiff = a.bbox.y - b.bbox.y;
    if (Math.abs(yDiff) > 0.02) return yDiff;
    return a.bbox.x - b.bbox.x;
  });

  // Cap at max
  const capped = results.slice(0, maxElements);

  const extraction_ms = performance.now() - start;

  return {
    context: {
      page_title: document.title,
      elements: capped,
    },
    extraction_ms,
  };
}

// ─── Viewport Info ───

export function getViewportInfo(): {
  width: number;
  height: number;
  device_pixel_ratio: number;
  scroll_x: number;
  scroll_y: number;
  url_origin: string;
} {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    device_pixel_ratio: window.devicePixelRatio,
    scroll_x: window.scrollX,
    scroll_y: window.scrollY,
    url_origin: window.location.origin,
  };
}
