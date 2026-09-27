// ─── apps/extension/src/__tests__/pii-detection.test.ts ───
// Unit tests for PII detection and redaction.

import { describe, it, expect } from 'vitest';
import {
  detectPIIInText,
  detectPIIInElement,
  detectAllPII,
  type PIIMatch,
} from '@sih26171/privacy';
import { redactElements, verifyPrivacy } from '@sih26171/privacy';
import type { DOMElement } from '@sih26171/protocol';

// ─── Helpers ───

function makeElement(overrides: Partial<DOMElement> = {}): DOMElement {
  return {
    id: 'e_001',
    tag: 'span',
    role: null,
    text: '',
    aria_label: null,
    input_type: null,
    value_state: 'empty',
    disabled: false,
    visible: true,
    bbox: { x: 0.1, y: 0.1, w: 0.2, h: 0.05 },
    attributes: {
      autocomplete: null,
      data_agent_id: 'e_001',
    },
    ...overrides,
  };
}

// ─── Email Detection ───

describe('PII Detection: Email', () => {
  it('detects standard email', () => {
    const matches = detectPIIInText('Contact: john@example.com', 'text');
    expect(matches.some(m => m.category === 'email')).toBe(true);
    expect(matches.find(m => m.category === 'email')?.value).toBe('john@example.com');
  });

  it('detects email with subdomains', () => {
    const matches = detectPIIInText('user@mail.company.co.in', 'text');
    expect(matches.some(m => m.category === 'email')).toBe(true);
  });

  it('does not false-positive on non-email text', () => {
    const matches = detectPIIInText('Click the button below', 'text');
    expect(matches.filter(m => m.category === 'email')).toHaveLength(0);
  });
});

// ─── Phone Detection ───

describe('PII Detection: Phone', () => {
  it('detects Indian phone number: +91 98765 43210', () => {
    const matches = detectPIIInText('Call us: +91 98765 43210', 'text');
    expect(matches.some(m => m.category === 'phone')).toBe(true);
  });

  it('detects Indian phone number: +91 90000 12345', () => {
    const matches = detectPIIInText('Helpdesk: +91 90000 12345', 'text');
    expect(matches.some(m => m.category === 'phone')).toBe(true);
  });

  it('detects Indian phone number: 9876543210', () => {
    const matches = detectPIIInText('Contact 9876543210 for details', 'text');
    expect(matches.some(m => m.category === 'phone')).toBe(true);
  });

  it('detects Indian phone number: 90000-12345', () => {
    const matches = detectPIIInText('Direct dial: 90000-12345', 'text');
    expect(matches.some(m => m.category === 'phone')).toBe(true);
  });

  it('detects US phone number', () => {
    const matches = detectPIIInText('Phone: (555) 123-4567', 'text');
    expect(matches.some(m => m.category === 'phone')).toBe(true);
  });
});

// ─── Government ID Detection ───

describe('PII Detection: Government IDs', () => {
  it('detects Indian PAN', () => {
    const matches = detectPIIInText('PAN: ABCDE1234F', 'text');
    expect(matches.some(m => m.category === 'government_id')).toBe(true);
  });

  it('detects Aadhaar-like number', () => {
    const matches = detectPIIInText('Aadhaar: 1234 5678 9012', 'text');
    expect(matches.some(m => m.category === 'government_id')).toBe(true);
  });
});

// ─── Financial Detection ───

describe('PII Detection: Financial', () => {
  it('detects credit card number', () => {
    const matches = detectPIIInText('Card: 4532 1234 5678 9012', 'text');
    expect(matches.some(m => m.category === 'financial')).toBe(true);
  });
});

// ─── Input Type Heuristics ───

describe('PII Detection: Input type heuristics', () => {
  it('flags password inputs', () => {
    const el = makeElement({ input_type: 'password', tag: 'input' });
    const matches = detectPIIInElement(el);
    expect(matches.some(m => m.category === 'password')).toBe(true);
  });

  it('flags email inputs', () => {
    const el = makeElement({ input_type: 'email', tag: 'input' });
    const matches = detectPIIInElement(el);
    expect(matches.some(m => m.category === 'email')).toBe(true);
  });

  it('flags tel inputs', () => {
    const el = makeElement({ input_type: 'tel', tag: 'input' });
    const matches = detectPIIInElement(el);
    expect(matches.some(m => m.category === 'phone')).toBe(true);
  });
});

