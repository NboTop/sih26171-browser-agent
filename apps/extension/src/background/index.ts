// ─── apps/extension/src/background/index.ts ───
// Background service worker: orchestrates the agent loop, Privacy HUD, and Risk-Gated Approvals.
//
// Key Principles:
//   1. Local DOM-first perception (zero screenshot-pixel transmission in MVP).
//   2. Fail-closed privacy firewall (PII detection + redaction + verification before dispatch).
//   3. Local deterministic reasoner (no cloud LLM in demo mode).
//   4. Risk classification (Download Report = HIGH risk).
//   5. Strict human approval card before executing any high-risk action.
//   6. Pre-execution DOM re-read and target validation.

import type {
  AgentRequest,
  AgentResponse,
  ActionCommand,
  TaskSpec,
  ExtensionConfig,
  AuditLogEntry,
  InternalMessage,
  DOMElement,
  DOMContext,
  ViewportInfo,
  ScreenshotInfo,
  PrivacyHUDState,
  RiskLevel,
} from '@sih26171/protocol';
import {
  PROTOCOL_VERSION,
  DEFAULT_CONFIG,
  ALLOWED_ACTION_TYPES,
  validateAgentResponse,
  isConfidenceSufficient,
  requiresConfirmation,
  resolveTargetElement,
  isBBoxStale,
} from '@sih26171/protocol';
import { redactElements, verifyPrivacy, sanitizeBeforeSend } from '@sih26171/privacy';
import { computeSHA256, stripDataUrlPrefix, rankAndBudgetElements } from '@sih26171/perception';
import {
  classifyActionRisk,
  evaluateLocalPolicy,
  createApprovalBinding,
  transitionApprovalState,
} from '@sih26171/policy';
import type { ApprovalBinding } from '@sih26171/policy';

const api = (globalThis as any).chrome || (globalThis as any).browser;

// ─── State ───

let config: ExtensionConfig = { ...DEFAULT_CONFIG };
let auditLog: AuditLogEntry[] = [];
let isRunning = false;
let currentRequestId: string | null = null;
let stepCount = 0;
let lastHUDState: PrivacyHUDState | null = null;

// ─── Helpers ───

function generateRequestId(): string {
  return crypto.randomUUID();
}

function log(msg: string, data?: any): void {
  console.log(`[SIH26171:BG] ${msg}`, data || '');
}

function addAuditEntry(entry: AuditLogEntry): void {
  auditLog.push(entry);
  // Broadcast to popup/sidepanel if extension runtime is present
  if (api?.runtime?.sendMessage) {
    api.runtime.sendMessage({
      type: 'AUDIT_LOG_ENTRY',
      payload: entry,
      timestamp_ms: Date.now(),
    }).catch(() => { /* sidepanel may not be open */ });
  }
}

// ─── Load config from storage ───

async function loadConfig(): Promise<void> {
  try {
    const stored = await api.storage.local.get('agent_config');
    if (stored.agent_config) {
      config = { ...DEFAULT_CONFIG, ...stored.agent_config };
    }
  } catch {
    config = { ...DEFAULT_CONFIG };
  }
}

async function saveConfig(updates: Partial<ExtensionConfig>): Promise<void> {
  config = { ...config, ...updates };
  await api.storage.local.set({ agent_config: config });
}

// ─── Safe Screenshot Capture (local metadata only) ───

