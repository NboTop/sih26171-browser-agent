// ─── packages/protocol/src/types.ts ───
// Canonical protocol types for SIH26171 browser agent.
// These MUST match the protocol contract exactly. Do not modify shapes
// without filing a migration note.

/** Protocol version — monotonically incremented on breaking changes. */
export const PROTOCOL_VERSION = '1.0' as const;

// ────────────────────────── Primitives ──────────────────────────

/** Normalized bounding box — top-left origin, values in [0,1]. */
export interface BBox {
  x: number; // pixel_x / screenshot_width
  y: number; // pixel_y / screenshot_height
  w: number; // pixel_width / screenshot_width
  h: number; // pixel_height / screenshot_height
}

/** PII category enum. */
export type PIICategory =
  | 'name'
  | 'email'
  | 'phone'
  | 'address'
  | 'date_of_birth'
  | 'government_id'
  | 'financial'
  | 'health'
  | 'password'
  | 'authentication_secret'
  | 'face'
  | 'vehicle_identifier'
  | 'location'
  | 'free_text_sensitive'
  | 'unknown_sensitive';

export const ALL_PII_CATEGORIES: readonly PIICategory[] = [
  'name', 'email', 'phone', 'address', 'date_of_birth',
  'government_id', 'financial', 'health', 'password',
  'authentication_secret', 'face', 'vehicle_identifier',
  'location', 'free_text_sensitive', 'unknown_sensitive',
] as const;

/** Allowed action types from the server. */
export type ActionType =
  | 'observe'
  | 'click'
  | 'type'
  | 'scroll'
  | 'keypress'
  | 'submit'
  | 'wait'
  | 'needs_user_input';

export const ALLOWED_ACTION_TYPES: readonly ActionType[] = [
  'observe', 'click', 'type', 'scroll',
  'keypress', 'submit', 'wait', 'needs_user_input',
] as const;

/** Actions that require local user confirmation before execution. */
export const CONFIRMATION_REQUIRED_ACTIONS: readonly ActionType[] = [
  'submit',
] as const;

/** Patterns in element text/role/attributes that force confirmation. */
export const CONFIRMATION_REQUIRED_PATTERNS: readonly RegExp[] = [
  /pay/i, /purchase/i, /delete/i, /remove/i,
  /sign.?out/i, /log.?out/i, /deactivate/i,
  /cancel.*account/i, /navigate/i,
  /transfer/i, /send.*money/i, /confirm.*order/i,
];

// ────────────────────────── DOM Element ──────────────────────────

export interface DOMElementAttributes {
  autocomplete: string | null;
  data_agent_id: string;
  [key: string]: string | null;
}

export interface DOMElement {
  id: string;           // stable agent-assigned id, e.g. "e_001"
  tag: string;
  role: string | null;
  text: string;         // visible text, truncated + sanitized
  aria_label: string | null;
  input_type: string | null;
  value_state: 'empty' | 'filled' | 'checked' | 'unchecked' | 'indeterminate';
  disabled: boolean;
  visible: boolean;
  bbox: BBox;
  attributes: DOMElementAttributes;
}

// ────────────────────────── Redaction ──────────────────────────

export interface RedactionEntry {
  element_id: string;
  field: string;
  category: PIICategory;
  action: 'mask' | 'omit' | 'hash' | 'blur';
  original_length?: number;
}

// ────────────────────────── Client Request ──────────────────────────

export interface TaskSpec {
  goal: string;
  allowed_actions: ActionType[];
  max_steps: number;
}

export interface ViewportInfo {
  width: number;
  height: number;
  device_pixel_ratio: number;
  scroll_x: number;
  scroll_y: number;
  url_origin: string;
}

export interface ScreenshotInfo {
  media_type: 'image/webp' | 'image/png';
  width: number;
  height: number;
  quality: number;
  sha256: string;
}

export interface PrivacyVerification {
  passed: boolean;
  checks: PrivacyCheck[];
}

export interface PrivacyCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface PrivacyInfo {
  raw_pixels_sent: false; // Contract: always false
  raw_dom_values_sent: false; // Contract: always false
  verification: PrivacyVerification;
}

export interface ClientMetrics {
  capture_ms: number;
  detection_ms: number;
  redaction_ms: number;
  model: string;
  execution_provider: 'webgpu' | 'wasm' | 'cpu' | 'none';
}

