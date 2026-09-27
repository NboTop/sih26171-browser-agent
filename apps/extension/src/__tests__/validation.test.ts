// ─── apps/extension/src/__tests__/validation.test.ts ───
// Unit tests for protocol validation and command safety checks.

import { describe, it, expect } from 'vitest';
import {
  validateAgentResponse,
  validateBBox,
  validateActionCommand,
  isConfidenceSufficient,
  requiresConfirmation,
  resolveTargetElement,
  isBBoxStale,
  PROTOCOL_VERSION,
  ALLOWED_ACTION_TYPES,
  type ActionCommand,
  type AgentResponse,
  type DOMElement,
  type ExtensionConfig,
  DEFAULT_CONFIG,
} from '@sih26171/protocol';

// ─── Helpers ───

function makeValidResponse(overrides: Partial<AgentResponse> = {}): AgentResponse {
  return {
    protocol_version: PROTOCOL_VERSION,
    request_id: 'test-uuid-123',
    status: 'ok',
    action: {
      type: 'click',
      target: {
        element_id: 'e_001',
        bbox: { x: 0.5, y: 0.5, w: 0.1, h: 0.05 },
        selector_hint: "[data-agent-id='e_001']",
        text_hint: 'Click me',
      },
      arguments: {},
      confidence: 0.88,
      requires_confirmation: false,
    },
    next_observation: false,
    explanation: 'Test action',
    server_metrics: {
      queue_ms: 0,
      inference_ms: 10,
      total_server_ms: 10,
      model: 'test',
    },
    ...overrides,
  };
}

function makeDOMElement(overrides: Partial<DOMElement> = {}): DOMElement {
  return {
    id: 'e_001',
    tag: 'button',
    role: 'button',
    text: 'Download',
    aria_label: 'Download invoice',
    input_type: null,
    value_state: 'empty',
    disabled: false,
    visible: true,
    bbox: { x: 0.5, y: 0.5, w: 0.1, h: 0.05 },
    attributes: {
      autocomplete: null,
      data_agent_id: 'e_001',
    },
    ...overrides,
  };
}

// ─── BBox Validation ───

