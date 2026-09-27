// ─── packages/policy/src/risk.ts ───
// Risk classification and local policy evaluation rules.

import type { ActionCommand, DOMElement, RiskLevel } from '@sih26171/protocol';
import { computeTargetFingerprint } from './fingerprint.js';

export interface RiskClassification {
  riskLevel: RiskLevel;
  risk_level: RiskLevel;
  reason: string;
  isBlocked: boolean;
  blockedReason?: string;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  reason: string;
  targetFingerprint: string;
  blocked: boolean;
  violation?: string;
}

// Disallowed action types that are always blocked
const BLOCKED_ACTION_TYPES = new Set([
  'execute_javascript',
  'eval',
  'script',
  'run_script',
  'arbitrary_code',
  'code_execution',
  'read_cookie',
  'write_cookie',
  'read_storage',
  'write_storage',
]);

// Patterns in arguments or target that represent forbidden secret/credential tampering
const SECRET_ARG_PATTERNS = [
  /password/i,
  /passwd/i,
  /auth_token/i,
  /session_cookie/i,
  /secret_key/i,
  /credit_card/i,
  /cvv/i,
];

// High-risk action indicators
const HIGH_RISK_PATTERNS = [
  /download/i,
  /export/i,
  /submit/i,
  /upload/i,
  /pay/i,
  /purchase/i,
  /checkout/i,
  /transfer/i,
  /delete/i,
  /remove/i,
  /destroy/i,
  /sign.?out/i,
  /log.?out/i,
  /deactivate/i,
  /security/i,
  /navigate/i,
];

/**
 * Classifies the risk level of an action based on action type, target hints, and arguments.
 */
export function classifyActionRisk(
  action: ActionCommand,
  targetElement?: DOMElement | null
): RiskClassification {
  const res = _classifyActionRiskInner(action, targetElement);
  return {
    ...res,
    risk_level: res.riskLevel,
  };
}