async function captureScreenshot(): Promise<{
  base64: string;
  info: ScreenshotInfo;
  capture_ms: number;
}> {
  const start = performance.now();
  try {
    const isChrome = !!api.runtime?.getManifest;
    const format = isChrome ? 'webp' : 'png';

    const dataUrl: string = await api.tabs.captureVisibleTab(undefined, {
      format,
      quality: config.screenshot_quality,
    });

    const base64 = stripDataUrlPrefix(dataUrl);
    const sha256 = await computeSHA256(base64);

    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: `image/${format}` });
    const bitmap = await createImageBitmap(blob);
    const width = bitmap.width;
    const height = bitmap.height;
    bitmap.close();

    const capture_ms = performance.now() - start;

    return {
      base64,
      info: {
        media_type: `image/${format}` as ScreenshotInfo['media_type'],
        width,
        height,
        quality: config.screenshot_quality,
        sha256,
      },
      capture_ms,
    };
  } catch (err) {
    // Fallback if URL is file:// without explicit permission or unsupported
    return {
      base64: '',
      info: {
        media_type: 'image/png' as ScreenshotInfo['media_type'],
        width: 1280,
        height: 720,
        quality: config.screenshot_quality,
        sha256: '0'.repeat(64),
      },
      capture_ms: performance.now() - start,
    };
  }
}

// ─── DOM Extraction (via content script) ───

async function requestDOMExtraction(tabId: number): Promise<{
  dom_context: DOMContext;
  viewport: ViewportInfo;
  extraction_ms: number;
  total_scanned: number;
  retained_count: number;
  dropped_count: number;
}> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('DOM extraction timed out')), 10_000);

    api.tabs.sendMessage(
      tabId,
      { type: 'SCAN_PAGE', payload: null, timestamp_ms: Date.now() },
      (response: any) => {
        clearTimeout(timeout);
        if (api.runtime.lastError) {
          reject(new Error(api.runtime.lastError.message));
          return;
        }
        if (response && response.payload) {
          resolve(response.payload);
        } else {
          reject(new Error('Empty response from content script'));
        }
      }
    );
  });
}

// ─── Execute Action (via content script) ───

async function requestActionExecution(
  tabId: number,
  action: ActionCommand
): Promise<{ success: boolean; error?: string; execution_ms: number }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Action execution timed out')), 15_000);

    api.tabs.sendMessage(
      tabId,
      {
        type: 'EXECUTE_ACTION',
        payload: action,
        timestamp_ms: Date.now(),
      },
      (response: any) => {
        clearTimeout(timeout);
        if (api.runtime.lastError) {
          reject(new Error(api.runtime.lastError.message));
          return;
        }
        if (response && response.payload) {
          resolve(response.payload);
        } else {
          resolve({ success: false, error: 'Empty execution response', execution_ms: 0 });
        }
      }
    );
  });
}

// ─── Risk Classification (Workstream 1 / Policy Package) ───
export { classifyActionRisk };

// ─── Local Deterministic Reasoner (Phase 1D requirement) ───

