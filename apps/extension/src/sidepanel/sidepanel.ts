// ─── apps/extension/src/sidepanel/sidepanel.ts ───
// Side panel UI for PrivacySight Agent.
// Features:
//   1. Page Scanner & Privacy HUD (firewall status, zero-transmission guarantees, element counts, PII breakdown)
//   2. Local deterministic reasoner task flow
//   3. High-Risk Action Approval Card with explicit "Approve and execute" and "Cancel"
//   4. Sanitized audit logging (zero secrets)

import type {
  TaskSpec,
  ActionType,
  InternalMessage,
  AuditLogEntry,
  ActionCommand,
  PrivacyHUDState,
  RiskLevel,
} from '@sih26171/protocol';
import { ALLOWED_ACTION_TYPES } from '@sih26171/protocol';

const api = (globalThis as any).chrome || (globalThis as any).browser;

// ─── DOM References ───

// Scanner
const scanBtn = document.getElementById('sp-scan-btn') as HTMLButtonElement;
const scanMeta = document.getElementById('sp-scan-meta') as HTMLElement;

// Privacy HUD
const firewallStatusEl = document.getElementById('sp-firewall-status') as HTMLElement;
const hudRawDomEl = document.getElementById('sp-hud-raw-dom') as HTMLElement;
const hudRawPixelsEl = document.getElementById('sp-hud-raw-pixels') as HTMLElement;
const hudSecretsEl = document.getElementById('sp-hud-secrets') as HTMLElement;
const retainedCountEl = document.getElementById('sp-retained-count') as HTMLElement;
const droppedCountEl = document.getElementById('sp-dropped-count') as HTMLElement;
const scannedCountEl = document.getElementById('sp-scanned-count') as HTMLElement;
const sensitiveTotalEl = document.getElementById('sp-sensitive-total') as HTMLElement;
const sensitiveTagsEl = document.getElementById('sp-sensitive-tags') as HTMLElement;

// Task Flow
const taskGoalEl = document.getElementById('sp-task-goal') as HTMLTextAreaElement;
const runBtn = document.getElementById('sp-run-btn') as HTMLButtonElement;
const stopBtn = document.getElementById('sp-stop-btn') as HTMLButtonElement;

// Status & Progress
const statusSection = document.getElementById('sp-status-section') as HTMLElement;
const statusText = document.getElementById('sp-status-text') as HTMLElement;
const stepCounter = document.getElementById('sp-step-counter') as HTMLElement;
const progressFill = document.getElementById('sp-progress-fill') as HTMLElement;

// Approval Card
const approvalSection = document.getElementById('sp-approval-section') as HTMLElement;
const approvalActionEl = document.getElementById('sp-approval-action') as HTMLElement;
const approvalTargetEl = document.getElementById('sp-approval-target') as HTMLElement;
const approvalRiskEl = document.getElementById('sp-approval-risk') as HTMLElement;
const approvalReasonEl = document.getElementById('sp-approval-reason') as HTMLElement;
const approveBtn = document.getElementById('sp-approve-btn') as HTMLButtonElement;
const cancelBtn = document.getElementById('sp-cancel-btn') as HTMLButtonElement;

// Audit Log
const logCountEl = document.getElementById('sp-log-count') as HTMLElement;
const auditLogEl = document.getElementById('sp-audit-log') as HTMLElement;

// ─── Update Privacy HUD ───

function updatePrivacyHUD(hud: PrivacyHUDState): void {
  // Firewall Status
  firewallStatusEl.textContent = hud.firewall_status;
  if (hud.firewall_status === 'PASS') {
    firewallStatusEl.className = 'badge-firewall badge-firewall-pass';
  } else {
    firewallStatusEl.className = 'badge-firewall badge-firewall-blocked';
  }

  // Guarantees
  hudRawDomEl.textContent = hud.raw_dom_values_sent;
  hudRawPixelsEl.textContent = hud.raw_screenshot_pixels_sent;
  hudSecretsEl.textContent = hud.cookies_storage_passwords_sent;

  // Counts
  retainedCountEl.textContent = String(hud.retained_elements);
  droppedCountEl.textContent = String(hud.dropped_elements);
  scannedCountEl.textContent = String(hud.total_elements_scanned);

  // Sensitive items
  sensitiveTotalEl.textContent = `${hud.total_sensitive} item${hud.total_sensitive === 1 ? '' : 's'}`;
  sensitiveTagsEl.innerHTML = '';

  const entries = Object.entries(hud.sensitive_counts);
  if (entries.length === 0) {
    sensitiveTagsEl.innerHTML = '<span class="empty-sensitive-hint">No sensitive items found in active viewport</span>';
  } else {
    for (const [cat, count] of entries) {
      const badge = document.createElement('span');
      badge.className = 'sensitive-badge';
      const prettyCat = cat.replace(/_/g, ' ');
      badge.innerHTML = `<span>${prettyCat}</span><span class="badge-count">${count}</span>`;
      sensitiveTagsEl.appendChild(badge);
    }
  }

  if (hud.last_scan_ms !== undefined) {
    scanMeta.textContent = `Scanned in ${hud.last_scan_ms}ms • DOM verified safe`;
  }
}

// ─── Scan Page Action ───

scanBtn.addEventListener('click', () => {
  scanBtn.disabled = true;
  scanMeta.textContent = 'Scanning active tab DOM & accessibility tree…';

  api.runtime.sendMessage({ type: 'SCAN_PAGE', payload: null, timestamp_ms: Date.now() }, (response: any) => {
    scanBtn.disabled = false;
    if (api.runtime.lastError) {
      scanMeta.textContent = `Scan failed: ${api.runtime.lastError.message}`;
      return;
    }
    if (response && response.hud) {
      updatePrivacyHUD(response.hud as PrivacyHUDState);
    } else if (response && response.error) {
      scanMeta.textContent = `Scan error: ${response.error}`;
    }
  });
});