// ─── Autocomplete Heuristics ───

describe('PII Detection: Autocomplete attributes', () => {
  it('flags cc-number autocomplete', () => {
    const el = makeElement({
      tag: 'input',
      attributes: { autocomplete: 'cc-number', data_agent_id: 'e_001' },
    });
    const matches = detectPIIInElement(el);
    expect(matches.some(m => m.category === 'financial')).toBe(true);
  });

  it('flags name autocomplete', () => {
    const el = makeElement({
      tag: 'input',
      attributes: { autocomplete: 'name', data_agent_id: 'e_001' },
    });
    const matches = detectPIIInElement(el);
    expect(matches.some(m => m.category === 'name')).toBe(true);
  });
});

// ─── Label Inference ───

describe('PII Detection: Label inference', () => {
  it('infers email from label text', () => {
    const el = makeElement({ aria_label: 'Enter your email address' });
    const matches = detectPIIInElement(el);
    expect(matches.some(m => m.category === 'email')).toBe(true);
  });

  it('infers password from label text', () => {
    const el = makeElement({ text: 'Password' });
    const matches = detectPIIInElement(el);
    expect(matches.some(m => m.category === 'password')).toBe(true);
  });
});

// ─── Redaction ───

describe('Redaction', () => {
  it('masks email in text', () => {
    const el = makeElement({ text: 'Contact john@example.com for info' });
    const result = redactElements([el]);
    expect(result.elements[0].text).toContain('[EMAIL]');
    expect(result.elements[0].text).not.toContain('john@example.com');
    expect(result.manifest.length).toBeGreaterThan(0);
  });

  it('masks phone in text', () => {
    const el = makeElement({ text: 'Call +91 98765 43210' });
    const result = redactElements([el]);
    expect(result.elements[0].text).toContain('[PHONE]');
  });

  it('builds redaction manifest', () => {
    const el = makeElement({
      id: 'e_secret',
      text: 'Email: user@test.com, PAN: ABCDE1234F',
    });
    const result = redactElements([el]);
    expect(result.manifest.some(r => r.category === 'email')).toBe(true);
    expect(result.manifest.some(r => r.category === 'government_id')).toBe(true);
    expect(result.manifest.every(r => r.element_id === 'e_secret')).toBe(true);
  });

  it('preserves non-PII text', () => {
    const el = makeElement({ text: 'Download Report' });
    const result = redactElements([el]);
    expect(result.elements[0].text).toBe('Download Report');
    expect(result.manifest).toHaveLength(0);
  });

  it('measures performance', () => {
    const el = makeElement({ text: 'Some text with email@test.com' });
    const result = redactElements([el]);
    expect(result.detection_ms).toBeGreaterThanOrEqual(0);
    expect(result.redaction_ms).toBeGreaterThanOrEqual(0);
  });
});

// ─── Privacy Verification ───

describe('Privacy Verification', () => {
  it('passes for clean elements', () => {
    const el = makeElement({ tag: 'button', text: 'Submit' });
    const result = verifyPrivacy([el], []);
    expect(result.passed).toBe(true);
  });

  it('flags excessive text length', () => {
    const longText = 'A'.repeat(600);
    const el = makeElement({ text: longText });
    const result = verifyPrivacy([el], []);
    expect(result.checks.some(c => c.name === 'no_excessive_text' && !c.passed)).toBe(true);
  });
});

// ─── Bulk Detection ───

describe('detectAllPII', () => {
  it('detects across multiple elements', () => {
    const elements = [
      makeElement({ id: 'e_001', text: 'Email: user@test.com' }),
      makeElement({ id: 'e_002', text: 'No PII here' }),
      makeElement({ id: 'e_003', text: 'PAN: ABCDE1234F' }),
    ];
    const result = detectAllPII(elements);
    expect(result.has('e_001')).toBe(true);
    expect(result.has('e_002')).toBe(false);
    expect(result.has('e_003')).toBe(true);
  });
});
