// ─── packages/privacy/src/redactor.ts ───
// Sanitizes DOM elements and text by replacing detected PII with safe placeholders.
// Also builds the redaction_manifest sent alongside the request.

import type {
  DOMElement,
  RedactionEntry,
  PIICategory,
  PrivacyVerification,
  PrivacyCheck,
} from '@sih26171/protocol';
import { detectPIIInElement, detectAllPII, type PIIMatch } from './pii-detector.js';

// ─── Redaction helpers ───

function maskValue(value: string, category: PIICategory): string {
  switch (category) {
    case 'email':
      return '[EMAIL]';
    case 'phone':
      return '[PHONE]';
    case 'name':
      return '[NAME]';
    case 'address':
      return '[ADDRESS]';
    case 'date_of_birth':
      return '[DOB]';
    case 'government_id':
      return '[GOV_ID]';
    case 'financial':
      return '[FINANCIAL]';
    case 'health':
      return '[HEALTH]';
    case 'password':
      return '[PASSWORD]';
    case 'authentication_secret':
      return '[AUTH_SECRET]';
    case 'face':
      return '[FACE]';
    case 'vehicle_identifier':
      return '[VEHICLE_ID]';
    case 'location':
      return '[LOCATION]';
    case 'free_text_sensitive':
      return '[REDACTED]';
    case 'unknown_sensitive':
      return '[REDACTED]';
    default:
      return '[REDACTED]';
  }
}

function redactText(text: string, matches: PIIMatch[]): string {
  if (matches.length === 0) return text;

  // Sort matches descending by start position; filter valid spans
  const valid = [...matches]
    .filter(m => (m.field === 'text' || m.field === 'aria_label') && m.start >= 0 && m.end > m.start && m.value.length > 0)
    .sort((a, b) => b.start - a.start || (b.end - b.start) - (a.end - a.start));

  const nonOverlapping: PIIMatch[] = [];
  let minStart = Infinity;
  for (const m of valid) {
    if (m.end <= minStart) {
      nonOverlapping.push(m);
      minStart = m.start;
    }
  }

  let result = text;
  for (const match of nonOverlapping) {
    const placeholder = maskValue(match.value, match.category);
    result = result.slice(0, match.start) + placeholder + result.slice(match.end);
  }
  return result;
}

// ─── Core Redaction ───

export interface RedactionResult {
  elements: DOMElement[];
  manifest: RedactionEntry[];
  detection_ms: number;
  redaction_ms: number;
}

/**
 * Sanitizes a list of DOM elements by:
 * 1. Never including raw input values (value_state only).
 * 2. Detecting PII in text/aria_label fields.
 * 3. Replacing PII with category-specific placeholders.
 * 4. Building a redaction manifest.
 *
 * This function MUST be called before constructing the AgentRequest.
 */
export function redactElements(elements: DOMElement[]): RedactionResult {
  const detectStart = performance.now();
  const piiMap = detectAllPII(elements);
  const detection_ms = performance.now() - detectStart;

  const redactStart = performance.now();
  const manifest: RedactionEntry[] = [];
  const sanitized: DOMElement[] = [];

  for (const el of elements) {
    const matches = piiMap.get(el.id) || [];
    const copy: DOMElement = { ...el, attributes: { ...el.attributes } };

    // Redact text field
    const textMatches = matches.filter(m => m.field === 'text');
    if (textMatches.length > 0) {
      copy.text = redactText(el.text, textMatches);
      for (const m of textMatches) {
        manifest.push({
          element_id: el.id,
          field: 'text',
          category: m.category,
          action: 'mask',
          original_length: m.value.length,
        });
      }
    }

    // Redact aria_label
    const ariaMatches = matches.filter(m => m.field === 'aria_label');
    if (ariaMatches.length > 0 && copy.aria_label) {
      copy.aria_label = redactText(el.aria_label!, ariaMatches);
      for (const m of ariaMatches) {
        manifest.push({
          element_id: el.id,
          field: 'aria_label',
          category: m.category,
          action: 'mask',
          original_length: m.value.length,
        });
      }
    }

    // For input elements inferred as sensitive by type/autocomplete, mark value_state
    // but NEVER include raw values
    const inferredMatches = matches.filter(
      m => m.field === 'input_type' || m.field === 'autocomplete' || m.field === 'label_inference'
    );
    if (inferredMatches.length > 0) {
      for (const m of inferredMatches) {
        manifest.push({
          element_id: el.id,
          field: m.field,
          category: m.category,
          action: 'omit',
        });
      }
    }

    sanitized.push(copy);
  }

  const redaction_ms = performance.now() - redactStart;

  return { elements: sanitized, manifest, detection_ms, redaction_ms };
}

// ─── Privacy Verification ───

/**
 * Runs privacy verification checks on the sanitized elements.
 * If any check fails, the request MUST NOT be sent.
 */
export function verifyPrivacy(
  elements: DOMElement[],
  manifest: RedactionEntry[]
): PrivacyVerification {
  const checks: PrivacyCheck[] = [];

  // Check 1: No raw input values present
  const hasRawValues = elements.some(
    el =>
      el.tag === 'input' &&
      el.input_type !== 'button' &&
      el.input_type !== 'submit' &&
      el.input_type !== 'reset' &&
      el.text.length > 0 &&
      !el.text.startsWith('[') // Our placeholders start with [
  );
  checks.push({
    name: 'no_raw_input_values',
    passed: !hasRawValues,
    detail: hasRawValues ? 'Found input elements with non-redacted text' : undefined,
  });

  // Check 2: Password fields are never exposed
  const hasPassword = elements.some(
    el => el.input_type === 'password' && el.value_state === 'filled' && el.text.length > 0
  );
  checks.push({
    name: 'no_password_exposure',
    passed: !hasPassword,
    detail: hasPassword ? 'Password field text was not redacted' : undefined,
  });

  // Check 3: All detected PII has manifest entries
  const recheck = detectAllPII(elements);
  const unreportedPII = Array.from(recheck.entries()).filter(
    ([elId, matches]) =>
      matches.some(
        m =>
          m.value.length > 0 &&
          !manifest.some(
            r => r.element_id === elId && r.category === m.category
          )
      )
  );
  checks.push({
    name: 'all_pii_in_manifest',
    passed: unreportedPII.length === 0,
    detail:
      unreportedPII.length > 0
        ? `${unreportedPII.length} elements have PII not covered by manifest`
        : undefined,
  });

  // Check 4: No suspiciously long text (might be free text dumps)
  const longText = elements.some(el => el.text.length > 500);
  checks.push({
    name: 'no_excessive_text',
    passed: !longText,
    detail: longText ? 'Element text exceeds 500 chars — may contain sensitive free text' : undefined,
  });

  return {
    passed: checks.every(c => c.passed),
    checks,
  };
}