export function localDeterministicReasoner(
  taskGoal: string,
  elements: DOMElement[],
  requestId: string
): AgentResponse {
  const goalLower = taskGoal.toLowerCase();

  // Match Download Report button if goal mentions download, report, confidential, or quarterly
  if (
    goalLower.includes('download') ||
    goalLower.includes('report') ||
    goalLower.includes('confidential') ||
    goalLower.includes('quarterly')
  ) {
    const downloadEl = elements.find(
      el =>
        el.id === 'download-report' ||
        el.text.toLowerCase().includes('download report') ||
        (el.aria_label && el.aria_label.toLowerCase().includes('download report'))
    );

    if (downloadEl) {
      return {
        protocol_version: PROTOCOL_VERSION,
        request_id: requestId,
        status: 'ok',
        action: {
          type: 'click',
          target: {
            element_id: downloadEl.id,
            bbox: downloadEl.bbox,
            selector_hint: '#download-report',
            text_hint: downloadEl.text || 'Download Report',
          },
          arguments: {},
          confidence: 0.95,
          requires_confirmation: true, // Download Report is HIGH risk
        },
        next_observation: false,
        explanation: 'Local deterministic reasoner matched user goal to Download Report button.',
        server_metrics: {
          queue_ms: 0,
          inference_ms: 2,
          total_server_ms: 2,
          model: 'local-deterministic-reasoner',
        },
      };
    }
  }

  // Keyword matching against visible interactive elements
  for (const el of elements) {
    if (!el.visible || el.disabled) continue;
    const textLower = (el.text || '').toLowerCase();
    const ariaLower = (el.aria_label || '').toLowerCase();
    if (
      (textLower && goalLower.includes(textLower)) ||
      (ariaLower && goalLower.includes(ariaLower))
    ) {
      return {
        protocol_version: PROTOCOL_VERSION,
        request_id: requestId,
        status: 'ok',
        action: {
          type: 'click',
          target: {
            element_id: el.id,
            bbox: el.bbox,
            selector_hint: `[data-agent-id='${el.id}']`,
            text_hint: el.text.slice(0, 50),
          },
          arguments: {},
          confidence: 0.88,
          requires_confirmation: el.id === 'download-report',
        },
        next_observation: false,
        explanation: `Local reasoner matched element "${el.text.slice(0, 30)}"`,
        server_metrics: {
          queue_ms: 0,
          inference_ms: 2,
          total_server_ms: 2,
          model: 'local-deterministic-reasoner',
        },
      };
    }
  }

  // Fallback to first visible button
  const firstButton = elements.find(
    el => (el.role === 'button' || el.tag === 'button') && el.visible && !el.disabled
  );
  if (firstButton) {
    return {
      protocol_version: PROTOCOL_VERSION,
      request_id: requestId,
      status: 'ok',
      action: {
        type: 'click',
        target: {
          element_id: firstButton.id,
          bbox: firstButton.bbox,
          selector_hint: `[data-agent-id='${firstButton.id}']`,
          text_hint: firstButton.text.slice(0, 50),
        },
        arguments: {},
        confidence: 0.85,
        requires_confirmation: firstButton.id === 'download-report',
      },
      next_observation: false,
      explanation: `Local reasoner default: clicking "${firstButton.text.slice(0, 30)}"`,
      server_metrics: {
        queue_ms: 0,
        inference_ms: 2,
        total_server_ms: 2,
        model: 'local-deterministic-reasoner',
      },
    };
  }

  return {
    protocol_version: PROTOCOL_VERSION,
    request_id: requestId,
    status: 'ok',
    action: {
      type: 'observe',
      target: {
        element_id: 'none',
        bbox: { x: 0, y: 0, w: 0, h: 0 },
        selector_hint: '',
        text_hint: '',
      },
      arguments: {},
      confidence: 1.0,
      requires_confirmation: false,
    },
    next_observation: false,
    explanation: 'No actionable elements found. Observing.',
    server_metrics: {
      queue_ms: 0,
      inference_ms: 1,
      total_server_ms: 1,
      model: 'local-deterministic-reasoner',
    },
  };
}

// ─── Page Scanner & Privacy HUD Flow (Phase 1C) ───

async function handleScanPage(): Promise<PrivacyHUDState> {
  const tabs = await api.tabs.query({ active: true, currentWindow: true });
  let tabId = tabs[0]?.id;
  if (!tabId) {
    const allTabs = await api.tabs.query({ active: true });
    tabId = allTabs[0]?.id;
  }

  if (!tabId) {
    throw new Error('No active browser tab found');
  }

  const domResult = await requestDOMExtraction(tabId);

  // Run privacy firewall pre-flight scan
  const sanitizeResult = sanitizeBeforeSend({
    dom: domResult.dom_context,
    screenshot: {
      base64: '',
      info: {
        media_type: 'image/png',
        width: domResult.viewport?.width || 1280,
        height: domResult.viewport?.height || 720,
        quality: 65,
        sha256: '0'.repeat(64),
      },
      capture_ms: 0,
    },
    task: { goal: 'scan active page', allowed_actions: ['click'], max_steps: 1 },
    viewport: domResult.viewport,
    requestId: generateRequestId(),
    config,
  });

  // Calculate sensitive items by category
  const counts: Record<string, number> = {};
  for (const r of sanitizeResult.redactions) {
    counts[r.category] = (counts[r.category] || 0) + 1;
  }

  const hudState: PrivacyHUDState = {
    firewall_status: sanitizeResult.verified ? 'PASS' : 'BLOCKED',
    reasoner_mode: 'Local deterministic reasoner — demo mode',
    sensitive_counts: counts,
    total_sensitive: sanitizeResult.redactions.length,
    raw_dom_values_sent: 'NO',
    raw_screenshot_pixels_sent: 'NO',
    cookies_storage_passwords_sent: 'NO',
    retained_elements: domResult.retained_count ?? domResult.dom_context.elements.length,
    dropped_elements: domResult.dropped_count ?? 0,
    total_elements_scanned: domResult.total_scanned ?? domResult.dom_context.elements.length,
    last_scan_ms: Math.round(sanitizeResult.detection_ms + sanitizeResult.redaction_ms),
  };

  lastHUDState = hudState;

  // Broadcast HUD update to UI
  api.runtime.sendMessage({
    type: 'PRIVACY_HUD_UPDATE',
    payload: hudState,
    timestamp_ms: Date.now(),
  }).catch(() => {});

  // Add audit log event without secret values
  addAuditEntry({
    id: crypto.randomUUID(),
    timestamp_ms: Date.now(),
    request_id: crypto.randomUUID(),
    action_type: 'observe',
    target_element_id: 'page_scan',
    confidence: 1.0,
    result: 'executed',
    risk_level: 'LOW',
  });

  return hudState;
}

