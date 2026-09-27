// ─── packages/policy/src/__tests__/policy.test.ts ───
// Unit tests for the Policy Engine and Approval State Machine.

import { describe, it, expect } from 'vitest';
import type { ActionCommand, DOMElement } from '@sih26171/protocol';
import {
  classifyActionRisk,
  evaluateLocalPolicy,
  requiresConfirmation,
} from '../risk.js';
import {
  computeTargetFingerprint,
  validateTargetFingerprint,
} from '../fingerprint.js';
import {
  createApprovalBinding,
  transitionApprovalState,
} from '../approval.js';

describe('Workstream 1 & 2: Policy Engine & Approval State Machine', () => {
  const dummyTarget: DOMElement = {
    id: 'download-report',
    tag: 'button',
    role: 'button',
    text: 'Download Report',
    aria_label: 'Download Report',
    input_type: null,
    value_state: 'empty',
    disabled: false,
    visible: true,
    bbox: { x: 0.1, y: 0.2, w: 0.15, h: 0.05 },
    attributes: { autocomplete: null, data_agent_id: 'download-report' },
  };

  const harmlessButton: DOMElement = {
    id: 'view-tab-1',
    tag: 'button',
    role: 'tab',
    text: 'Overview',
    aria_label: 'Overview Tab',
    input_type: null,
    value_state: 'empty',
    disabled: false,
    visible: true,
    bbox: { x: 0.05, y: 0.05, w: 0.1, h: 0.04 },
    attributes: { autocomplete: null, data_agent_id: 'view-tab-1' },
  };

  describe('Risk Classification Rules', () => {
    it('classifies observe, wait, and scroll as LOW risk', () => {
      const observeCmd: ActionCommand = {
        type: 'observe',
        target: { element_id: 'none', bbox: { x: 0, y: 0, w: 0, h: 0 }, selector_hint: '', text_hint: '' },
        arguments: {},
        confidence: 1.0,
        requires_confirmation: false,
      };
      expect(classifyActionRisk(observeCmd).riskLevel).toBe('LOW');

      const scrollCmd: ActionCommand = {
        ...observeCmd,
        type: 'scroll',
        arguments: { delta_y: 0.5 },
      };
      expect(classifyActionRisk(scrollCmd).riskLevel).toBe('LOW');

      const waitCmd: ActionCommand = {
        ...observeCmd,
        type: 'wait',
        arguments: { ms: 1000 },
      };
      expect(classifyActionRisk(waitCmd).riskLevel).toBe('LOW');
    });

    it('classifies ordinary clicks on non-consequential elements as MEDIUM risk', () => {
      const clickCmd: ActionCommand = {
        type: 'click',
        target: { element_id: 'view-tab-1', bbox: harmlessButton.bbox, selector_hint: '#view-tab-1', text_hint: 'Overview' },
        arguments: {},
        confidence: 0.9,
        requires_confirmation: false,
      };
      expect(classifyActionRisk(clickCmd, harmlessButton).riskLevel).toBe('MEDIUM');
    });

    it('classifies download, export, submit, and financial actions as HIGH risk', () => {
      const downloadCmd: ActionCommand = {
        type: 'click',
        target: { element_id: 'download-report', bbox: dummyTarget.bbox, selector_hint: '#download-report', text_hint: 'Download Report' },
        arguments: {},
        confidence: 0.95,
        requires_confirmation: true,
      };
      expect(classifyActionRisk(downloadCmd, dummyTarget).riskLevel).toBe('HIGH');

      const submitCmd: ActionCommand = {
        type: 'submit',
        target: { element_id: 'form-1', bbox: { x: 0, y: 0, w: 0.1, h: 0.05 }, selector_hint: '#form-1', text_hint: 'Submit Form' },
        arguments: {},
        confidence: 0.9,
        requires_confirmation: false,
      };
      expect(classifyActionRisk(submitCmd).riskLevel).toBe('HIGH');
    });

    it('blocks arbitrary script execution and privileged commands (BLOCKED)', () => {
      const jsCmd: ActionCommand = {
        type: 'execute_javascript' as any,
        target: { element_id: 'none', bbox: { x: 0, y: 0, w: 0, h: 0 }, selector_hint: '', text_hint: '' },
        arguments: { code: 'document.cookie' },
        confidence: 1.0,
        requires_confirmation: false,
      };
      const res = classifyActionRisk(jsCmd);
      expect(res.riskLevel).toBe('BLOCKED');
      expect(res.isBlocked).toBe(true);
    });

    it('blocks typing into password fields', () => {
      const passwordEl: DOMElement = {
        ...dummyTarget,
        id: 'user-pass',
        input_type: 'password',
        text: '',
      };
      const typePassCmd: ActionCommand = {
        type: 'type',
        target: { element_id: 'user-pass', bbox: passwordEl.bbox, selector_hint: '#user-pass', text_hint: '' },
        arguments: { text: 'Secret123!' },
        confidence: 0.95,
        requires_confirmation: false,
      };
      const res = classifyActionRisk(typePassCmd, passwordEl);
      expect(res.riskLevel).toBe('BLOCKED');
      expect(res.isBlocked).toBe(true);
    });

    it('blocks actions targeting hidden or aria-hidden DOM nodes', () => {
      const hiddenEl: DOMElement = {
        ...dummyTarget,
        visible: false,
      };
      const clickHidden: ActionCommand = {
        type: 'click',
        target: { element_id: 'download-report', bbox: dummyTarget.bbox, selector_hint: '#download-report', text_hint: 'Download' },
        arguments: {},
        confidence: 0.95,
        requires_confirmation: false,
      };
      const res = classifyActionRisk(clickHidden, hiddenEl);
      expect(res.riskLevel).toBe('BLOCKED');
      expect(res.isBlocked).toBe(true);
    });

    it('blocks actions containing secret credentials in arguments', () => {
      const leakCmd: ActionCommand = {
        type: 'type',
        target: { element_id: 'search-input', bbox: dummyTarget.bbox, selector_hint: '#search', text_hint: 'Search' },
        arguments: { text: 'my_password_value', auth_token: 'xyz-secret' },
        confidence: 0.9,
        requires_confirmation: false,
      };
      const res = classifyActionRisk(leakCmd);
      expect(res.riskLevel).toBe('BLOCKED');
      expect(res.isBlocked).toBe(true);
    });

    it('defaults unknown action types to HIGH risk', () => {
      const unknownCmd: ActionCommand = {
        type: 'custom_mutating_action' as any,
        target: { element_id: 'btn-1', bbox: dummyTarget.bbox, selector_hint: '#btn-1', text_hint: 'Custom' },
        arguments: {},
        confidence: 0.8,
        requires_confirmation: false,
      };
      expect(classifyActionRisk(unknownCmd).riskLevel).toBe('HIGH');
    });
  });

  describe('Local Policy Gating & Invariants', () => {
    it('prevents server response from downgrading local risk or bypassing approval', () => {
      const downloadCmd: ActionCommand = {
        type: 'click',
        target: { element_id: 'download-report', bbox: dummyTarget.bbox, selector_hint: '#download-report', text_hint: 'Download Report' },
        arguments: {},
        confidence: 0.95,
        requires_confirmation: false, // Server claims confirmation is NOT required!
      };

      const evalResult = evaluateLocalPolicy(downloadCmd, dummyTarget);
      // Local policy overrides server claim!
      expect(evalResult.riskLevel).toBe('HIGH');
      expect(evalResult.requiresApproval).toBe(true);
      expect(evalResult.allowed).toBe(true);
    });

    it('requires confirmation for HIGH and CRITICAL actions', () => {
      expect(requiresConfirmation('HIGH')).toBe(true);
      expect(requiresConfirmation('CRITICAL')).toBe(true);
      expect(requiresConfirmation('LOW')).toBe(false);
      expect(requiresConfirmation('BLOCKED')).toBe(false); // Blocked is outright rejected
    });
  });

  describe('Target Fingerprint Computation and Validation', () => {
    it('computes deterministic fingerprint strings', () => {
      const fp1 = computeTargetFingerprint(dummyTarget);
      const fp2 = computeTargetFingerprint({
        element_id: 'download-report',
        tag: 'button',
        role: 'button',
        text_hint: 'Download Report',
        selector_hint: '',
        bbox: dummyTarget.bbox,
      });
      expect(fp1).toContain('download-report');
      expect(validateTargetFingerprint(fp1, dummyTarget)).toBe(true);
      expect(validateTargetFingerprint(fp1, fp2 as any)).toBe(true);
    });

    it('rejects fingerprint mismatch when target element changes', () => {
      const fp1 = computeTargetFingerprint(dummyTarget);
      expect(validateTargetFingerprint(fp1, harmlessButton)).toBe(false);
    });
  });

  describe('Formal Approval State Machine', () => {
    const sessionToken = 'trusted-session-secret-999';

    const highRiskCmd: ActionCommand = {
      type: 'click',
      target: { element_id: 'download-report', bbox: dummyTarget.bbox, selector_hint: '#download-report', text_hint: 'Download Report' },
      arguments: {},
      confidence: 0.95,
      requires_confirmation: true,
    };

    it('transitions directly to APPROVED for LOW risk actions without confirmation', () => {
      const lowRiskCmd: ActionCommand = {
        type: 'observe',
        target: { element_id: 'none', bbox: { x: 0, y: 0, w: 0, h: 0 }, selector_hint: '', text_hint: '' },
        arguments: {},
        confidence: 1.0,
        requires_confirmation: false,
      };

      const binding = createApprovalBinding({
        commandId: 'cmd-1',
        action: lowRiskCmd,
        riskLevel: 'LOW',
        tabId: 101,
        trustedSessionToken: sessionToken,
      });

      expect(binding.state).toBe('APPROVED');
    });

    it('transitions to PENDING for HIGH risk actions', () => {
      const binding = createApprovalBinding({
        commandId: 'cmd-download-1',
        action: highRiskCmd,
        riskLevel: 'HIGH',
        tabId: 101,
        targetElement: dummyTarget,
        trustedSessionToken: sessionToken,
      });

      expect(binding.state).toBe('PENDING');
    });

    it('transitions PENDING -> APPROVED on trusted matching approval message', () => {
      const binding = createApprovalBinding({
        commandId: 'cmd-download-1',
        action: highRiskCmd,
        riskLevel: 'HIGH',
        tabId: 101,
        targetElement: dummyTarget,
        trustedSessionToken: sessionToken,
      });

      const result = transitionApprovalState(binding, {
        type: 'SUBMIT_APPROVAL',
        message: {
          commandId: 'cmd-download-1',
          targetFingerprint: binding.targetFingerprint,
          tabId: 101,
          confirmed: true,
          trustedSessionToken: sessionToken,
        },
      });

      expect(result.success).toBe(true);
      expect(result.nextState).toBe('APPROVED');
      expect(binding.state).toBe('APPROVED');
      expect(binding.approvedAt).toBeDefined();
    });

    it('transitions PENDING -> CANCELLED when user cancels', () => {
      const binding = createApprovalBinding({
        commandId: 'cmd-download-2',
        action: highRiskCmd,
        riskLevel: 'HIGH',
        tabId: 101,
        targetElement: dummyTarget,
        trustedSessionToken: sessionToken,
      });

      const result = transitionApprovalState(binding, {
        type: 'CANCEL',
        reason: 'User clicked cancel in side panel',
      });

      expect(result.success).toBe(true);
      expect(result.nextState).toBe('CANCELLED');
      expect(binding.state).toBe('CANCELLED');
    });

    it('rejects forged approval message with invalid session token', () => {
      const binding = createApprovalBinding({
        commandId: 'cmd-download-3',
        action: highRiskCmd,
        riskLevel: 'HIGH',
        tabId: 101,
        targetElement: dummyTarget,
        trustedSessionToken: sessionToken,
      });

      const result = transitionApprovalState(binding, {
        type: 'SUBMIT_APPROVAL',
        message: {
          commandId: 'cmd-download-3',
          targetFingerprint: binding.targetFingerprint,
          tabId: 101,
          confirmed: true,
          trustedSessionToken: 'FORGED_TOKEN_123',
        },
      });

      expect(result.success).toBe(false);
      expect(result.nextState).toBe('REJECTED');
      expect(binding.state).toBe('REJECTED');
    });

    it('rejects approval message for a different commandId', () => {
      const binding = createApprovalBinding({
        commandId: 'cmd-correct-id',
        action: highRiskCmd,
        riskLevel: 'HIGH',
        tabId: 101,
        targetElement: dummyTarget,
        trustedSessionToken: sessionToken,
      });

      const result = transitionApprovalState(binding, {
        type: 'SUBMIT_APPROVAL',
        message: {
          commandId: 'cmd-WRONG-id',
          targetFingerprint: binding.targetFingerprint,
          tabId: 101,
          confirmed: true,
          trustedSessionToken: sessionToken,
        },
      });

      expect(result.success).toBe(false);
      expect(result.nextState).toBe('REJECTED');
    });

    it('rejects approval message from a different tabId', () => {
      const binding = createApprovalBinding({
        commandId: 'cmd-tab-test',
        action: highRiskCmd,
        riskLevel: 'HIGH',
        tabId: 101,
        targetElement: dummyTarget,
        trustedSessionToken: sessionToken,
      });

      const result = transitionApprovalState(binding, {
        type: 'SUBMIT_APPROVAL',
        message: {
          commandId: 'cmd-tab-test',
          targetFingerprint: binding.targetFingerprint,
          tabId: 999, // Different tab!
          confirmed: true,
          trustedSessionToken: sessionToken,
        },
      });

      expect(result.success).toBe(false);
      expect(result.nextState).toBe('REJECTED');
    });

    it('rejects expired approvals', () => {
      const binding = createApprovalBinding({
        commandId: 'cmd-expired',
        action: highRiskCmd,
        riskLevel: 'HIGH',
        tabId: 101,
        targetElement: dummyTarget,
        trustedSessionToken: sessionToken,
        expirationMs: -1000, // already expired
      });

      const result = transitionApprovalState(binding, {
        type: 'SUBMIT_APPROVAL',
        message: {
          commandId: 'cmd-expired',
          targetFingerprint: binding.targetFingerprint,
          tabId: 101,
          confirmed: true,
          trustedSessionToken: sessionToken,
        },
      });

      expect(result.success).toBe(false);
      expect(result.nextState).toBe('REJECTED');
    });

    it('requires target revalidation before execution and rejects if target mutated', () => {
      const binding = createApprovalBinding({
        commandId: 'cmd-revalidate-test',
        action: highRiskCmd,
        riskLevel: 'HIGH',
        tabId: 101,
        targetElement: dummyTarget,
        trustedSessionToken: sessionToken,
      });

      // Approve it first
      transitionApprovalState(binding, {
        type: 'SUBMIT_APPROVAL',
        message: {
          commandId: 'cmd-revalidate-test',
          targetFingerprint: binding.targetFingerprint,
          tabId: 101,
          confirmed: true,
          trustedSessionToken: sessionToken,
        },
      });
      expect(binding.state).toBe('APPROVED');

      // Revalidate with valid target -> Success
      const validReval = transitionApprovalState(binding, {
        type: 'EXECUTION_REVALIDATE',
        currentTarget: dummyTarget,
      });
      expect(validReval.success).toBe(true);
      expect(validReval.nextState).toBe('APPROVED');

      // Now simulate target mutating into something else
      const mutatedTarget: DOMElement = {
        ...dummyTarget,
        id: 'malicious-injected-button',
        text: 'Transfer All Funds',
      };

      const mutatedReval = transitionApprovalState(binding, {
        type: 'EXECUTION_REVALIDATE',
        currentTarget: mutatedTarget,
      });
      expect(mutatedReval.success).toBe(false);
      expect(mutatedReval.nextState).toBe('REJECTED');
      expect(binding.state).toBe('REJECTED');
    });

    it('enforces terminal state: CANCELLED or REJECTED cannot transition back to APPROVED', () => {
      const binding = createApprovalBinding({
        commandId: 'cmd-terminal-test',
        action: highRiskCmd,
        riskLevel: 'HIGH',
        tabId: 101,
        targetElement: dummyTarget,
        trustedSessionToken: sessionToken,
      });

      // Cancel it
      transitionApprovalState(binding, { type: 'CANCEL' });
      expect(binding.state).toBe('CANCELLED');

      // Attempt to force transition to APPROVED
      const illegalTransition = transitionApprovalState(binding, {
        type: 'SUBMIT_APPROVAL',
        message: {
          commandId: 'cmd-terminal-test',
          targetFingerprint: binding.targetFingerprint,
          tabId: 101,
          confirmed: true,
          trustedSessionToken: sessionToken,
        },
      });

      expect(illegalTransition.success).toBe(false);
      expect(binding.state).toBe('CANCELLED');
    });
  });
});
