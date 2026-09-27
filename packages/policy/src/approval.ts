// ─── packages/policy/src/approval.ts ───
// Formal Approval State Machine with cryptographic/nonce and context binding.

import type { ApprovalState, RiskLevel, ActionCommand, DOMElement } from '@sih26171/protocol';
import { validateTargetFingerprint, computeTargetFingerprint } from './fingerprint.js';

export interface ApprovalBinding {
  commandId: string;
  targetFingerprint: string;
  riskLevel: RiskLevel;
  tabId: number;
  createdAt: number;
  approvedAt?: number;
  expiresAt: number;
  state: ApprovalState;
  reason: string;
  trustedSessionToken: string;
}

export interface ApprovalMessage {
  commandId: string;
  targetFingerprint: string;
  tabId: number;
  confirmed: boolean;
  trustedSessionToken: string;
}

export interface TransitionResult {
  success: boolean;
  nextState: ApprovalState;
  error?: string;
}

const DEFAULT_EXPIRATION_MS = 60_000; // 60s timeout

/**
 * Creates an initial approval binding in the NONE or PENDING state.
 */
export function createApprovalBinding(params: {
  commandId: string;
  action: ActionCommand;
  riskLevel: RiskLevel;
  tabId: number;
  targetElement?: DOMElement | null;
  trustedSessionToken: string;
  expirationMs?: number;
}): ApprovalBinding {
  const targetFingerprint = computeTargetFingerprint(params.targetElement || params.action.target);
  const now = Date.now();
  const expiresAt = now + (params.expirationMs ?? DEFAULT_EXPIRATION_MS);

  let initialState: ApprovalState = 'NONE';
  if (params.riskLevel === 'BLOCKED') {
    initialState = 'REJECTED';
  } else if (params.riskLevel === 'HIGH' || params.riskLevel === 'CRITICAL' || params.action.requires_confirmation) {
    initialState = 'PENDING';
  } else if (params.riskLevel === 'LOW' || params.riskLevel === 'MEDIUM') {
    initialState = 'APPROVED';
  }

  return {
    commandId: params.commandId,
    targetFingerprint,
    riskLevel: params.riskLevel,
    tabId: params.tabId,
    createdAt: now,
    expiresAt,
    state: initialState,
    reason: `Initial state for risk level ${params.riskLevel}`,
    trustedSessionToken: params.trustedSessionToken,
  };
}

/**
 * Executes a state transition on an approval binding, enforcing strict policy constraints.
 */