// ─── Run Task Action ───

runBtn.addEventListener('click', () => {
  const goal = taskGoalEl.value.trim();
  if (!goal) {
    taskGoalEl.focus();
    return;
  }

  const task: TaskSpec = {
    goal,
    allowed_actions: [...ALLOWED_ACTION_TYPES] as ActionType[],
    max_steps: 3,
  };

  runBtn.disabled = true;
  stopBtn.disabled = false;
  approvalSection.style.display = 'none';
  statusSection.style.display = 'block';
  statusText.textContent = 'Starting…';

  api.runtime.sendMessage({
    type: 'TASK_START',
    payload: task,
    timestamp_ms: Date.now(),
  });
});

stopBtn.addEventListener('click', () => {
  runBtn.disabled = false;
  stopBtn.disabled = true;
  statusText.textContent = 'Stopped';
  approvalSection.style.display = 'none';
});

// ─── Approval Actions ───

let activeConfirmationPayload: {
  command_id?: string;
  target_fingerprint?: string;
  trusted_session_token?: string;
} | null = null;

approveBtn.addEventListener('click', () => {
  approvalSection.style.display = 'none';
  statusText.textContent = '⚡ Approved: Executing action…';
  api.runtime.sendMessage({
    type: 'CONFIRMATION_RESPONSE',
    payload: {
      confirmed: true,
      command_id: activeConfirmationPayload?.command_id,
      target_fingerprint: activeConfirmationPayload?.target_fingerprint,
      trusted_session_token: activeConfirmationPayload?.trusted_session_token,
    },
    timestamp_ms: Date.now(),
  });
  activeConfirmationPayload = null;
});

cancelBtn.addEventListener('click', () => {
  approvalSection.style.display = 'none';
  runBtn.disabled = false;
  stopBtn.disabled = true;
  statusText.textContent = '⛔ Action cancelled by user';
  api.runtime.sendMessage({
    type: 'CONFIRMATION_RESPONSE',
    payload: {
      confirmed: false,
      command_id: activeConfirmationPayload?.command_id,
      target_fingerprint: activeConfirmationPayload?.target_fingerprint,
      trusted_session_token: activeConfirmationPayload?.trusted_session_token,
    },
    timestamp_ms: Date.now(),
  });
  activeConfirmationPayload = null;
});

// ─── Render Audit Log Entry (Zero Secrets) ───

function renderLogEntry(entry: AuditLogEntry): void {
  const div = document.createElement('div');
  div.className = 'log-entry';
  const time = new Date(entry.timestamp_ms).toLocaleTimeString();
  const risk = entry.risk_level || 'LOW';
  div.innerHTML = `
    <span>${time}</span>
    <span>${entry.action_type}</span>
    <span class="highlight-target">${entry.target_element_id || '–'}</span>
    <span class="result-badge result-${entry.result}">${entry.result}</span>
    <span class="badge-risk-${risk.toLowerCase()}">${risk}</span>
  `;
  auditLogEl.prepend(div);
  logCountEl.textContent = String(parseInt(logCountEl.textContent || '0', 10) + 1);
}

// ─── Message Listener ───

api.runtime.onMessage.addListener((message: InternalMessage) => {
  switch (message.type) {
    case 'PRIVACY_HUD_UPDATE': {
      updatePrivacyHUD(message.payload as PrivacyHUDState);
      break;
    }

    case 'TASK_STATUS': {
      const p = message.payload as any;
      statusSection.style.display = 'block';
      const labels: Record<string, string> = {
        capturing: '📸 Capturing DOM & page…',
        sending: '🛡️ Local reasoner evaluating…',
        executing: '⚡ Executing safe action…',
        awaiting_confirmation: '⚠️ Awaiting human approval…',
        complete: '✅ Task completed',
        error: `❌ ${p.error || 'Execution stopped'}`,
      };
      statusText.textContent = labels[p.status] || p.status;
      stepCounter.textContent = `${p.step}/${p.max_steps}`;
      progressFill.style.width = `${(p.step / p.max_steps) * 100}%`;
      if (p.status === 'complete' || p.status === 'error') {
        runBtn.disabled = false;
        stopBtn.disabled = true;
      }
      break;
    }

    case 'CONFIRMATION_REQUEST': {
      const payload = message.payload as {
        action: ActionCommand;
        risk_level?: RiskLevel;
        reason?: string;
        target_label?: string;
        explanation?: string;
        command_id?: string;
        target_fingerprint?: string;
        trusted_session_token?: string;
      };

      activeConfirmationPayload = {
        command_id: payload.command_id,
        target_fingerprint: payload.target_fingerprint,
        trusted_session_token: payload.trusted_session_token,
      };

      const risk = payload.risk_level || 'HIGH';
      const reason = payload.reason || payload.explanation || 'This action may create a file.';
      const target = payload.target_label || payload.action.target.text_hint || payload.action.target.element_id;

      approvalActionEl.textContent = payload.action.type;
      approvalTargetEl.textContent = target;
      approvalRiskEl.textContent = risk;
      approvalReasonEl.textContent = reason;

      approvalSection.style.display = 'block';
      statusText.textContent = '⚠️ High-risk confirmation required';
      break;
    }

    case 'AUDIT_LOG_ENTRY':
      renderLogEntry(message.payload as AuditLogEntry);
      break;
  }
});

// Auto-scan on panel load
setTimeout(() => {
  api.runtime.sendMessage({ type: 'SCAN_PAGE', payload: null, timestamp_ms: Date.now() }, (response: any) => {
    if (response && response.hud) {
      updatePrivacyHUD(response.hud as PrivacyHUDState);
    }
  });
}, 300);