function _classifyActionRiskInner(
  action: ActionCommand,
  targetElement?: DOMElement | null
): Omit<RiskClassification, 'risk_level'> {
  const typeLower = (action.type || '').toLowerCase();
  const targetId = (action.target?.element_id || '').toLowerCase();
  const textHint = (action.target?.text_hint || '').toLowerCase();
  const selectorHint = (action.target?.selector_hint || '').toLowerCase();
  const elText = (targetElement?.text || '').toLowerCase();
  const elAria = (targetElement?.aria_label || '').toLowerCase();
  const elRole = (targetElement?.role || '').toLowerCase();

  const combinedHints = `${targetId} ${textHint} ${selectorHint} ${elText} ${elAria} ${elRole}`;

  // 1. BLOCKED CHECKS
  // 1a. Explicitly blocked action types
  if (BLOCKED_ACTION_TYPES.has(typeLower)) {
    return {
      riskLevel: 'BLOCKED',
      reason: `Action type "${action.type}" is permanently forbidden by security policy.`,
      isBlocked: true,
      blockedReason: `Arbitrary execution or privileged browser access is blocked.`,
    };
  }

  // 1b. Secret argument inspection
  if (action.arguments && typeof action.arguments === 'object') {
    for (const [key, val] of Object.entries(action.arguments)) {
      const valStr = String(val);
      for (const pattern of SECRET_ARG_PATTERNS) {
        if (pattern.test(key) || pattern.test(valStr)) {
          return {
            riskLevel: 'BLOCKED',
            reason: `Action argument contains sensitive credential pattern "${key}".`,
            isBlocked: true,
            blockedReason: 'Injecting raw secrets or passwords via agent action arguments is blocked.',
          };
        }
      }
    }
  }

  // 1c. Password field manipulation
  if (
    typeLower === 'type' &&
    (targetElement?.input_type === 'password' ||
      combinedHints.includes('password') ||
      combinedHints.includes('passwd'))
  ) {
    return {
      riskLevel: 'BLOCKED',
      reason: 'Automated typing into password fields is blocked by local privacy policy.',
      isBlocked: true,
      blockedReason: 'Password filling requires manual user entry.',
    };
  }

  // 1d. Hidden target action attempted
  if (targetElement && (!targetElement.visible || targetElement.attributes?.['aria-hidden'] === 'true')) {
    return {
      riskLevel: 'BLOCKED',
      reason: 'Target element is hidden or aria-hidden.',
      isBlocked: true,
      blockedReason: 'Actions on invisible DOM nodes are blocked to prevent clickjacking/spoofing.',
    };
  }

  // 1e. Unknown unsafe actions where target cannot be validated
  if (
    typeLower !== 'observe' &&
    typeLower !== 'wait' &&
    typeLower !== 'scroll' &&
    (!action.target || (!action.target.element_id && !action.target.selector_hint))
  ) {
    return {
      riskLevel: 'BLOCKED',
      reason: 'Action target cannot be validated or resolved.',
      isBlocked: true,
      blockedReason: 'Target-less interactive actions are blocked.',
    };
  }

  // 2. HIGH RISK CHECKS
  // 2a. Download / Export triggers (Download Report is explicitly HIGH)
  if (
    targetId === 'download-report' ||
    combinedHints.includes('download') ||
    combinedHints.includes('export')
  ) {
    return {
      riskLevel: 'HIGH',
      reason: 'This action may create a file.',
      isBlocked: false,
    };
  }

  // 2b. Form submission, financial, deletion, or account changes
  if (typeLower === 'submit') {
    return {
      riskLevel: 'HIGH',
      reason: 'Form submission may alter persistent server state.',
      isBlocked: false,
    };
  }

  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.test(combinedHints)) {
      return {
        riskLevel: 'HIGH',
        reason: `Action matches high-risk pattern: ${pattern.source}`,
        isBlocked: false,
      };
    }
  }

  // 3. LOW RISK CHECKS
  if (typeLower === 'observe' || typeLower === 'wait' || typeLower === 'scroll') {
    return {
      riskLevel: 'LOW',
      reason: 'Passive observation or scrolling has no side effects.',
      isBlocked: false,
    };
  }

  // 4. MEDIUM RISK CHECKS
  if (typeLower === 'click') {
    return {
      riskLevel: 'MEDIUM',
      reason: 'Standard interactive click on visible UI element.',
      isBlocked: false,
    };
  }

  if (typeLower === 'type' || typeLower === 'keypress') {
    return {
      riskLevel: 'MEDIUM',
      reason: 'Harmless text input or keypress into standard editable field.',
      isBlocked: false,
    };
  }

  // 5. DEFAULT FOR UNKNOWN ACTIONS
  return {
    riskLevel: 'HIGH',
    reason: `Unknown action type "${action.type}" defaults to HIGH risk.`,
    isBlocked: false,
  };
}

/**
 * Determines whether confirmation is required for a given risk level and action.
 */
export function requiresConfirmation(riskLevel: RiskLevel, action?: ActionCommand): boolean {
  if (riskLevel === 'BLOCKED') return false; // Blocked actions are rejected outright, not confirmed
  if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') return true;
  if (action?.requires_confirmation === true) return true;
  return false;
}

/**
 * Evaluates local policy against an action command and target.
 * Note: Server responses cannot reduce local risk or bypass confirmation.
 */
export function evaluateLocalPolicy(
  action: ActionCommand,
  targetElement?: DOMElement | null
): PolicyEvaluationResult {
  const classification = classifyActionRisk(action, targetElement);
  const targetFingerprint = computeTargetFingerprint(targetElement || action.target);

  if (classification.isBlocked) {
    return {
      allowed: false,
      riskLevel: 'BLOCKED',
      requiresApproval: false,
      reason: classification.reason,
      targetFingerprint,
      blocked: true,
      violation: classification.blockedReason,
    };
  }

  // Enforce invariant: Server cannot downgrade risk from HIGH to LOW
  const effectiveRisk: RiskLevel = classification.riskLevel;
  const needsApproval = requiresConfirmation(effectiveRisk, action);

  return {
    allowed: true,
    riskLevel: effectiveRisk,
    requiresApproval: needsApproval,
    reason: classification.reason,
    targetFingerprint,
    blocked: false,
  };
}