export function transitionApprovalState(
  binding: ApprovalBinding,
  event:
    | { type: 'REQUEST_APPROVAL' }
    | { type: 'SUBMIT_APPROVAL'; message: ApprovalMessage }
    | { type: 'CANCEL'; reason?: string }
    | { type: 'TIMEOUT' }
    | { type: 'TARGET_MUTATED'; currentTarget?: DOMElement | null }
    | { type: 'POLICY_REJECT'; reason: string }
    | { type: 'EXECUTION_REVALIDATE'; currentTarget: DOMElement | null }
): TransitionResult {
  const now = Date.now();

  // Terminal state protection: CANCELLED and REJECTED can never transition
  if (binding.state === 'CANCELLED' || binding.state === 'REJECTED') {
    return {
      success: false,
      nextState: binding.state,
      error: `Illegal transition: Cannot transition from terminal state ${binding.state}.`,
    };
  }

  switch (event.type) {
    case 'REQUEST_APPROVAL': {
      if (binding.state !== 'NONE') {
        return {
          success: false,
          nextState: binding.state,
          error: `Cannot request approval when already in state ${binding.state}.`,
        };
      }
      binding.state = 'PENDING';
      return { success: true, nextState: 'PENDING' };
    }

    case 'SUBMIT_APPROVAL': {
      if (binding.state !== 'PENDING') {
        return {
          success: false,
          nextState: binding.state,
          error: `Cannot approve action: Current state is ${binding.state}, expected PENDING.`,
        };
      }

      const msg = event.message;

      // Check 1: Expiration
      if (now > binding.expiresAt) {
        binding.state = 'REJECTED';
        binding.reason = 'Approval request expired before user response.';
        return { success: false, nextState: 'REJECTED', error: binding.reason };
      }

      // Check 2: Session token forgery
      if (!msg.trustedSessionToken || msg.trustedSessionToken !== binding.trustedSessionToken) {
        binding.state = 'REJECTED';
        binding.reason = 'Security rejection: Untrusted or forged session token.';
        return { success: false, nextState: 'REJECTED', error: binding.reason };
      }

      // Check 3: Command ID binding
      if (msg.commandId !== binding.commandId) {
        binding.state = 'REJECTED';
        binding.reason = `Security rejection: Command ID mismatch (${msg.commandId} !== ${binding.commandId}).`;
        return { success: false, nextState: 'REJECTED', error: binding.reason };
      }

      // Check 4: Tab ID binding
      if (msg.tabId !== binding.tabId) {
        binding.state = 'REJECTED';
        binding.reason = `Security rejection: Tab ID mismatch (${msg.tabId} !== ${binding.tabId}).`;
        return { success: false, nextState: 'REJECTED', error: binding.reason };
      }

      // Check 5: Target fingerprint binding
      if (!validateTargetFingerprint(binding.targetFingerprint, { element_id: msg.targetFingerprint })) {
        if (msg.targetFingerprint !== binding.targetFingerprint) {
          binding.state = 'REJECTED';
          binding.reason = `Security rejection: Target fingerprint mismatch.`;
          return { success: false, nextState: 'REJECTED', error: binding.reason };
        }
      }

      // Check 6: User explicit confirmation flag
      if (!msg.confirmed) {
        binding.state = 'CANCELLED';
        binding.reason = 'User explicitly cancelled approval.';
        return { success: true, nextState: 'CANCELLED' };
      }

      binding.state = 'APPROVED';
      binding.approvedAt = now;
      binding.reason = 'User explicitly approved high-risk action via trusted side panel.';
      return { success: true, nextState: 'APPROVED' };
    }

    case 'CANCEL': {
      if (binding.state !== 'PENDING') {
        return {
          success: false,
          nextState: binding.state,
          error: `Cannot cancel action from state ${binding.state}.`,
        };
      }
      binding.state = 'CANCELLED';
      binding.reason = event.reason || 'User cancelled action.';
      return { success: true, nextState: 'CANCELLED' };
    }

    case 'TIMEOUT': {
      binding.state = 'REJECTED';
      binding.reason = 'Approval timed out.';
      return { success: true, nextState: 'REJECTED' };
    }

    case 'TARGET_MUTATED': {
      binding.state = 'REJECTED';
      binding.reason = 'Target element mutated or was replaced before execution.';
      return { success: true, nextState: 'REJECTED' };
    }

    case 'POLICY_REJECT': {
      binding.state = 'REJECTED';
      binding.reason = event.reason;
      return { success: true, nextState: 'REJECTED' };
    }

    case 'EXECUTION_REVALIDATE': {
      if (binding.state !== 'APPROVED') {
        return {
          success: false,
          nextState: binding.state,
          error: `Execution prohibited: Approval state is ${binding.state}, not APPROVED.`,
        };
      }

      const target = event.currentTarget;
      if (!target) {
        binding.state = 'REJECTED';
        binding.reason = 'Execution rejected: Target element missing from DOM.';
        return { success: false, nextState: 'REJECTED', error: binding.reason };
      }

      if (!target.visible || target.disabled) {
        binding.state = 'REJECTED';
        binding.reason = 'Execution rejected: Target element is disabled or hidden.';
        return { success: false, nextState: 'REJECTED', error: binding.reason };
      }

      if (!validateTargetFingerprint(binding.targetFingerprint, target)) {
        binding.state = 'REJECTED';
        binding.reason = 'Execution rejected: Target fingerprint changed since approval was granted.';
        return { success: false, nextState: 'REJECTED', error: binding.reason };
      }

      return { success: true, nextState: 'APPROVED' };
    }
  }
}
