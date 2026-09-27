// ─── apps/extension/src/content/index.ts ───
// Content script: runs in the page context.
// Responsibilities:
//   1. Extract DOM elements on demand (via message from background).
//   2. Exclude aria-hidden, hidden, and invisible elements.
//   3. Never return password values or raw typed input values.
//   4. Preserve safe targets like #download-report.
//   5. Execute validated actions with strict DOM re-read safety checks.

import type {
  DOMElement,
  DOMContext,
  ActionCommand,
  BBox,
  InternalMessage,
  ViewportInfo,
} from '@sih26171/protocol';
import { ALLOWED_ACTION_TYPES } from '@sih26171/protocol';

// ─── Element ID counter ───
let elementCounter = 0;

function resetElementCounter(): void {
  elementCounter = 0;
}

function getOrAssignAgentId(el: Element): string {
  const existing = el.getAttribute('data-agent-id');
  if (existing) return existing;
  if (el.id === 'download-report') {
    el.setAttribute('data-agent-id', 'download-report');
    return 'download-report';
  }
  if (el.id) {
    el.setAttribute('data-agent-id', el.id);
    return el.id;
  }
  elementCounter++;
  const id = `e_${String(elementCounter).padStart(3, '0')}`;
  el.setAttribute('data-agent-id', id);
  return id;
}

// ─── Interactive element selectors ───
const INTERACTIVE_SELECTORS = [
  'a[href]', 'button', 'input', 'select', 'textarea',
  '[role="button"]', '[role="link"]', '[role="menuitem"]',
  '[role="tab"]', '[role="checkbox"]', '[role="radio"]',
  '[role="switch"]', '[role="combobox"]', '[role="listbox"]',
  '[role="option"]', '[role="slider"]', '[role="spinbutton"]',
  '[role="textbox"]', '[contenteditable="true"]',
  '[tabindex]', '[onclick]', 'label', 'summary', 'details',
  '[data-agent-id]',
].join(', ');

// ─── Visibility & Accessibility Filtering ───
function isElementVisible(el: Element): boolean {
  // Exclude aria-hidden elements and elements inside aria-hidden ancestors
  if (el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]') !== null) {
    return false;
  }
  // Exclude HTML5 hidden elements and elements inside hidden ancestors
  if (el.getAttribute('hidden') !== null || el.closest('[hidden]') !== null) {
    return false;
  }

  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) < 0.1) return false;

  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  if (rect.bottom < 0 || rect.right < 0 ||
      rect.top > window.innerHeight || rect.left > window.innerWidth) return false;
  return true;
}

// ─── BBox ───
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

// ─── Value state (never returns raw values) ───
function getValueState(el: Element): DOMElement['value_state'] {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || el.type === 'radio') {
      if (el.indeterminate) return 'indeterminate';
      return el.checked ? 'checked' : 'unchecked';
    }
    return el.value.length > 0 ? 'filled' : 'empty';
  }
  if (el instanceof HTMLTextAreaElement) return el.value.length > 0 ? 'filled' : 'empty';
  if (el instanceof HTMLSelectElement) return el.selectedIndex >= 0 ? 'filled' : 'empty';
  return 'empty';
}

// ─── Role ───
function getRole(el: Element): string | null {
  const ariaRole = el.getAttribute('role');
  if (ariaRole) return ariaRole;
  const tag = el.tagName.toLowerCase();
  const map: Record<string, string> = {
    a: 'link', button: 'button', input: 'textbox', select: 'combobox',
    textarea: 'textbox', img: 'img', nav: 'navigation', form: 'form',
  };
  if (tag === 'input' && el instanceof HTMLInputElement) {
    switch (el.type) {
      case 'checkbox': return 'checkbox';
      case 'radio': return 'radio';
      case 'submit': case 'button': return 'button';
      case 'range': return 'slider';
      default: return 'textbox';
    }
  }
  return map[tag] || null;
}

