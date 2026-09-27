// ─── packages/privacy/src/sanitizer.ts ───
// Privacy Firewall: sanitizeBeforeSend
// Contract: Perception occurs locally, privacy firewall verifies context locally,
// only verified, sanitized context is ever dispatched over the network.

import type {
  DOMContext,
  DOMElement,
  AgentRequest,
  ScreenshotInfo,
  TaskSpec,
  ViewportInfo,
  ClientMetrics,
  ExtensionConfig,
  PrivacyVerification,
  RedactionEntry,
} from '@sih26171/protocol';
import { PROTOCOL_VERSION } from '@sih26171/protocol';
import { redactElements, verifyPrivacy } from './redactor.js';

export interface SanitizeBeforeSendInput {
  dom: DOMContext | DOMElement[];
  screenshot?: {
    base64?: string;
    info?: ScreenshotInfo;
    capture_ms?: number;
  } | {
    base64?: string;
    media_type?: 'image/webp' | 'image/png';
    width?: number;
    height?: number;
    quality?: number;
    sha256?: string;
  };
  task: TaskSpec;
  viewport?: ViewportInfo;
  client_metrics?: Partial<ClientMetrics>;
  config?: ExtensionConfig;
  requestId?: string;
}

export interface SanitizeBeforeSendResult {
  verified: boolean;
  verification: PrivacyVerification;
  payload: AgentRequest;
  redactions: RedactionEntry[];
  detection_ms: number;
  redaction_ms: number;
}

/**
 * Primary Privacy Firewall entrypoint.
 *
 * MUST be invoked before any network communication.
 * Validates DOM and accessibility metadata, runs PII detection and redaction,
 * executes pre-flight privacy verification checks, and constructs a strictly
 * conformant AgentRequest payload.
 *
 * If verification fails (e.g. raw password or unredacted PII remains),
 * `verified` is false.
 */
export function sanitizeBeforeSend(
  input: SanitizeBeforeSendInput
): SanitizeBeforeSendResult {
  const elements = Array.isArray(input.dom)
    ? input.dom
    : (input.dom && Array.isArray(input.dom.elements) ? input.dom.elements : []);

  const pageTitle = !Array.isArray(input.dom) && input.dom?.page_title
    ? input.dom.page_title
    : 'Document';

  // 1. Redact elements locally
  const redactionResult = redactElements(elements);

  // 2. Perform strict local privacy verification
  const verification = verifyPrivacy(
    redactionResult.elements,
    redactionResult.manifest
  );

  const requestId =
    input.requestId ||
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `req_${Date.now()}`);

  const defaultViewport: ViewportInfo = {
    width: 1280,
    height: 720,
    device_pixel_ratio: 1,
    scroll_x: 0,
    scroll_y: 0,
    url_origin: 'http://localhost',
  };

  const rawScreenshot = input.screenshot || {};
  let screenshotInfo: ScreenshotInfo;
  let base64 = '';

  if ('info' in rawScreenshot && rawScreenshot.info) {
    screenshotInfo = rawScreenshot.info;
    base64 = rawScreenshot.base64 || '';
  } else {
    screenshotInfo = {
      media_type: (rawScreenshot as { media_type?: 'image/webp' | 'image/png' }).media_type || 'image/png',
      width: (rawScreenshot as { width?: number }).width || 1280,
      height: (rawScreenshot as { height?: number }).height || 720,
      quality: (rawScreenshot as { quality?: number }).quality || (input.config?.screenshot_quality ?? 65),
      sha256: (rawScreenshot as { sha256?: string }).sha256 || '0000000000000000000000000000000000000000000000000000000000000000',
    };
    base64 = (rawScreenshot as { base64?: string }).base64 || '';
  }

  const clientMetrics: ClientMetrics = {
    capture_ms:
      'capture_ms' in rawScreenshot && typeof rawScreenshot.capture_ms === 'number'
        ? rawScreenshot.capture_ms
        : (input.client_metrics?.capture_ms ?? 0),
    detection_ms: redactionResult.detection_ms,
    redaction_ms: redactionResult.redaction_ms,
    model: input.client_metrics?.model ?? 'regex-v1',
    execution_provider: input.client_metrics?.execution_provider ?? 'cpu',
  };

  const payload: AgentRequest = {
    protocol_version: PROTOCOL_VERSION,
    request_id: requestId,
    timestamp_ms: Date.now(),
    task: input.task,
    viewport: input.viewport || defaultViewport,
    screenshot: screenshotInfo,
    dom_context: {
      page_title: pageTitle,
      elements: redactionResult.elements,
    },
    redaction_manifest: redactionResult.manifest,
    privacy: {
      raw_pixels_sent: false,
      raw_dom_values_sent: false,
      verification,
    },
    client_metrics: clientMetrics,
    // In P0 MVP, raw screenshot pixel transmission is strictly omitted to prevent visual secret leakage.
    // Perception and reasoning operate on sanitized DOM structure, accessibility semantics,
    // bounding boxes, and viewport dimensions. Pixel-level canvas redaction is deferred to P2.
    image_base64: '',
  };

  return {
    verified: verification.passed,
    verification,
    payload,
    redactions: redactionResult.manifest,
    detection_ms: redactionResult.detection_ms,
    redaction_ms: redactionResult.redaction_ms,
  };
}
