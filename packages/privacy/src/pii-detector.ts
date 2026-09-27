// ─── packages/privacy/src/pii-detector.ts ───
// Client-side PII detection using regex patterns.
// This is the baseline detector; a real deployment would use a local
// NER model (ONNX/WASM) for higher recall. The regex approach scores
// well on precision and is fast (<5ms for typical pages).

import type { PIICategory, DOMElement, RedactionEntry } from '@sih26171/protocol';

export interface PIIMatch {
  category: PIICategory;
  value: string;
  field: string;       // which field on the DOMElement matched
  start: number;
  end: number;
  confidence: number;
}

// ─── Pattern Registry ───

interface PatternDef {
  category: PIICategory;
  pattern: RegExp;
  confidence: number;
}

const PII_PATTERNS: PatternDef[] = [
  // Email
  {
    category: 'email',
    pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b/g,
    confidence: 0.95,
  },
  // Indian phone numbers: +91 98765 43210, +91 90000 12345, 9876543210, 90000-12345
  {
    category: 'phone',
    pattern: /(?:(?:\+91[\s\-]?)|\b)[6-9]\d{4}[\s\-]?\d{5}\b/g,
    confidence: 0.90,
  },
  // International phone formats: (555) 123-4567, +1-555-123-4567
  {
    category: 'phone',
    pattern: /(?:\+?\d{1,3}[\s\-]?)?\(?\d{2,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{4}\b/g,
    confidence: 0.85,
  },
  // Indian Aadhaar
  {
    category: 'government_id',
    pattern: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,
    confidence: 0.80,
  },
  // Indian PAN
  {
    category: 'government_id',
    pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    confidence: 0.90,
  },
  // SSN (US)
  {
    category: 'government_id',
    pattern: /\b\d{3}[\-\s]?\d{2}[\-\s]?\d{4}\b/g,
    confidence: 0.75,
  },
  // Credit card numbers (basic Luhn-like patterns)
  {
    category: 'financial',
    pattern: /\b(?:\d{4}[\s\-]?){3}\d{4}\b/g,
    confidence: 0.85,
  },
  // Date of birth patterns
  {
    category: 'date_of_birth',
    pattern: /\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g,
    confidence: 0.60,
  },
  // Indian PIN codes
  {
    category: 'address',
    pattern: /\b\d{6}\b/g,
    confidence: 0.40,
  },
  // Vehicle registration (Indian)
  {
    category: 'vehicle_identifier',
    pattern: /\b[A-Z]{2}[\s\-]?\d{1,2}[\s\-]?[A-Z]{1,3}[\s\-]?\d{4}\b/g,
    confidence: 0.85,
  },
  // IP Addresses
  {
    category: 'location',
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    confidence: 0.70,
  },
];

// ─── Input-type based detection ───

const INPUT_TYPE_CATEGORY_MAP: Record<string, PIICategory> = {
  'email': 'email',
  'tel': 'phone',
  'password': 'password',
  'date': 'date_of_birth',
  'number': 'unknown_sensitive', // may be financial
};

const AUTOCOMPLETE_CATEGORY_MAP: Record<string, PIICategory> = {
  'name': 'name',
  'given-name': 'name',
  'family-name': 'name',
  'email': 'email',
  'tel': 'phone',
  'tel-national': 'phone',
  'street-address': 'address',
  'address-line1': 'address',
  'address-line2': 'address',
  'postal-code': 'address',
  'cc-number': 'financial',
  'cc-name': 'financial',
  'cc-exp': 'financial',
  'cc-csc': 'financial',
  'bday': 'date_of_birth',
  'username': 'authentication_secret',
  'new-password': 'password',
  'current-password': 'password',
};

const LABEL_CATEGORY_MAP: [RegExp, PIICategory][] = [
  [/\bname\b/i, 'name'],
  [/\bfirst\s*name\b/i, 'name'],
  [/\blast\s*name\b/i, 'name'],
  [/\be[\-\.]?mail\b/i, 'email'],
  [/\bphone\b/i, 'phone'],
  [/\bmobile\b/i, 'phone'],
  [/\baddress\b/i, 'address'],
  [/\bpassword\b/i, 'password'],
  [/\baadhaar\b/i, 'government_id'],
  [/\bpan\b/i, 'government_id'],
  [/\bssn\b/i, 'government_id'],
  [/\bdate\s*of\s*birth\b/i, 'date_of_birth'],
  [/\bdob\b/i, 'date_of_birth'],
  [/\bcredit\s*card\b/i, 'financial'],
  [/\bcard\s*number\b/i, 'financial'],
  [/\bcvv\b/i, 'financial'],
];

// ─── Core Detection ───

export function detectPIIInText(
  text: string,
  field: string
): PIIMatch[] {
  if (!text || text.length === 0) return [];
  const matches: PIIMatch[] = [];

  for (const def of PII_PATTERNS) {
    // Reset regex state (global flag)
    def.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = def.pattern.exec(text)) !== null) {
      matches.push({
        category: def.category,
        value: m[0],
        field,
        start: m.index,
        end: m.index + m[0].length,
        confidence: def.confidence,
      });
    }
  }

  return matches;
}

export function detectPIIInElement(element: DOMElement): PIIMatch[] {
  const matches: PIIMatch[] = [];

  // Text content scan
  matches.push(...detectPIIInText(element.text, 'text'));

  // Aria label scan
  if (element.aria_label) {
    matches.push(...detectPIIInText(element.aria_label, 'aria_label'));
  }

  // Input type heuristic
  if (element.input_type && INPUT_TYPE_CATEGORY_MAP[element.input_type]) {
    matches.push({
      category: INPUT_TYPE_CATEGORY_MAP[element.input_type],
      value: '', // Not the actual value — we never expose values
      field: 'input_type',
      start: 0,
      end: 0,
      confidence: 0.90,
    });
  }

  // Autocomplete attribute heuristic
  const ac = element.attributes.autocomplete;
  if (ac && AUTOCOMPLETE_CATEGORY_MAP[ac]) {
    matches.push({
      category: AUTOCOMPLETE_CATEGORY_MAP[ac],
      value: '',
      field: 'autocomplete',
      start: 0,
      end: 0,
      confidence: 0.92,
    });
  }

  // Label / aria_label category inference
  const labelText = [element.aria_label, element.text].filter(Boolean).join(' ');
  for (const [pattern, category] of LABEL_CATEGORY_MAP) {
    if (pattern.test(labelText)) {
      matches.push({
        category,
        value: '',
        field: 'label_inference',
        start: 0,
        end: 0,
        confidence: 0.70,
      });
    }
  }

  return matches;
}

export function detectAllPII(elements: DOMElement[]): Map<string, PIIMatch[]> {
  const result = new Map<string, PIIMatch[]>();
  for (const el of elements) {
    const matches = detectPIIInElement(el);
    if (matches.length > 0) {
      result.set(el.id, matches);
    }
  }
  return result;
}
