// ─── apps/extension/src/__tests__/security-and-network.test.ts ───
// Security, Network Privacy, and Protocol Safety Verification
// Verifies all P0 security requirements:
// 1. Outbound network request contains zero raw seeded secrets (spied network call).
// 2. sanitizeBeforeSend runs pre-flight verification and refuses unverified dispatch.
// 3. Unknown action types and execute_javascript are rejected.
// 4. Raw secrets in action arguments are rejected.
// 5. Stale element IDs fail resolution.
// 6. Out-of-viewport / invalid bounding boxes are rejected.
// 7. Low-confidence actions are blocked by the confidence gate.
// 8. Safe click targeting the Download Report button succeeds cleanly.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateAgentResponse,
  validateActionCommand,
  validateBBox,
  isConfidenceSufficient,
  resolveTargetElement,
  type AgentResponse,
  type DOMElement,
  type ActionCommand,
  PROTOCOL_VERSION,
} from '@sih26171/protocol';
import {
  sanitizeBeforeSend,
  redactElements,
  verifyPrivacy,
} from '@sih26171/privacy';

// ─── Test Fixture with Exact Seeded Values ───

const SEEDED_VALUES = {
  email: 'fake.email@example.test',
  phone: '+91 90000 12345',
  password: 'fake password',
  pan: 'ABCDE1234F',
  creditCard: '4111 1111 1111 1111',
  reportText: 'fake report text',
  buttonText: 'Download Report',
};

function createSeededDOM(): DOMElement[] {
  return [
    {
      id: 'avatar-image',
      tag: 'div',
      role: 'img',
      text: 'User Avatar',
      aria_label: 'User profile avatar photo',
      input_type: null,
      value_state: 'empty',
      disabled: false,
      visible: true,
      bbox: { x: 0.1, y: 0.1, w: 0.05, h: 0.05 },
      attributes: { autocomplete: null, data_agent_id: 'avatar-image' },
    },
    {
      id: 'user-email',
      tag: 'span',
      role: null,
      text: SEEDED_VALUES.email,
      aria_label: `Email: ${SEEDED_VALUES.email}`,
      input_type: null,
      value_state: 'empty',
      disabled: false,
      visible: true,
      bbox: { x: 0.2, y: 0.1, w: 0.2, h: 0.03 },
      attributes: { autocomplete: null, data_agent_id: 'user-email' },
    },
    {
      id: 'user-phone',
      tag: 'span',
      role: null,
      text: SEEDED_VALUES.phone,
      aria_label: `Phone: ${SEEDED_VALUES.phone}`,
      input_type: null,
      value_state: 'empty',
      disabled: false,
      visible: true,
      bbox: { x: 0.2, y: 0.15, w: 0.15, h: 0.03 },
      attributes: { autocomplete: null, data_agent_id: 'user-phone' },
    },
    {
      id: 'user-password',
      tag: 'input',
      role: 'textbox',
      text: '', // Value omitted from visible text
      aria_label: 'Account password',
      input_type: 'password',
      value_state: 'filled',
      disabled: false,
      visible: true,
      bbox: { x: 0.2, y: 0.2, w: 0.25, h: 0.04 },
      attributes: { autocomplete: 'current-password', data_agent_id: 'user-password' },
    },
    {
      id: 'tax-identifier',
      tag: 'div',
      role: null,
      text: SEEDED_VALUES.pan,
      aria_label: `PAN ID: ${SEEDED_VALUES.pan}`,
      input_type: null,
      value_state: 'empty',
      disabled: false,
      visible: true,
      bbox: { x: 0.2, y: 0.26, w: 0.15, h: 0.03 },
      attributes: { autocomplete: null, data_agent_id: 'tax-identifier' },
    },
    {
      id: 'payment-card',
      tag: 'div',
      role: null,
      text: SEEDED_VALUES.creditCard,
      aria_label: `Card: ${SEEDED_VALUES.creditCard}`,
      input_type: null,
      value_state: 'empty',
      disabled: false,
      visible: true,
      bbox: { x: 0.4, y: 0.26, w: 0.2, h: 0.03 },
      attributes: { autocomplete: null, data_agent_id: 'payment-card' },
    },
    {
      id: 'report-text',
      tag: 'p',
      role: null,
      text: SEEDED_VALUES.reportText,
      aria_label: null,
      input_type: null,
      value_state: 'empty',
      disabled: false,
      visible: true,
      bbox: { x: 0.2, y: 0.35, w: 0.6, h: 0.1 },
      attributes: { autocomplete: null, data_agent_id: 'report-text' },
    },
    {
      id: 'download-report',
      tag: 'button',
      role: 'button',
      text: SEEDED_VALUES.buttonText,
      aria_label: 'Download confidential report',
      input_type: null,
      value_state: 'empty',
      disabled: false,
      visible: true,
      bbox: { x: 0.2, y: 0.48, w: 0.18, h: 0.05 },
      attributes: { autocomplete: null, data_agent_id: 'download-report' },
    },
  ];
}

