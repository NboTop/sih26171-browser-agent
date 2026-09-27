// ─── apps/extension/src/popup/popup.ts ───
// Popup UI logic: task input, status display, confirmation handling, audit log.

import type {
  TaskSpec,
  ActionType,
  InternalMessage,
  AuditLogEntry,
  ExtensionConfig,
  ActionCommand,
} from '@sih26171/protocol';
import { ALLOWED_ACTION_TYPES, DEFAULT_CONFIG } from '@sih26171/protocol';

const api = (globalThis as any).chrome || (globalThis as any).browser;

// ─── DOM Elements ───
const taskGoalEl = document.getElementById('task-goal') as HTMLTextAreaElement;
const maxStepsEl = document.getElementById('max-steps') as HTMLInputElement;
const runBtn = document.getElementById('run-btn') as HTMLButtonElement;
const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;
const statusSection = document.getElementById('status-section') as HTMLElement;
const statusText = document.getElementById('status-text') as HTMLElement;
const stepCounter = document.getElementById('step-counter') as HTMLElement;
const progressFill = document.getElementById('progress-fill') as HTMLElement;
const confirmationSection = document.getElementById('confirmation-section') as HTMLElement;
const confirmationText = document.getElementById('confirmation-text') as HTMLElement;
const confirmYes = document.getElementById('confirm-yes') as HTMLButtonElement;
const confirmNo = document.getElementById('confirm-no') as HTMLButtonElement;
const serverEndpoint = document.getElementById('server-endpoint') as HTMLInputElement;
const mockModeEl = document.getElementById('mock-mode') as HTMLInputElement;
const confidenceThreshold = document.getElementById('confidence-threshold') as HTMLInputElement;
const confidenceValue = document.getElementById('confidence-value') as HTMLElement;
const saveSettingsBtn = document.getElementById('save-settings') as HTMLButtonElement;
const logCountEl = document.getElementById('log-count') as HTMLElement;
const auditLogEl = document.getElementById('audit-log') as HTMLElement;
const openSidepanel = document.getElementById('open-sidepanel') as HTMLAnchorElement;

// ─── State ───
let isRunning = false;

// ─── Load settings ───
async function loadSettings(): Promise<void> {
  try {
    const stored = await api.storage.local.get('agent_config');
    const config = { ...DEFAULT_CONFIG, ...(stored.agent_config || {}) };
    serverEndpoint.value = config.server_endpoint;
    mockModeEl.checked = config.mock_mode;
    confidenceThreshold.value = String(Math.round(config.confidence_threshold * 100));
    confidenceValue.textContent = config.confidence_threshold.toFixed(2);
  } catch {
    // defaults are fine
  }
}

// ─── Run Agent ───
runBtn.addEventListener('click', () => {
  const goal = taskGoalEl.value.trim();
  if (!goal) {
    taskGoalEl.focus();
    return;
  }

  const task: TaskSpec = {
    goal,
    allowed_actions: [...ALLOWED_ACTION_TYPES] as ActionType[],
    max_steps: parseInt(maxStepsEl.value, 10) || 5,
  };

  isRunning = true;
  runBtn.disabled = true;
  stopBtn.disabled = false;
  statusSection.style.display = 'block';
  statusText.textContent = 'Starting…';

  api.runtime.sendMessage({
    type: 'TASK_START',
    payload: task,
    timestamp_ms: Date.now(),
  });
});

// ─── Stop Agent ───
stopBtn.addEventListener('click', () => {
  isRunning = false;
  runBtn.disabled = false;
  stopBtn.disabled = true;
  statusText.textContent = 'Stopped';
  // Note: actual cancellation would need a cancel message to background
});

// ─── Settings ───
confidenceThreshold.addEventListener('input', () => {
  const val = parseInt(confidenceThreshold.value, 10) / 100;
  confidenceValue.textContent = val.toFixed(2);
});

saveSettingsBtn.addEventListener('click', () => {
  const updates: Partial<ExtensionConfig> = {
    server_endpoint: serverEndpoint.value,
    mock_mode: mockModeEl.checked,
    confidence_threshold: parseInt(confidenceThreshold.value, 10) / 100,
  };

  api.runtime.sendMessage({
    type: 'SETTINGS_UPDATE',
    payload: updates,
    timestamp_ms: Date.now(),
  });

  saveSettingsBtn.textContent = '✓ Saved!';
  setTimeout(() => { saveSettingsBtn.textContent = 'Save Settings'; }, 1500);
});

// ─── Side Panel ───
openSidepanel.addEventListener('click', (e) => {
  e.preventDefault();
  if (api.sidePanel) {
    api.sidePanel.open({ windowId: undefined });
  }
});

// ─── Audit Log Rendering ───
function renderLogEntry(entry: AuditLogEntry): void {
  const div = document.createElement('div');
  div.className = 'log-entry';

  const time = new Date(entry.timestamp_ms).toLocaleTimeString();
  const resultClass = `result-${entry.result}`;

  div.innerHTML = `
    <span>${time}</span>
    <span>${entry.action_type}</span>
    <span>${entry.target_element_id || '–'}</span>
    <span class="result-badge ${resultClass}">${entry.result}</span>
    <span>${entry.confidence.toFixed(2)}</span>
  `;

  auditLogEl.prepend(div);
  logCountEl.textContent = String(parseInt(logCountEl.textContent || '0', 10) + 1);
}

// ─── Message Listener ───
api.runtime.onMessage.addListener((message: InternalMessage) => {
  switch (message.type) {
    case 'TASK_STATUS': {
      const p = message.payload as any;
      statusSection.style.display = 'block';

      const statusLabels: Record<string, string> = {
        capturing: '📸 Capturing page…',
        sending: '📡 Sending to server…',
        executing: '⚡ Executing action…',
        awaiting_confirmation: '⚠️ Awaiting confirmation…',
        needs_user_input: '✋ Needs your input',
        complete: '✅ Complete',
        error: `❌ Error: ${p.error || ''}`,
      };

      statusText.textContent = statusLabels[p.status] || p.status;
      stepCounter.textContent = `${p.step}/${p.max_steps}`;
      progressFill.style.width = `${(p.step / p.max_steps) * 100}%`;

      if (p.status === 'complete' || p.status === 'error') {
        isRunning = false;
        runBtn.disabled = false;
        stopBtn.disabled = true;
      }
      break;
    }

    case 'CONFIRMATION_REQUEST': {
      const { action, explanation } = message.payload as {
        action: ActionCommand;
        explanation: string;
      };
      confirmationSection.style.display = 'block';
      confirmationText.textContent =
        `Action: ${action.type} on "${action.target.text_hint}"\n` +
        `Confidence: ${action.confidence.toFixed(2)}\n` +
        `${explanation}`;
      break;
    }

    case 'AUDIT_LOG_ENTRY': {
      renderLogEntry(message.payload as AuditLogEntry);
      break;
    }
  }
});

// ─── Confirmation buttons ───
confirmYes.addEventListener('click', () => {
  api.runtime.sendMessage({
    type: 'CONFIRMATION_RESPONSE',
    payload: { confirmed: true },
    timestamp_ms: Date.now(),
  });
  confirmationSection.style.display = 'none';
});

confirmNo.addEventListener('click', () => {
  api.runtime.sendMessage({
    type: 'CONFIRMATION_RESPONSE',
    payload: { confirmed: false },
    timestamp_ms: Date.now(),
  });
  confirmationSection.style.display = 'none';
});

// ─── Init ───
loadSettings();