// ─── Text extraction (Privacy-safe: no raw passwords, no typed input secrets) ───
function getVisibleText(el: Element, maxLen: number = 120): string {
  if (el instanceof HTMLInputElement) {
    // NEVER return password values or sensitive raw input values
    if (el.type === 'password') {
      return '';
    }
    // Return placeholder or aria-label, NEVER the raw user-typed input value
    return (el.placeholder || el.getAttribute('aria-label') || '').slice(0, maxLen);
  }
  if (el instanceof HTMLTextAreaElement) {
    return (el.placeholder || el.getAttribute('aria-label') || '').slice(0, maxLen);
  }
  if (el instanceof HTMLSelectElement) {
    const sel = el.options[el.selectedIndex];
    return sel ? sel.text.slice(0, maxLen) : '';
  }
  return ((el as HTMLElement).innerText || el.textContent || '')
    .replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

// ─── DOM Extraction ───
function extractDOM(maxElements: number = 200): {
  context: DOMContext;
  extraction_ms: number;
  total_scanned: number;
  retained_count: number;
  dropped_count: number;
} {
  const start = performance.now();
  const allEls = document.querySelectorAll(INTERACTIVE_SELECTORS);
  const results: DOMElement[] = [];
  let dropped = 0;

  for (const el of allEls) {
    if (!isElementVisible(el)) {
      dropped++;
      continue;
    }
    const id = getOrAssignAgentId(el);
    results.push({
      id,
      tag: el.tagName.toLowerCase(),
      role: getRole(el),
      text: getVisibleText(el),
      aria_label: el.getAttribute('aria-label'),
      input_type: el instanceof HTMLInputElement ? el.type : null,
      value_state: getValueState(el),
      disabled: (el as HTMLInputElement).disabled === true,
      visible: true,
      bbox: computeNormalizedBBox(el),
      attributes: {
        autocomplete: el.getAttribute('autocomplete'),
        data_agent_id: id,
      },
    });
  }

  // Ensure #download-report is preserved even if selector edge cases occur
  const downloadReportEl = document.getElementById('download-report');
  if (downloadReportEl && isElementVisible(downloadReportEl)) {
    const hasDownload = results.some(
      r => r.id === 'download-report' || r.id === downloadReportEl.getAttribute('data-agent-id')
    );
    if (!hasDownload) {
      const id = getOrAssignAgentId(downloadReportEl);
      results.push({
        id,
        tag: downloadReportEl.tagName.toLowerCase(),
        role: getRole(downloadReportEl),
        text: getVisibleText(downloadReportEl),
        aria_label: downloadReportEl.getAttribute('aria-label'),
        input_type: null,
        value_state: 'empty',
        disabled: (downloadReportEl as HTMLButtonElement).disabled === true,
        visible: true,
        bbox: computeNormalizedBBox(downloadReportEl),
        attributes: {
          autocomplete: null,
          data_agent_id: id,
        },
      });
    }
  }

  results.sort((a, b) => {
    const yDiff = a.bbox.y - b.bbox.y;
    if (Math.abs(yDiff) > 0.02) return yDiff;
    return a.bbox.x - b.bbox.x;
  });

  const sliced = results.slice(0, maxElements);

  return {
    context: { page_title: document.title, elements: sliced },
    extraction_ms: performance.now() - start,
    total_scanned: allEls.length,
    retained_count: sliced.length,
    dropped_count: dropped,
  };
}

// ─── Viewport Info ───
function getViewportInfo(): ViewportInfo {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    device_pixel_ratio: window.devicePixelRatio,
    scroll_x: window.scrollX,
    scroll_y: window.scrollY,
    url_origin: window.location.origin,
  };
}

// ─── Action Executor ───

function findElementById(elementId: string): HTMLElement | null {
  if (!elementId) return null;
  // Match by data-agent-id
  let el = document.querySelector(`[data-agent-id="${elementId}"]`) as HTMLElement | null;
  if (el) return el;
  // Match by ID
  el = document.getElementById(elementId);
  if (el) return el;
  // Match by selector
  try {
    return document.querySelector(elementId) as HTMLElement | null;
  } catch {
    return null;
  }
}

function executeClick(target: HTMLElement): void {
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => {
    target.focus();
    target.click();
  }, 100);
}