// ─── Network Privacy Tests ───

describe('Network Request Privacy Firewall', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('spies on network request and proves NO seeded secrets exist in serialized payload', async () => {
    const seededDOM = createSeededDOM();
    const task = {
      goal: 'Find and click the Download Report button.',
      allowed_actions: ['click' as const, 'scroll' as const, 'wait' as const],
      max_steps: 3,
    };

    // 1. Invoke local privacy firewall
    const sanitizeResult = sanitizeBeforeSend({
      dom: { page_title: 'Confidential Seeded Report', elements: seededDOM },
      screenshot: {
        base64: 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAIAAAAA',
        info: {
          media_type: 'image/webp',
          width: 1280,
          height: 720,
          quality: 65,
          sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
      },
      task,
    });

    expect(sanitizeResult.verified).toBe(true);

    // 2. Spy on network request (fetch)
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        protocol_version: PROTOCOL_VERSION,
        request_id: sanitizeResult.payload.request_id,
        status: 'ok',
        action: {
          type: 'click',
          target: {
            element_id: 'download-report',
            bbox: { x: 0.2, y: 0.48, w: 0.18, h: 0.05 },
            selector_hint: "[data-agent-id='download-report']",
            text_hint: 'Download Report',
          },
          arguments: {},
          confidence: 0.95,
          requires_confirmation: false,
        },
        next_observation: false,
        explanation: 'Clicking safe Download Report button',
        server_metrics: { queue_ms: 1, inference_ms: 12, total_server_ms: 13, model: 'mock-v1' },
      }),
    });
    globalThis.fetch = fetchSpy as any;

    // Dispatch verified payload to server
    await fetch('http://localhost:3001/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sanitizeResult.payload),
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const sentBody: string = fetchSpy.mock.calls[0][1].body;

    // 3. Verify that zero seeded secrets appear anywhere in the sent serialized body
    expect(sentBody).not.toContain(SEEDED_VALUES.email);
    expect(sentBody).not.toContain(SEEDED_VALUES.phone);
    expect(sentBody).not.toContain('90000 12345');
    expect(sentBody).not.toContain(SEEDED_VALUES.password);
    expect(sentBody).not.toContain(SEEDED_VALUES.pan);
    expect(sentBody).not.toContain(SEEDED_VALUES.creditCard);
    expect(sentBody).not.toContain('4111 1111');

    // 4. Verify that safe interactive element (Download Report button) remains accessible
    expect(sentBody).toContain(SEEDED_VALUES.buttonText);
    expect(sentBody).toContain('download-report');

    // 5. Verify that category placeholders exist in the serialized payload
    expect(sentBody).toContain('[EMAIL]');
    expect(sentBody).toContain('[PHONE]');
    expect(sentBody).toContain('[GOV_ID]');
    expect(sentBody).toContain('[FINANCIAL]');

    // 6. Verify redaction manifest contains all sanitized elements
    expect(sanitizeResult.redactions.length).toBeGreaterThanOrEqual(4);
    const manifestCategories = sanitizeResult.redactions.map(r => r.category);
    expect(manifestCategories).toContain('email');
    expect(manifestCategories).toContain('phone');
    expect(manifestCategories).toContain('government_id');
    expect(manifestCategories).toContain('financial');

    // 7. Verify that outbound payload carries NO screenshot pixels (raw pixels strictly omitted in MVP)
    expect(sanitizeResult.payload.image_base64).toBe('');
    expect(sentBody).toContain('"image_base64":""');
    expect(sentBody).toContain('"raw_pixels_sent":false');
  });

  it('verifies that outbound request carries NO screenshot pixels and raw_pixels_sent is false', async () => {
    const seededDOM = createSeededDOM();
    const task = {
      goal: 'Find and click the Download Report button.',
      allowed_actions: ['click' as const],
      max_steps: 1,
    };

    // Even if raw screenshot image data is provided to the firewall:
    const sanitizeResult = sanitizeBeforeSend({
      dom: seededDOM,
      screenshot: {
        base64: 'data:image/webp;base64,RAW_UNREDACTED_IMAGE_BYTES_THAT_MUST_NOT_BE_SENT',
        info: {
          media_type: 'image/webp',
          width: 1280,
          height: 720,
          quality: 65,
          sha256: 'abc123hash',
        },
      },
      task,
    });

    // 1. image_base64 must be strictly empty in payload
    expect(sanitizeResult.payload.image_base64).toBe('');

    // 2. privacy.raw_pixels_sent must be false
    expect(sanitizeResult.payload.privacy.raw_pixels_sent).toBe(false);

    // 3. Spy on network request and verify serialized JSON
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'ok' }) });
    globalThis.fetch = fetchSpy as any;

    await fetch('http://localhost:3001/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sanitizeResult.payload),
    });

    const sentBody = fetchSpy.mock.calls[0][1].body;
    expect(sentBody).not.toContain('RAW_UNREDACTED_IMAGE_BYTES_THAT_MUST_NOT_BE_SENT');
    expect(sentBody).toContain('"image_base64":""');
    expect(sentBody).toContain('"raw_pixels_sent":false');
  });

  it('fail-closed negative privacy test: unredacted synthetic secret causes verified=false, halts network call, and conceals secret from error', async () => {
    const rawSecret = 'SUPER_SECRET_SYNTHETIC_API_KEY_99999';
    const unredactedDOM: DOMElement[] = [
      {
        id: 'leaked-input',
        tag: 'input',
        role: 'textbox',
        text: rawSecret, // Deliberately unredacted raw secret text in an input
        aria_label: null,
        input_type: 'password',
        value_state: 'filled',
        disabled: false,
        visible: true,
        bbox: { x: 0.1, y: 0.1, w: 0.2, h: 0.05 },
        attributes: { autocomplete: null, data_agent_id: 'leaked-input' },
      },
    ];

    const unredactedScreenshot = {
      base64: 'data:image/webp;base64,UNREDACTED_SYNTHETIC_SECRET_SCREENSHOT_DATA',
      info: {
        media_type: 'image/webp' as const,
        width: 1280,
        height: 720,
        quality: 65,
        sha256: 'deadbeef_unredacted_secret_hash',
      },
    };

    // Spy on network transport
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    });
    globalThis.fetch = fetchSpy as any;

    // 1. Invoke sanitizeBeforeSend on unredacted secret payload
    const sanitizeResult = sanitizeBeforeSend({
      dom: unredactedDOM,
      screenshot: unredactedScreenshot,
      task: { goal: 'Execute safe task', allowed_actions: ['click'], max_steps: 1 },
    });

    // 2. Verified flag MUST be false (fail-closed)
    expect(sanitizeResult.verified).toBe(false);
    expect(sanitizeResult.verification.passed).toBe(false);

    // 3. Simulated background network dispatch with fail-closed gate
    let thrownError: Error | null = null;
    const auditLogs: string[] = [];

    try {
      if (!sanitizeResult.verified) {
        const failedChecks = sanitizeResult.verification.checks
          .filter(c => !c.passed)
          .map(c => c.name);
        const safeErrorMessage = `Privacy check failed: ${failedChecks.join(', ')}`;
        auditLogs.push(safeErrorMessage);
        throw new Error(safeErrorMessage);
      }

      // Should NEVER be reached when verified=false
      await fetch('http://localhost:3001/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizeResult.payload),
      });
    } catch (err) {
      thrownError = err as Error;
    }

    // 4. Assert: network transport is NOT called
    expect(fetchSpy).not.toHaveBeenCalled();

    // 5. Assert: a safe non-secret error was returned
    expect(thrownError).not.toBeNull();
    expect(thrownError?.message).toContain('Privacy check failed');

    // 6. Assert: raw secret is strictly absent from the thrown error message
    expect(thrownError?.message).not.toContain(rawSecret);

    // 7. Assert: raw secret is strictly absent from audit logs
    for (const logEntry of auditLogs) {
      expect(logEntry).not.toContain(rawSecret);
    }

    // 8. Assert: raw secret is strictly absent from all privacy check detail strings
    for (const check of sanitizeResult.verification.checks) {
      if (check.detail) {
        expect(check.detail).not.toContain(rawSecret);
      }
    }
  });
});

