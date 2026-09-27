// ─── fixtures/pii-seeded-page.ts ───
// Test fixture: a page with deliberately seeded PII across all categories.
// Used for integration testing of the PII detection and redaction pipeline.

import type { DOMElement } from '@sih26171/protocol';

/**
 * Simulated DOM elements with seeded PII.
 * Each element contains one or more PII categories for validation.
 */
export const PII_SEEDED_ELEMENTS: DOMElement[] = [
  // ─── Email in visible text ───
  {
    id: 'e_001',
    tag: 'span',
    role: null,
    text: 'Contact: priya.sharma@company.co.in',
    aria_label: null,
    input_type: null,
    value_state: 'empty',
    disabled: false,
    visible: true,
    bbox: { x: 0.1, y: 0.05, w: 0.4, h: 0.03 },
    attributes: { autocomplete: null, data_agent_id: 'e_001' },
  },
  // ─── Phone number ───
  {
    id: 'e_002',
    tag: 'span',
    role: null,
    text: 'Phone: +91 98765 43210',
    aria_label: null,
    input_type: null,
    value_state: 'empty',
    disabled: false,
    visible: true,
    bbox: { x: 0.1, y: 0.08, w: 0.3, h: 0.03 },
    attributes: { autocomplete: null, data_agent_id: 'e_002' },
  },
  // ─── Indian PAN ───
  {
    id: 'e_003',
    tag: 'span',
    role: null,
    text: 'PAN: ABCDE1234F',
    aria_label: null,
    input_type: null,
    value_state: 'empty',
    disabled: false,
    visible: true,
    bbox: { x: 0.1, y: 0.11, w: 0.25, h: 0.03 },
    attributes: { autocomplete: null, data_agent_id: 'e_003' },
  },
  // ─── Aadhaar number ───
  {
    id: 'e_004',
    tag: 'span',
    role: null,
    text: 'Aadhaar: 1234 5678 9012',
    aria_label: null,
    input_type: null,
    value_state: 'empty',
    disabled: false,
    visible: true,
    bbox: { x: 0.1, y: 0.14, w: 0.3, h: 0.03 },
    attributes: { autocomplete: null, data_agent_id: 'e_004' },
  },
  // ─── Credit card ───
  {
    id: 'e_005',
    tag: 'span',
    role: null,
    text: 'Card: 4532 1234 5678 9012',
    aria_label: null,
    input_type: null,
    value_state: 'empty',
    disabled: false,
    visible: true,
    bbox: { x: 0.1, y: 0.17, w: 0.35, h: 0.03 },
    attributes: { autocomplete: null, data_agent_id: 'e_005' },
  },
  // ─── Date of birth ───
  {
    id: 'e_006',
    tag: 'span',
    role: null,
    text: 'DOB: 15/08/1990',
    aria_label: null,
    input_type: null,
    value_state: 'empty',
    disabled: false,
    visible: true,
    bbox: { x: 0.1, y: 0.20, w: 0.2, h: 0.03 },
    attributes: { autocomplete: null, data_agent_id: 'e_006' },
  },
  // ─── Password input ───
  {
    id: 'e_007',
    tag: 'input',
    role: 'textbox',
    text: '',
    aria_label: 'Enter password',
    input_type: 'password',
    value_state: 'filled',
    disabled: false,
    visible: true,
    bbox: { x: 0.3, y: 0.25, w: 0.3, h: 0.04 },
    attributes: { autocomplete: 'current-password', data_agent_id: 'e_007' },
  },
  // ─── Email input ───
  {
    id: 'e_008',
    tag: 'input',
    role: 'textbox',
    text: '',
    aria_label: 'Email address',
    input_type: 'email',
    value_state: 'filled',
    disabled: false,
    visible: true,
    bbox: { x: 0.3, y: 0.30, w: 0.3, h: 0.04 },
    attributes: { autocomplete: 'email', data_agent_id: 'e_008' },
  },
  // ─── Name input with autocomplete ───
  {
    id: 'e_009',
    tag: 'input',
    role: 'textbox',
    text: '',
    aria_label: 'Full name',
    input_type: 'text',
    value_state: 'filled',
    disabled: false,
    visible: true,
    bbox: { x: 0.3, y: 0.35, w: 0.3, h: 0.04 },
    attributes: { autocomplete: 'name', data_agent_id: 'e_009' },
  },
  // ─── Address in aria_label ───
  {
    id: 'e_010',
    tag: 'div',
    role: null,
    text: '123 MG Road, Bengaluru 560001',
    aria_label: 'Delivery address: 123 MG Road, Bengaluru 560001',
    input_type: null,
    value_state: 'empty',
    disabled: false,
    visible: true,
    bbox: { x: 0.1, y: 0.40, w: 0.5, h: 0.05 },
    attributes: { autocomplete: null, data_agent_id: 'e_010' },
  },
  // ─── Vehicle registration ───
  {
    id: 'e_011',
    tag: 'span',
    role: null,
    text: 'Vehicle: KA-01-AB-1234',
    aria_label: null,
    input_type: null,
    value_state: 'empty',
    disabled: false,
    visible: true,
    bbox: { x: 0.1, y: 0.45, w: 0.3, h: 0.03 },
    attributes: { autocomplete: null, data_agent_id: 'e_011' },
  },
  // ─── IP Address ───
  {
    id: 'e_012',
    tag: 'span',
    role: null,
    text: 'Your IP: 192.168.1.100',
    aria_label: null,
    input_type: null,
    value_state: 'empty',
    disabled: false,
    visible: true,
    bbox: { x: 0.1, y: 0.48, w: 0.3, h: 0.03 },
    attributes: { autocomplete: null, data_agent_id: 'e_012' },
  },
  // ─── Clean button (should NOT be flagged) ───
  {
    id: 'e_013',
    tag: 'button',
    role: 'button',
    text: 'Download Report',
    aria_label: 'Download Report',
    input_type: null,
    value_state: 'empty',
    disabled: false,
    visible: true,
    bbox: { x: 0.7, y: 0.85, w: 0.12, h: 0.05 },
    attributes: { autocomplete: null, data_agent_id: 'e_013' },
  },
  // ─── Clean link (should NOT be flagged) ───
  {
    id: 'e_014',
    tag: 'a',
    role: 'link',
    text: 'View Dashboard',
    aria_label: 'View Dashboard',
    input_type: null,
    value_state: 'empty',
    disabled: false,
    visible: true,
    bbox: { x: 0.1, y: 0.90, w: 0.15, h: 0.03 },
    attributes: { autocomplete: null, data_agent_id: 'e_014' },
  },
];

/**
 * Expected PII detections. Used for evaluation scoring.
 */
export const EXPECTED_PII: Array<{ element_id: string; categories: string[] }> = [
  { element_id: 'e_001', categories: ['email'] },
  { element_id: 'e_002', categories: ['phone'] },
  { element_id: 'e_003', categories: ['government_id'] },
  { element_id: 'e_004', categories: ['government_id'] },
  { element_id: 'e_005', categories: ['financial'] },
  { element_id: 'e_006', categories: ['date_of_birth'] },
  { element_id: 'e_007', categories: ['password'] },
  { element_id: 'e_008', categories: ['email'] },
  { element_id: 'e_009', categories: ['name'] },
  { element_id: 'e_010', categories: ['address'] },
  { element_id: 'e_011', categories: ['vehicle_identifier'] },
  { element_id: 'e_012', categories: ['location'] },
];

/**
 * Elements that should NOT be flagged.
 */
export const EXPECTED_CLEAN: string[] = ['e_013', 'e_014'];