// ─── Confirmation Request (Approval Flow Phase 1E & Workstream 2) ───

async function requestApproval(
  action: ActionCommand,
  riskLevel: RiskLevel,
  reason: string,
  binding?: ApprovalBinding
): Promise<boolean> {
  return new Promise((resolve) => {
    const listener = (message: InternalMessage) => {
      if (message.type === 'CONFIRMATION_RESPONSE') {
        api.runtime.onMessage.removeListener(listener);
        const payload = message.payload as any;
        if (binding) {
          const transResult = transitionApprovalState(binding, {
            type: 'SUBMIT_APPROVAL',
            message: {
              commandId: payload?.command_id || binding.commandId,
              targetFingerprint: payload?.target_fingerprint || binding.targetFingerprint,
              tabId: binding.tabId,
              confirmed: !!payload?.confirmed,
              trustedSessionToken: payload?.trusted_session_token || binding.trustedSessionToken,
            },
          });
          resolve(transResult.success && transResult.nextState === 'APPROVED');
        } else {
          resolve(!!payload?.confirmed);
        }
      }
    };

    api.runtime.onMessage.addListener(listener);

    // Broadcast approval request with explicit risk metadata and binding info
    api.runtime.sendMessage({
      type: 'CONFIRMATION_REQUEST',
      payload: {
        action,
        risk_level: riskLevel,
        reason,
        target_label: action.target.text_hint || action.target.element_id,
        command_id: binding?.commandId,
        target_fingerprint: binding?.targetFingerprint,
        trusted_session_token: binding?.trustedSessionToken,
      },
      timestamp_ms: Date.now(),
    }).catch(() => {
      api.runtime.onMessage.removeListener(listener);
      resolve(false);
    });

    // Auto-reject after 60 seconds
    setTimeout(() => {
      api.runtime.onMessage.removeListener(listener);
      if (binding) {
        transitionApprovalState(binding, { type: 'TIMEOUT' });
      }
      resolve(false);
    }, 60_000);
  });
}

// ─── Server Transport / Mock Dispatch ───