export interface DOMContext {
  page_title: string;
  elements: DOMElement[];
}

export interface PayloadBudgetMetrics {
  context_truncated: boolean;
  original_element_count: number;
  retained_element_count: number;
  dropped_element_count: number;
  serialized_payload_bytes: number;
  max_payload_bytes: number;
}

export interface AgentRequest {
  protocol_version: typeof PROTOCOL_VERSION;
  request_id: string;
  timestamp_ms: number;
  task: TaskSpec;
  viewport: ViewportInfo;
  screenshot: ScreenshotInfo;
  dom_context: DOMContext;
  redaction_manifest: RedactionEntry[];
  privacy: PrivacyInfo;
  client_metrics: ClientMetrics;
  image_base64: string; // must be sanitized
  payload_budget?: PayloadBudgetMetrics;
}

// ────────────────────────── Server Response ──────────────────────────

export interface ActionTarget {
  element_id: string;
  bbox: BBox;
  selector_hint: string;
  text_hint: string;
}

export interface ActionCommand {
  type: ActionType;
  target: ActionTarget;
  arguments: Record<string, unknown>;
  confidence: number;
  requires_confirmation: boolean;
}

export interface ServerMetrics {
  queue_ms: number;
  inference_ms: number;
  total_server_ms: number;
  model: string;
}

export interface AgentResponse {
  protocol_version: typeof PROTOCOL_VERSION;
  request_id: string;
  status: 'ok' | 'error' | 'needs_more_context';
  action: ActionCommand;
  next_observation: boolean;
  explanation: string;
  server_metrics: ServerMetrics;
}

// ────────────────────────── Internal Messages ──────────────────────────

/** Messages between content script ↔ background service worker. */
export type InternalMessageType =
  | 'CAPTURE_REQUEST'
  | 'CAPTURE_RESULT'
  | 'SCAN_PAGE'
  | 'SCAN_RESULT'
  | 'PRIVACY_HUD_UPDATE'
  | 'EXECUTE_ACTION'
  | 'ACTION_RESULT'
  | 'TASK_START'
  | 'TASK_STATUS'
  | 'CONFIRMATION_REQUEST'
  | 'CONFIRMATION_RESPONSE'
  | 'AUDIT_LOG_ENTRY'
  | 'SETTINGS_UPDATE'
  | 'ERROR';

export interface InternalMessage {
  type: InternalMessageType;
  payload: unknown;
  timestamp_ms: number;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'BLOCKED';

export type ApprovalState = 'NONE' | 'PENDING' | 'APPROVED' | 'CANCELLED' | 'REJECTED';

export interface ActionApprovalRequest {
  action: ActionCommand;
  risk_level: RiskLevel;
  reason: string;
  target_label: string;
  command_id?: string;
  target_fingerprint?: string;
}

export interface PrivacyHUDState {
  firewall_status: 'PASS' | 'BLOCKED';
  reasoner_mode: string;
  sensitive_counts: Record<string, number>;
  total_sensitive: number;
  raw_dom_values_sent: 'NO' | 'YES';
  raw_screenshot_pixels_sent: 'NO' | 'YES';
  cookies_storage_passwords_sent: 'NO' | 'YES';
  retained_elements: number;
  dropped_elements: number;
  total_elements_scanned: number;
  last_scan_ms?: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp_ms: number;
  request_id: string;
  action_type: ActionType;
  target_element_id: string;
  confidence: number;
  result: 'executed' | 'rejected' | 'confirmed' | 'error' | 'timeout';
  error_message?: string;
  risk_level?: RiskLevel;
  // Never log secret values
}

// ────────────────────────── Configuration ──────────────────────────

export interface ExtensionConfig {
  server_endpoint: string;
  mock_mode: boolean;
  confidence_threshold: number;
  max_elements: number;
  screenshot_quality: number;
  request_timeout_ms: number;
  max_retries: number;
  retry_delay_ms: number;
  require_confirmation_patterns: boolean;
  max_text_length: number;
}

export const DEFAULT_CONFIG: ExtensionConfig = {
  server_endpoint: 'http://localhost:3001/api/agent',
  mock_mode: true,
  confidence_threshold: 0.5,
  max_elements: 200,
  screenshot_quality: 65,
  request_timeout_ms: 30_000,
  max_retries: 2,
  retry_delay_ms: 1000,
  require_confirmation_patterns: true,
  max_text_length: 120,
};