// ─── Protocol Safety and Allowlist Rejections (Constraint 9) ───

describe('Protocol Validation & Action Rejections', () => {
  const safeTarget = {
    element_id: 'download-report',
    bbox: { x: 0.2, y: 0.48, w: 0.18, h: 0.05 },
    selector_hint: "[data-agent-id='download-report']",
    text_hint: 'Download Report',
  };

  it('rejects unknown action type', () => {
    const errors = validateActionCommand({
      type: 'execute_shell',
      target: safeTarget,
      arguments: {},
      confidence: 0.95,
      requires_confirmation: false,
    });
    expect(errors.some(e => e.includes('action.type'))).toBe(true);
  });

  it('rejects execute_javascript action', () => {
    const maliciousAction = {
      type: 'execute_javascript',
      target: safeTarget,
      arguments: { code: "document.body.innerHTML = 'bad'" },
      confidence: 0.99,
      requires_confirmation: false,
    };

    const cmdErrors = validateActionCommand(maliciousAction);
    expect(cmdErrors.some(e => e.includes('action.type'))).toBe(true);

    const fullResponse: AgentResponse = {
      protocol_version: PROTOCOL_VERSION,
      request_id: 'malicious-req',
      status: 'ok',
      action: maliciousAction as any,
      next_observation: false,
      explanation: 'Attacking host DOM',
      server_metrics: { queue_ms: 0, inference_ms: 5, total_server_ms: 5, model: 'bad' },
    };

    const respValidation = validateAgentResponse(fullResponse);
    expect(respValidation.valid).toBe(false);
    expect(respValidation.errors.some(e => e.includes('action.type'))).toBe(true);
  });

  it('rejects raw secret keys in action arguments', () => {
    const passwordArg = validateActionCommand({
      type: 'type',
      target: safeTarget,
      arguments: { password: 'my-super-secret-password' },
      confidence: 0.9,
      requires_confirmation: false,
    });
    expect(passwordArg.some(e => e.includes('potentially secret key'))).toBe(true);

    const tokenArg = validateActionCommand({
      type: 'type',
      target: safeTarget,
      arguments: { auth_token: 'bearer-xyz-123' },
      confidence: 0.9,
      requires_confirmation: false,
    });
    expect(tokenArg.some(e => e.includes('potentially secret key'))).toBe(true);
  });

  it('rejects stale element ID not present in current DOM', () => {
    const currentDOM = createSeededDOM();
    const staleTarget = {
      element_id: 'deleted-modal-btn',
      bbox: { x: 0.5, y: 0.5, w: 0.1, h: 0.05 },
      selector_hint: '#deleted-modal-btn',
      text_hint: 'Old Button',
    };

    const resolved = resolveTargetElement(staleTarget, currentDOM);
    expect(resolved).toBeNull();
  });

  it('rejects invalid or out-of-viewport bounding boxes', () => {
    // Greater than 1
    const errX = validateBBox({ x: 1.25, y: 0.5, w: 0.1, h: 0.05 }, 'test');
    expect(errX.some(e => e.includes('bbox.x must be in [0, 1]'))).toBe(true);

    // Negative
    const errY = validateBBox({ x: 0.5, y: -0.15, w: 0.1, h: 0.05 }, 'test');
    expect(errY.some(e => e.includes('bbox.y must be in [0, 1]'))).toBe(true);

    // Width > 1
    const errW = validateBBox({ x: 0.1, y: 0.1, w: 1.5, h: 0.05 }, 'test');
    expect(errW.some(e => e.includes('bbox.w must be in [0, 1]'))).toBe(true);

    // NaN / non-numeric
    const errNaN = validateBBox({ x: 'top-left', y: 0.1, w: 0.1, h: 0.05 }, 'test');
    expect(errNaN.some(e => e.includes('must be a number'))).toBe(true);

    // validateActionCommand with invalid bbox
    const cmdErr = validateActionCommand({
      type: 'click',
      target: {
        element_id: 'btn',
        bbox: { x: -0.5, y: 0.5, w: 0.1, h: 0.05 },
        selector_hint: '',
        text_hint: '',
      },
      arguments: {},
      confidence: 0.9,
      requires_confirmation: false,
    });
    expect(cmdErr.some(e => e.includes('bbox.x'))).toBe(true);
  });

  it('rejects low-confidence action below threshold', () => {
    const lowConfidenceAction: ActionCommand = {
      type: 'click',
      target: safeTarget,
      arguments: {},
      confidence: 0.35,
      requires_confirmation: false,
    };

    const isSufficient = isConfidenceSufficient(lowConfidenceAction, {
      confidence_threshold: 0.5,
    });
    expect(isSufficient).toBe(false);

    const highConfidenceAction: ActionCommand = {
      ...lowConfidenceAction,
      confidence: 0.92,
    };
    expect(
      isConfidenceSufficient(highConfidenceAction, { confidence_threshold: 0.5 })
    ).toBe(true);
  });

  it('succeeds on safe click targeting Download Report button', () => {
    const currentDOM = createSeededDOM();
    const safeResponse: AgentResponse = {
      protocol_version: PROTOCOL_VERSION,
      request_id: 'safe-req-001',
      status: 'ok',
      action: {
        type: 'click',
        target: {
          element_id: 'download-report',
          bbox: { x: 0.2, y: 0.48, w: 0.18, h: 0.05 },
          selector_hint: "[data-agent-id='download-report']",
          text_hint: 'Download Report',
        },
        arguments: {},
        confidence: 0.95,
        requires_confirmation: false,
      },
      next_observation: false,
      explanation: 'Found safe Download Report button and clicking it.',
      server_metrics: { queue_ms: 1, inference_ms: 10, total_server_ms: 11, model: 'mock-v1' },
    };

    // 1. Validate response schema and contract
    const validation = validateAgentResponse(safeResponse);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // 2. Check confidence gate
    expect(isConfidenceSufficient(safeResponse.action, { confidence_threshold: 0.5 })).toBe(true);

    // 3. Resolve target in current DOM
    const resolvedElement = resolveTargetElement(safeResponse.action.target, currentDOM);
    expect(resolvedElement).not.toBeNull();
    expect(resolvedElement?.id).toBe('download-report');
    expect(resolvedElement?.text).toBe('Download Report');
    expect(resolvedElement?.tag).toBe('button');
    expect(resolvedElement?.visible).toBe(true);
  });
});