async function dispatchReasoning(
  request: AgentRequest,
  task: TaskSpec
): Promise<AgentResponse> {
  if (config.mock_mode) {
    // Local deterministic reasoner — completely local, zero network dispatch
    await new Promise(resolve => setTimeout(resolve, 30));
    return localDeterministicReasoner(task.goal, request.dom_context.elements, request.request_id);
  }

  const response = await fetch(config.server_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

// ─── Main Agent Loop ───

async function runAgentLoop(task: TaskSpec): Promise<void> {
  if (isRunning) {
    log('Agent loop already running');
    return;
  }

  isRunning = true;
  stepCount = 0;

  try {
    await loadConfig();

    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active browser tab found');
    const tabId = tab.id;

    let continueLoop = true;

    while (continueLoop && stepCount < task.max_steps) {
      stepCount++;
      const requestId = generateRequestId();
      currentRequestId = requestId;

      log(`Step ${stepCount}/${task.max_steps}: ${requestId}`);

      api.runtime.sendMessage({
        type: 'TASK_STATUS',
        payload: {
          step: stepCount,
          max_steps: task.max_steps,
          status: 'capturing',
          request_id: requestId,
        },
        timestamp_ms: Date.now(),
      }).catch(() => {});

      // 1. Capture screenshot (local only)
      const screenshotResult = await captureScreenshot();

      // 2. Extract DOM (aria-hidden filtered, no raw passwords)
      const domResult = await requestDOMExtraction(tabId);

      // 3. Run Privacy Firewall & sanitize before dispatch
      const sanitizeResult = sanitizeBeforeSend({
        dom: domResult.dom_context,
        screenshot: screenshotResult,
        task,
        viewport: domResult.viewport,
        requestId,
        config,
      });

      // Update HUD
      const counts: Record<string, number> = {};
      for (const r of sanitizeResult.redactions) {
        counts[r.category] = (counts[r.category] || 0) + 1;
      }
      const currentHUD: PrivacyHUDState = {
        firewall_status: sanitizeResult.verified ? 'PASS' : 'BLOCKED',
        reasoner_mode: 'Local deterministic reasoner — demo mode',
        sensitive_counts: counts,
        total_sensitive: sanitizeResult.redactions.length,
        raw_dom_values_sent: 'NO',
        raw_screenshot_pixels_sent: 'NO',
        cookies_storage_passwords_sent: 'NO',
        retained_elements: domResult.retained_count ?? domResult.dom_context.elements.length,
        dropped_elements: domResult.dropped_count ?? 0,
        total_elements_scanned: domResult.total_scanned ?? domResult.dom_context.elements.length,
        last_scan_ms: Math.round(sanitizeResult.detection_ms + sanitizeResult.redaction_ms),
      };
      api.runtime.sendMessage({
        type: 'PRIVACY_HUD_UPDATE',
        payload: currentHUD,
        timestamp_ms: Date.now(),
      }).catch(() => {});

      // 4. Fail-closed check
      if (!sanitizeResult.verified) {
        log('⛔ Privacy verification FAILED — blocking action');
        addAuditEntry({
          id: crypto.randomUUID(),
          timestamp_ms: Date.now(),
          request_id: requestId,
          action_type: 'observe',
          target_element_id: '',
          confidence: 0,
          result: 'rejected',
          risk_level: 'HIGH',
          error_message: 'Privacy verification failed: secret exposure blocked',
        });
        throw new Error('Privacy verification failed');
      }

      // 4b. Workstream 3: Context Ranking & Payload Budgeting
      const budgeted = rankAndBudgetElements(
        sanitizeResult.payload.dom_context.elements,
        sanitizeResult.payload.dom_context.page_title,
        {
          maxElements: config.max_elements || 40,
          maxPayloadBytes: 32 * 1024,
          taskGoal: task.goal,
          preserveTargetIds: ['download-report'],
        }
      );

      if (budgeted.status === 'target_context_unavailable') {
        log(`⛔ Payload budget failed closed: ${budgeted.error}`);
        addAuditEntry({
          id: crypto.randomUUID(),
          timestamp_ms: Date.now(),
          request_id: requestId,
          action_type: 'observe',
          target_element_id: '',
          confidence: 0,
          result: 'rejected',
          risk_level: 'HIGH',
          error_message: budgeted.error || 'Target context unavailable due to payload budget',
        });
        throw new Error(budgeted.error || 'Target context unavailable');
      }

      sanitizeResult.payload.dom_context = budgeted.context;
      sanitizeResult.payload.payload_budget = {
        context_truncated: budgeted.context_truncated,
        original_element_count: budgeted.original_element_count,
        retained_element_count: budgeted.retained_element_count,
        dropped_element_count: budgeted.dropped_element_count,
        serialized_payload_bytes: budgeted.serialized_payload_bytes,
        max_payload_bytes: budgeted.max_payload_bytes,
      };

      const agentRequest: AgentRequest = sanitizeResult.payload;

      // 5. Reason centrally or locally
      api.runtime.sendMessage({
        type: 'TASK_STATUS',
        payload: { step: stepCount, max_steps: task.max_steps, status: 'sending', request_id: requestId },
        timestamp_ms: Date.now(),
      }).catch(() => {});

      let response: AgentResponse;
      try {
        response = await dispatchReasoning(agentRequest, task);
      } catch (err) {
        addAuditEntry({
          id: crypto.randomUUID(),
          timestamp_ms: Date.now(),
          request_id: requestId,
          action_type: 'observe',
          target_element_id: '',
          confidence: 0,
          result: 'error',
          error_message: err instanceof Error ? err.message : String(err),
        });
        continueLoop = false;
        break;
      }

      // 6. Validate response schema & constraints
      const validation = validateAgentResponse(response);
      if (!validation.valid) {
        log('⛔ Agent response invalid', validation.errors);
        addAuditEntry({
          id: crypto.randomUUID(),
          timestamp_ms: Date.now(),
          request_id: requestId,
          action_type: response?.action?.type || 'observe',
          target_element_id: response?.action?.target?.element_id || '',
          confidence: response?.action?.confidence || 0,
          result: 'rejected',
          error_message: `Validation failed: ${validation.errors.join(', ')}`,
        });
        continueLoop = false;
        break;
      }

      const action = response.action;

      // 7. Confidence gating
      if (!isConfidenceSufficient(action, config.confidence_threshold)) {
        log(`⛔ Low confidence: ${action.confidence} < ${config.confidence_threshold}`);
        addAuditEntry({
          id: crypto.randomUUID(),
          timestamp_ms: Date.now(),
          request_id: requestId,
          action_type: action.type,
          target_element_id: action.target.element_id,
          confidence: action.confidence,
          result: 'rejected',
          error_message: `Confidence ${action.confidence} below threshold ${config.confidence_threshold}`,
        });
        continueLoop = false;
        break;
      }

      // 8. Risk classification & Formal Approval Flow (Workstreams 1 & 2)
      const policyResult = evaluateLocalPolicy(action);
      const riskLevel = policyResult.riskLevel;

      if (policyResult.blocked) {
        log(`⛔ Action BLOCKED by policy: ${policyResult.reason}`);
        addAuditEntry({
          id: crypto.randomUUID(),
          timestamp_ms: Date.now(),
          request_id: requestId,
          action_type: action.type,
          target_element_id: action.target.element_id,
          confidence: action.confidence,
          result: 'rejected',
          risk_level: 'BLOCKED',
          error_message: policyResult.reason,
        });
        continueLoop = false;
        break;
      }

      if (policyResult.requiresApproval || action.requires_confirmation) {
        log(`⚠️ Approval required for ${action.type} (Risk: ${riskLevel})`);

        api.runtime.sendMessage({
          type: 'TASK_STATUS',
          payload: {
            step: stepCount,
            max_steps: task.max_steps,
            status: 'awaiting_confirmation',
            request_id: requestId,
          },
          timestamp_ms: Date.now(),
        }).catch(() => {});

        const sessionToken = crypto.randomUUID();
        const binding = createApprovalBinding({
          commandId: requestId,
          action,
          riskLevel,
          tabId,
          trustedSessionToken: sessionToken,
        });

        const confirmed = await requestApproval(action, riskLevel, policyResult.reason, binding);

        if (!confirmed || binding.state !== 'APPROVED') {
          log('⛔ User cancelled or approval rejected');
          addAuditEntry({
            id: crypto.randomUUID(),
            timestamp_ms: Date.now(),
            request_id: requestId,
            action_type: action.type,
            target_element_id: action.target.element_id,
            confidence: action.confidence,
            result: 'rejected',
            risk_level: riskLevel,
            error_message: binding.reason || 'User cancelled action',
          });
          continueLoop = false;
          break;
        }

        addAuditEntry({
          id: crypto.randomUUID(),
          timestamp_ms: Date.now(),
          request_id: requestId,
          action_type: action.type,
          target_element_id: action.target.element_id,
          confidence: action.confidence,
          result: 'confirmed',
          risk_level: riskLevel,
        });
      }

      // 9. Safe execution via content script (Phase 1F)
      if (action.type === 'wait' || action.type === 'observe') {
        addAuditEntry({
          id: crypto.randomUUID(),
          timestamp_ms: Date.now(),
          request_id: requestId,
          action_type: action.type,
          target_element_id: '',
          confidence: action.confidence,
          result: 'executed',
          risk_level: risk.risk_level,
        });
      } else {
        api.runtime.sendMessage({
          type: 'TASK_STATUS',
          payload: { step: stepCount, max_steps: task.max_steps, status: 'executing', request_id: requestId },
          timestamp_ms: Date.now(),
        }).catch(() => {});

        const execResult = await requestActionExecution(tabId, action);
        if (execResult.success) {
          log(`✅ Action executed safely in ${execResult.execution_ms.toFixed(1)}ms`);
          addAuditEntry({
            id: crypto.randomUUID(),
            timestamp_ms: Date.now(),
            request_id: requestId,
            action_type: action.type,
            target_element_id: action.target.element_id,
            confidence: action.confidence,
            result: 'executed',
            risk_level: risk.risk_level,
          });
        } else {
          log(`❌ Action execution rejected: ${execResult.error}`);
          addAuditEntry({
            id: crypto.randomUUID(),
            timestamp_ms: Date.now(),
            request_id: requestId,
            action_type: action.type,
            target_element_id: action.target.element_id,
            confidence: action.confidence,
            result: 'error',
            risk_level: risk.risk_level,
            error_message: execResult.error,
          });
          continueLoop = false;
        }
      }

      continueLoop = continueLoop && response.next_observation;
    }

    log(`Agent loop complete. Steps: ${stepCount}`);
    api.runtime.sendMessage({
      type: 'TASK_STATUS',
      payload: { step: stepCount, max_steps: task.max_steps, status: 'complete', request_id: currentRequestId },
      timestamp_ms: Date.now(),
    }).catch(() => {});
  } catch (err) {
    log('Agent loop error', err);
    api.runtime.sendMessage({
      type: 'TASK_STATUS',
      payload: {
        step: stepCount,
        max_steps: task.max_steps,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      },
      timestamp_ms: Date.now(),
    }).catch(() => {});
  } finally {
    isRunning = false;
    currentRequestId = null;
  }
}

// ─── Message Router ───

if (api?.runtime?.onMessage) {
  api.runtime.onMessage.addListener(
    (message: InternalMessage, _sender: any, sendResponse: (resp: any) => void) => {
      switch (message.type) {
        case 'SCAN_PAGE': {
          handleScanPage()
            .then(hud => sendResponse({ ok: true, hud }))
            .catch(err => sendResponse({ ok: false, error: err.message }));
          return true;
        }

        case 'TASK_START': {
          const task = message.payload as TaskSpec;
          runAgentLoop(task).catch(err => log('Unhandled error in agent loop', err));
          sendResponse({ ok: true });
          return true;
        }

        case 'SETTINGS_UPDATE': {
          const updates = message.payload as Partial<ExtensionConfig>;
          saveConfig(updates).then(() => sendResponse({ ok: true }));
          return true;
        }

        case 'AUDIT_LOG_ENTRY': {
          sendResponse({ entries: auditLog });
          return true;
        }

        default:
          return false;
      }
    }
  );
}

// Initialize
if (api?.storage) {
  loadConfig().then(() => {
    log('Background service worker initialized (Phase 1 Vertical Slice Ready)');
  });
}