function executeType(target: HTMLElement, text: string): void {
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.focus();
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const nativeInputValueSetter =
      Object.getOwnPropertyDescriptor(
        target instanceof HTMLInputElement
          ? HTMLInputElement.prototype
          : HTMLTextAreaElement.prototype,
        'value'
      )?.set;
    nativeInputValueSetter?.call(target, text);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function executeScroll(args: Record<string, unknown>): void {
  const dx = typeof args.delta_x === 'number' ? args.delta_x : 0;
  const dy = typeof args.delta_y === 'number' ? args.delta_y : 0;
  window.scrollBy({
    left: dx * window.innerWidth,
    top: dy * window.innerHeight,
    behavior: 'smooth',
  });
}

function executeKeypress(target: HTMLElement, key: string): void {
  target.focus();
  const eventInit: KeyboardEventInit = { key, bubbles: true, cancelable: true };
  target.dispatchEvent(new KeyboardEvent('keydown', eventInit));
  target.dispatchEvent(new KeyboardEvent('keypress', eventInit));
  target.dispatchEvent(new KeyboardEvent('keyup', eventInit));
}

function executeSubmit(target: HTMLElement): void {
  const form = target.closest('form');
  if (form) {
    form.requestSubmit();
  } else if (target instanceof HTMLButtonElement && target.type === 'submit') {
    target.click();
  } else {
    target.click();
  }
}

interface ExecutionResult {
  success: boolean;
  error?: string;
  execution_ms: number;
}

function executeAction(action: ActionCommand): ExecutionResult {
  const start = performance.now();

  try {
    // Reject unknown action types
    if (!ALLOWED_ACTION_TYPES.includes(action.type) && action.type !== 'wait' && action.type !== 'needs_user_input') {
      return {
        success: false,
        error: `Unknown action type: ${action.type}`,
        execution_ms: performance.now() - start,
      };
    }

    // Wait, needs_user_input, and observe don't need a DOM target
    if (action.type === 'wait' || action.type === 'needs_user_input' || action.type === 'observe') {
      return { success: true, execution_ms: performance.now() - start };
    }

    // Resolve target element with pre-execution re-read of current DOM
    const target = findElementById(action.target.element_id);
    if (!target) {
      return {
        success: false,
        error: `Element not found: ${action.target.element_id} — DOM may be stale`,
        execution_ms: performance.now() - start,
      };
    }

    // Verify element is connected to the DOM
    if (!target.isConnected) {
      return {
        success: false,
        error: `Element ${action.target.element_id} is disconnected from DOM`,
        execution_ms: performance.now() - start,
      };
    }

    // Verify element is still visible (including no aria-hidden)
    if (!isElementVisible(target)) {
      return {
        success: false,
        error: `Element ${action.target.element_id} is not visible or hidden`,
        execution_ms: performance.now() - start,
      };
    }

    // Verify element is not disabled
    if ((target as HTMLButtonElement).disabled === true || target.getAttribute('aria-disabled') === 'true') {
      return {
        success: false,
        error: `Element ${action.target.element_id} is disabled`,
        execution_ms: performance.now() - start,
      };
    }

    switch (action.type) {
      case 'click':
        executeClick(target);
        break;
      case 'type': {
        const text = action.arguments?.text;
        if (typeof text !== 'string') {
          return {
            success: false,
            error: 'type action requires arguments.text as string',
            execution_ms: performance.now() - start,
          };
        }
        executeType(target, text);
        break;
      }
      case 'scroll':
        executeScroll(action.arguments || {});
        break;
      case 'keypress': {
        const key = action.arguments?.key;
        if (typeof key !== 'string') {
          return {
            success: false,
            error: 'keypress action requires arguments.key as string',
            execution_ms: performance.now() - start,
          };
        }
        executeKeypress(target, key);
        break;
      }
      case 'submit':
        executeSubmit(target);
        break;
      default:
        return {
          success: false,
          error: `Unsupported action type: ${action.type}`,
          execution_ms: performance.now() - start,
        };
    }

    return { success: true, execution_ms: performance.now() - start };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      execution_ms: performance.now() - start,
    };
  }
}

// ─── Message Handler ───
const api = (globalThis as any).chrome || (globalThis as any).browser;

api.runtime.onMessage.addListener(
  (message: InternalMessage, _sender: any, sendResponse: (resp: any) => void) => {
    switch (message.type) {
      case 'CAPTURE_REQUEST': {
        const { context, extraction_ms, total_scanned, retained_count, dropped_count } = extractDOM();
        const viewport = getViewportInfo();
        sendResponse({
          type: 'CAPTURE_RESULT',
          payload: { dom_context: context, viewport, extraction_ms, total_scanned, retained_count, dropped_count },
          timestamp_ms: Date.now(),
        });
        return true;
      }

      case 'SCAN_PAGE': {
        const { context, extraction_ms, total_scanned, retained_count, dropped_count } = extractDOM();
        const viewport = getViewportInfo();
        sendResponse({
          type: 'SCAN_RESULT',
          payload: {
            dom_context: context,
            viewport,
            extraction_ms,
            total_scanned,
            retained_count,
            dropped_count,
          },
          timestamp_ms: Date.now(),
        });
        return true;
      }

      case 'EXECUTE_ACTION': {
        const action = message.payload as ActionCommand;
        const result = executeAction(action);
        sendResponse({
          type: 'ACTION_RESULT',
          payload: result,
          timestamp_ms: Date.now(),
        });
        return true;
      }

      default:
        return false;
    }
  }
);

// Reset element counter on navigation
window.addEventListener('beforeunload', () => resetElementCounter());

console.log('[SIH26171] Content script loaded');