describe('validateBBox', () => {
  it('accepts valid bbox', () => {
    const errors = validateBBox({ x: 0.5, y: 0.5, w: 0.1, h: 0.05 }, 'test');
    expect(errors).toHaveLength(0);
  });

  it('accepts boundary values', () => {
    const errors = validateBBox({ x: 0, y: 0, w: 1, h: 1 }, 'test');
    expect(errors).toHaveLength(0);
  });

  it('rejects out-of-range values', () => {
    const errors = validateBBox({ x: 1.5, y: -0.1, w: 0.5, h: 0.5 }, 'test');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects non-numeric values', () => {
    const errors = validateBBox({ x: 'a', y: 0, w: 0, h: 0 }, 'test');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects non-object', () => {
    const errors = validateBBox(null, 'test');
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ─── Action Command Validation ───

describe('validateActionCommand', () => {
  it('accepts valid click action', () => {
    const errors = validateActionCommand({
      type: 'click',
      target: {
        element_id: 'e_001',
        bbox: { x: 0.5, y: 0.5, w: 0.1, h: 0.05 },
        selector_hint: "[data-agent-id='e_001']",
        text_hint: 'Click me',
      },
      arguments: {},
      confidence: 0.88,
      requires_confirmation: false,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects unknown action type', () => {
    const errors = validateActionCommand({
      type: 'hack_computer',
      target: {
        element_id: 'e_001',
        bbox: { x: 0.5, y: 0.5, w: 0.1, h: 0.05 },
        selector_hint: '',
        text_hint: '',
      },
      arguments: {},
      confidence: 0.5,
      requires_confirmation: false,
    });
    expect(errors.some(e => e.includes('action.type'))).toBe(true);
  });

  it('rejects secret keys in arguments', () => {
    const errors = validateActionCommand({
      type: 'type',
      target: {
        element_id: 'e_001',
        bbox: { x: 0.5, y: 0.5, w: 0.1, h: 0.05 },
        selector_hint: '',
        text_hint: '',
      },
      arguments: { password: 'secret123' },
      confidence: 0.9,
      requires_confirmation: false,
    });
    expect(errors.some(e => e.includes('secret'))).toBe(true);
  });

  it('rejects confidence outside [0, 1]', () => {
    const errors = validateActionCommand({
      type: 'click',
      target: {
        element_id: 'e_001',
        bbox: { x: 0.5, y: 0.5, w: 0.1, h: 0.05 },
        selector_hint: '',
        text_hint: '',
      },
      arguments: {},
      confidence: 1.5,
      requires_confirmation: false,
    });
    expect(errors.some(e => e.includes('confidence'))).toBe(true);
  });
});

// ─── Full Response Validation ───

describe('validateAgentResponse', () => {
  it('accepts valid response', () => {
    const result = validateAgentResponse(makeValidResponse());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects wrong protocol version', () => {
    const result = validateAgentResponse(
      makeValidResponse({ protocol_version: '2.0' as any })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('protocol_version'))).toBe(true);
  });

  it('rejects missing request_id', () => {
    const result = validateAgentResponse(
      makeValidResponse({ request_id: '' })
    );
    expect(result.valid).toBe(false);
  });

  it('rejects invalid status', () => {
    const result = validateAgentResponse(
      makeValidResponse({ status: 'unknown' as any })
    );
    expect(result.valid).toBe(false);
  });

  it('rejects non-object response', () => {
    const result = validateAgentResponse('not an object');
    expect(result.valid).toBe(false);
  });

  it('rejects null response', () => {
    const result = validateAgentResponse(null);
    expect(result.valid).toBe(false);
  });
});

// ─── Confidence Gate ───

describe('isConfidenceSufficient', () => {
  it('accepts above threshold', () => {
    const action: ActionCommand = makeValidResponse().action;
    action.confidence = 0.8;
    expect(isConfidenceSufficient(action, { confidence_threshold: 0.5 })).toBe(true);
  });

  it('rejects below threshold', () => {
    const action: ActionCommand = makeValidResponse().action;
    action.confidence = 0.3;
    expect(isConfidenceSufficient(action, { confidence_threshold: 0.5 })).toBe(false);
  });

  it('accepts at exact threshold', () => {
    const action: ActionCommand = makeValidResponse().action;
    action.confidence = 0.5;
    expect(isConfidenceSufficient(action, { confidence_threshold: 0.5 })).toBe(true);
  });
});

// ─── Confirmation Policy ───

describe('requiresConfirmation', () => {
  it('requires for submit actions', () => {
    const action = makeValidResponse().action;
    action.type = 'submit';
    expect(requiresConfirmation(action)).toBe(true);
  });

  it('requires when server says so', () => {
    const action = makeValidResponse().action;
    action.requires_confirmation = true;
    expect(requiresConfirmation(action)).toBe(true);
  });

  it('requires for delete patterns', () => {
    const action = makeValidResponse().action;
    action.target.text_hint = 'Delete Account';
    expect(requiresConfirmation(action)).toBe(true);
  });

  it('requires for payment patterns', () => {
    const action = makeValidResponse().action;
    action.target.text_hint = 'Pay Now';
    expect(requiresConfirmation(action)).toBe(true);
  });

  it('requires for sign out patterns', () => {
    const action = makeValidResponse().action;
    action.target.text_hint = 'Sign Out';
    expect(requiresConfirmation(action)).toBe(true);
  });

  it('does NOT require for normal click', () => {
    const action = makeValidResponse().action;
    action.type = 'click';
    action.target.text_hint = 'Download';
    expect(requiresConfirmation(action)).toBe(false);
  });
});

// ─── Stale DOM Detection ───

describe('resolveTargetElement', () => {
  it('resolves by element_id', () => {
    const el = makeDOMElement({ id: 'e_001' });
    const result = resolveTargetElement(
      { element_id: 'e_001', bbox: el.bbox, selector_hint: '', text_hint: '' },
      [el]
    );
    expect(result).toBeTruthy();
    expect(result?.id).toBe('e_001');
  });

  it('returns null for missing element', () => {
    const result = resolveTargetElement(
      { element_id: 'e_999', bbox: { x: 0, y: 0, w: 0, h: 0 }, selector_hint: '', text_hint: '' },
      [makeDOMElement()]
    );
    expect(result).toBeNull();
  });

  it('returns null for invisible element', () => {
    const el = makeDOMElement({ id: 'e_001', visible: false });
    const result = resolveTargetElement(
      { element_id: 'e_001', bbox: el.bbox, selector_hint: '', text_hint: '' },
      [el]
    );
    expect(result).toBeNull();
  });

  it('falls back to data_agent_id attribute', () => {
    const el = makeDOMElement({ id: 'e_renamed', attributes: { autocomplete: null, data_agent_id: 'e_001' } });
    const result = resolveTargetElement(
      { element_id: 'e_001', bbox: el.bbox, selector_hint: '', text_hint: '' },
      [el]
    );
    expect(result).toBeTruthy();
  });
});

describe('isBBoxStale', () => {
  it('detects no movement', () => {
    const bbox = { x: 0.5, y: 0.5, w: 0.1, h: 0.05 };
    expect(isBBoxStale(bbox, bbox)).toBe(false);
  });

  it('detects significant shift', () => {
    expect(
      isBBoxStale(
        { x: 0.5, y: 0.5, w: 0.1, h: 0.05 },
        { x: 0.7, y: 0.3, w: 0.1, h: 0.05 }
      )
    ).toBe(true);
  });

  it('tolerates small shift within tolerance', () => {
    expect(
      isBBoxStale(
        { x: 0.5, y: 0.5, w: 0.1, h: 0.05 },
        { x: 0.51, y: 0.51, w: 0.1, h: 0.05 },
        0.05
      )
    ).toBe(false);
  });
});
