// ─── packages/protocol/src/validation.ts ───
// Runtime validation for server responses and client requests.
// Uses manual validation (no external JSON Schema library needed at runtime).

import {
  AgentResponse,
  ActionCommand,
  ActionTarget,
  BBox,
  ALLOWED_ACTION_TYPES,
  PROTOCOL_VERSION,
  ActionType,
  CONFIRMATION_REQUIRED_ACTIONS,
  CONFIRMATION_REQUIRED_PATTERNS,
  DOMElement,
  ExtensionConfig,
  DEFAULT_CONFIG,
} from './types.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── BBox Validation ───

export function validateBBox(bbox: unknown, label: string): string[] {
  const errors: string[] = [];
  if (!bbox || typeof bbox !== 'object') {
    errors.push(`${label}: bbox must be an object`);
    return errors;
  }
  const b = bbox as Record<string, unknown>;
  for (const key of ['x', 'y', 'w', 'h']) {
    if (typeof b[key] !== 'number') {
      errors.push(`${label}: bbox.${key} must be a number`);
    } else {
      const v = b[key] as number;
      if (v < 0 || v > 1) {
        errors.push(`${label}: bbox.${key} must be in [0, 1], got ${v}`);
      }
    }
  }
  return errors;
}

// ─── Action Target Validation ───

export function validateActionTarget(target: unknown): string[] {
  const errors: string[] = [];
  if (!target || typeof target !== 'object') {
    errors.push('action.target must be an object');
    return errors;
  }
  const t = target as Record<string, unknown>;

  if (typeof t.element_id !== 'string' || !t.element_id) {
    errors.push('action.target.element_id must be a non-empty string');
  }
  if (typeof t.selector_hint !== 'string') {
    errors.push('action.target.selector_hint must be a string');
  }
  if (typeof t.text_hint !== 'string') {
    errors.push('action.target.text_hint must be a string');
  }
  errors.push(...validateBBox(t.bbox, 'action.target'));
  return errors;
}

// ─── Action Command Validation ───

export function validateActionCommand(action: unknown): string[] {
  const errors: string[] = [];
  if (!action || typeof action !== 'object') {
    errors.push('action must be an object');
    return errors;
  }
  const a = action as Record<string, unknown>;

  // Type check — reject unknown action types
  if (typeof a.type !== 'string' || !ALLOWED_ACTION_TYPES.includes(a.type as ActionType)) {
    errors.push(
      `action.type must be one of [${ALLOWED_ACTION_TYPES.join(', ')}], got "${a.type}"`
    );
  }

  // Confidence check
  if (typeof a.confidence !== 'number' || a.confidence < 0 || a.confidence > 1) {
    errors.push('action.confidence must be a number in [0, 1]');
  }

  if (typeof a.requires_confirmation !== 'boolean') {
    errors.push('action.requires_confirmation must be a boolean');
  }

  // Target
  errors.push(...validateActionTarget(a.target));

  // Arguments — must be an object, never contain secrets
  if (a.arguments !== undefined && a.arguments !== null) {
    if (typeof a.arguments !== 'object' || Array.isArray(a.arguments)) {
      errors.push('action.arguments must be a plain object');
    } else {
      // Check for secret text injection
      const args = a.arguments as Record<string, unknown>;
      const secretKeys = ['password', 'secret', 'token', 'auth', 'cookie', 'session'];
      for (const key of Object.keys(args)) {
        if (secretKeys.some(s => key.toLowerCase().includes(s))) {
          errors.push(`action.arguments contains potentially secret key: "${key}"`);
        }
      }
    }
  }

  return errors;
}

// ─── Full Response Validation ───

export function validateAgentResponse(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Response must be a JSON object'] };
  }

  const r = raw as Record<string, unknown>;

  // Protocol version
  if (r.protocol_version !== PROTOCOL_VERSION) {
    errors.push(
      `protocol_version must be "${PROTOCOL_VERSION}", got "${r.protocol_version}"`
    );
  }

  // Request ID
  if (typeof r.request_id !== 'string' || !r.request_id) {
    errors.push('request_id must be a non-empty string');
  }

  // Status
  if (!['ok', 'error', 'needs_more_context'].includes(r.status as string)) {
    errors.push('status must be "ok", "error", or "needs_more_context"');
  }

  // If status is error, action may be absent
  if (r.status === 'ok' || r.status === 'needs_more_context') {
    errors.push(...validateActionCommand(r.action));
  }

  if (typeof r.next_observation !== 'boolean') {
    errors.push('next_observation must be a boolean');
  }

  if (typeof r.explanation !== 'string') {
    errors.push('explanation must be a string');
  }

  return { valid: errors.length === 0, errors };
}

// ─── Confidence Gate ───

export function isConfidenceSufficient(
  action: ActionCommand,
  config: Pick<ExtensionConfig, 'confidence_threshold'> = DEFAULT_CONFIG
): boolean {
  return action.confidence >= config.confidence_threshold;
}

// ─── Confirmation Policy ───

/**
 * Determines if an action requires explicit user confirmation.
 * Rules:
 *  1. Actions in CONFIRMATION_REQUIRED_ACTIONS always need confirmation.
 *  2. Actions targeting elements whose text/role matches CONFIRMATION_REQUIRED_PATTERNS.
 *  3. Server may also set requires_confirmation = true.
 *  4. Navigation-related actions need confirmation.
 */
export function requiresConfirmation(
  action: ActionCommand,
  domElement?: DOMElement,
  config: Pick<ExtensionConfig, 'require_confirmation_patterns'> = DEFAULT_CONFIG
): boolean {
  // Server says so
  if (action.requires_confirmation) return true;

  // Action type is inherently dangerous
  if (CONFIRMATION_REQUIRED_ACTIONS.includes(action.type)) return true;

  // Pattern matching on the action target text
  if (config.require_confirmation_patterns) {
    const textToCheck = [
      action.target.text_hint,
      domElement?.text,
      domElement?.aria_label,
      domElement?.role,
    ]
      .filter(Boolean)
      .join(' ');

    if (CONFIRMATION_REQUIRED_PATTERNS.some(p => p.test(textToCheck))) {
      return true;
    }
  }

  return false;
}

// ─── Stale DOM Detection ───

/**
 * Checks if the target element still exists in the current DOM snapshot.
 * Returns the resolved element or null if stale.
 */
export function resolveTargetElement(
  target: ActionTarget,
  currentElements: DOMElement[]
): DOMElement | null {
  // Primary: match by element_id
  const byId = currentElements.find(el => el.id === target.element_id);
  if (byId && byId.visible) return byId;

  // Fallback: match by data-agent-id attribute
  const byAttr = currentElements.find(
    el => el.attributes.data_agent_id === target.element_id && el.visible
  );
  if (byAttr) return byAttr;

  return null;
}

/**
 * Checks if a DOM element's bbox has shifted significantly from the action target.
 * Returns true if the element appears to have moved (stale layout).
 */
export function isBBoxStale(
  target: BBox,
  current: BBox,
  tolerance: number = 0.05
): boolean {
  return (
    Math.abs(target.x - current.x) > tolerance ||
    Math.abs(target.y - current.y) > tolerance ||
    Math.abs(target.w - current.w) > tolerance ||
    Math.abs(target.h - current.h) > tolerance
  );
}
