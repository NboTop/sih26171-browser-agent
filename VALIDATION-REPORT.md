# PrivacySight Agent — Validation Report
**Project:** SIH26171 — On-device Visual Perception for Lightweight Browser Agents  
**Tagline:** Perceive locally. Protect locally. Reason centrally.  
**Date:** September 2026 (Phase 2 Hardened Release Candidate)  
**Build Environment:** Windows, Node.js v24.21.0, npm 11.19.0, TypeScript 5.5.4, Vitest 2.1.9  
**Installed Chrome Binary:** `C:\Program Files\Google\Chrome\Application\chrome.exe`  
**Evaluation Scope:** Synthetic Fixture & Automated Testbed (Headless / Unit / Integration / Live Chrome CDP)

---

## 1. Documentation Invariants & Required Compliance Statements

To maintain strict scientific accuracy and transparency:
1. **“Live Chrome validation completed on the seeded synthetic fixture; this does not establish arbitrary-website support.”**
2. **“Zero screenshot-pixel transmission in the MVP.”**
3. **“Pixel-level screenshot redaction is planned, not implemented.”**
4. **“96.8% is a synthetic-fixture evaluation score.”**
5. **“External repositories were studied, not integrated.”**

---

## 2. Build Verification

- **Build Command:** `npm run build`
- **Result:** **Success (Exit Code 0 across all 6 workspaces)**
- **Compiled Workspaces:**
  1. `@sih26171/protocol` → `tsc -p tsconfig.json` (compiled to `dist/`) [automated-tested]
  2. `@sih26171/privacy` → `tsc -p tsconfig.json` (compiled to `dist/`) [automated-tested]
  3. `@sih26171/perception` → `tsc -p tsconfig.json` (compiled to `dist/`) [automated-tested]
  4. `@sih26171/policy` → `tsc -p tsconfig.json` (compiled to `dist/`) [automated-tested]
  5. `@sih26171/evaluation` → `tsc -p tsconfig.json` (compiled to `dist/`) [automated-tested]
  6. `@sih26171/server` → `tsc -p tsconfig.json` (compiled to `dist/`) [automated-tested]
  7. `@sih26171/extension`:
     - Chrome MV3 Variant B target → `node scripts/build.mjs --target chrome` (bundled to `apps/extension/dist/chrome`) [manually validated & automated-tested]
     - Firefox MV3 target → `node scripts/build.mjs --target firefox` (bundled to `apps/extension/dist/firefox`) [automated-tested]

---

## 3. Test Execution & Automated Verification

- **Test Command:** `npm test`
- **Result:** **Success (Exit Code 0 across all workspaces)**
- **Test Suites Executed:** 6 test files, **113 passing tests**, 0 failing.

| Workspace / Test File | Test Suite Focus | Tests Count | Status | Feature Tier |
| :--- | :--- | :---: | :---: | :---: |
| `@sih26171/perception` / `payload-budget.test.ts` | 40-element cap, 32 KB limit, relevance ranking, target preservation guarantee, fail-closed target drop | 6 | **PASS** | automated-tested |
| `@sih26171/policy` / `policy.test.ts` | Risk classification (LOW/MED/HIGH/BLOCKED), formal approval state machine transitions, illegal transitions, context binding, server override rejection | 22 | **PASS** | automated-tested |
| `@sih26171/extension` / `validation.test.ts` | BBox bounds $[0, 1]$, command schemas, confidence gate, confirmation triggers, target element resolution, stale layout detection | 31 | **PASS** | automated-tested |
| `@sih26171/extension` / `security-and-network.test.ts` | Network spying, zero secret leakage, screenshot pixel omission, fail-closed pre-flight abort, malicious commands, stale IDs | 10 | **PASS** | automated-tested |
| `@sih26171/extension` / `pii-detection.test.ts` | RFC emails, Indian & intl phones (+91 variations), Aadhaar, PAN, credit cards, dates, passwords, autocomplete & label heuristics, redaction manifests | 26 | **PASS** | automated-tested |
| `@sih26171/extension` / `phase1-vertical-slice.test.ts` | End-to-end task flow, Privacy HUD states, high-risk approval card, safe action click, target revalidation, real task transport spy (zero secrets, zero pixels, cookie/storage canaries) | 18 | **PASS** | automated-tested |
| **Total Automated Tests** | **All protocol, policy, perception, privacy, and extension rules** | **113** | **PASS** | automated-tested |

---

## 4. PII Detection & Redaction Accuracy (Synthetic Fixture)

Evaluated against the deterministic test fixture (`fixtures/pii-seeded-page.ts`) containing 14 DOM elements:

- **Total Elements in Fixture:** 14 (12 sensitive, 2 clean) [synthetic-only]
- **Number of PII Categories Seeded:** 12 categories (Email, Indian Phone, PAN, Aadhaar, Credit Card, DOB, Password input, Autocomplete email, Name, Address, Vehicle Registration, IP/Location).
- **Number Detected:** 12 of 12 (True Positives: 12, False Negatives: 0).
- **Number Redacted:** 12 of 12 (all sensitive values replaced with category placeholders).
- **False Positives Observed:** 0 (clean elements `e_013` "Download Report" button and `e_014` "View Dashboard" link were correctly preserved without any redaction).
- **Detection Metrics (on supplied fixture):**
  - **Recall:** 1.00 (100.0% for the seeded fixture) [synthetic-only]
  - **Precision:** 1.00 (100.0% for the seeded fixture) [synthetic-only]
  - **F1 Score:** 1.00 (100.0% for the seeded fixture) [synthetic-only]
- **Indian Phone Number Variations Verified (Automated Tests):**
  - `+91 98765 43210` → Detected as `phone` [automated-tested]
  - `+91 90000 12345` → Detected as `phone` [automated-tested]
  - `9876543210` → Detected as `phone` [automated-tested]
  - `90000-12345` → Detected as `phone` [automated-tested]

---

## 5. Outbound Payload Inspection & Real Task Flow Transport Spy

An automated network spy intercepted the serialized outbound HTTP POST request sent by `sendToServer` during the real task flow:

- **Outbound Request Body Assertions:**
  - `image_base64: ""` strictly enforced [automated-tested]
  - `raw_pixels_sent: false` strictly enforced in privacy metadata [automated-tested]
  - `fake.email@example.test`: **NOT PRESENT (0 occurrences)** [automated-tested]
  - `+91 90000 12345` / `90000 12345`: **NOT PRESENT (0 occurrences)** [automated-tested]
  - `fake password`: **NOT PRESENT (0 occurrences)** [automated-tested]
  - `ABCDE1234F`: **NOT PRESENT (0 occurrences)** [automated-tested]
  - `4111 1111 1111 1111`: **NOT PRESENT (0 occurrences)** [automated-tested]
  - `canary_session_cookie_secret_xyz`: **NOT PRESENT (0 occurrences)** [automated-tested]
  - `canary_localstorage_jwt_token_999`: **NOT PRESENT (0 occurrences)** [automated-tested]
- **Target Element Preservation:** The required target `#download-report` (`Download Report`) remained unredacted, accessible, and intact [automated-tested].
- **Pre-flight Privacy Firewall Gate:** The `sanitizeBeforeSend` function executes verification prior to network dispatch. When an unredacted secret is present, `verification.passed` evaluates to `false`, throwing an exception and halting transmission [automated-tested].

---

## 6. Policy Engine & Formal Approval State Machine (`@sih26171/policy`)

Workstreams 1 & 2 established pure, dependency-light governance abstractions [automated-tested]:
- **Risk Level Rules:**
  - `LOW`: observe, wait, scroll, focus (no confirmation required).
  - `MEDIUM`: ordinary click, non-sensitive type, harmless keypress.
  - `HIGH`: download, submit, upload, payment, delete, account/security changes, navigation (confirmation mandatory).
  - `BLOCKED`: execute_javascript, arbitrary code, password fill, cookie access, storage access, hidden target, secret arguments.
- **Formal State Transitions (`ApprovalState`):**
  - `NONE → PENDING`: Initiated for `HIGH` and `CRITICAL` actions.
  - `NONE → APPROVED`: Only permitted for `LOW` actions requiring no confirmation.
  - `PENDING → APPROVED`: Permitted exclusively upon receiving a trusted side panel approval message carrying valid `commandId`, `targetFingerprint`, `riskLevel`, and active `tabId`.
  - `PENDING → CANCELLED`: Triggered on user cancellation; halts execution permanently.
  - `PENDING → REJECTED`: Triggered on timeout, stale target, mutated target, or token mismatch.
  - `APPROVED → execution`: Permitted only after pre-execution live target revalidation.
  - **Terminal Protection:** Terminal states (`CANCELLED`, `REJECTED`) cannot transition back to `APPROVED`.
  - **Server Override Prevention:** Server responses cannot downgrade local risk, cannot set `APPROVED`, and cannot bypass confirmation.

---

## 7. Payload Budget & Context Ranking (`@sih26171/perception`)

Workstream 3 implemented strict resource budgeting and ranking in perception [automated-tested]:
- **Defaults:** `maxElements = 40`, `maxPayloadBytes = 32 * 1024` (32 KB).
- **Pipeline Order:**
  1. Extract page structure.
  2. Remove hidden and aria-hidden nodes.
  3. Remove password/input values and raw secrets.
  4. Redact remaining sensitive text.
  5. Rank sanitized elements based on task keywords, interactive role, accessible name, viewport geometry, enabled state, and agent ID.
  6. Preserve task-relevant interactive targets (guarantees `#download-report`).
  7. Apply element and byte budgets.
  8. Serialize and verify again before network transit.
- **Measured Real Payload Size:** **1.36 KB** actual request body vs **32 KB limit** (95.7% bandwidth headroom).
- **Fail-Closed Budgeting:** If budget constraints ever drop the requested target, the pipeline fails closed with `status: 'target_context_unavailable'`.

---

## 8. Client Resource Utilization, Latency & Repeatability Statistics

Measurements recorded by the evaluation harness (`packages/evaluation/src/run-evaluation.ts`) on the 14-element fixture:

### A. Single Run Measurements
- **Local Detection Latency:** 0.11 ms [synthetic-only]
- **Local Redaction Latency:** 0.37 ms [synthetic-only]
- **Local Pipeline Processing Latency:** 0.48 ms [synthetic-only]
- **Synthetic-Fixture Evaluation Score:** **96.8%** [synthetic-only] (Overall weighted score against synthetic benchmark harness)

### B. 10-Run Repeatability Statistics (Workstream 4)
Computed over 10 consecutive executions on the test fixture:
- **Sample Count:** 10 consecutive runs
- **PII Detection Latency:**
  - Mean ($\mu$): **0.19 ms**
  - Min: 0.04 ms
  - Max: 0.88 ms
  - Standard Deviation ($\sigma$): **0.24 ms**
- **Redaction Latency:**
  - Mean ($\mu$): **0.17 ms**
  - Min: 0.05 ms
  - Max: 0.49 ms
  - Standard Deviation ($\sigma$): **0.12 ms**
- **Sanitized Serialization Latency:**
  - Mean ($\mu$): **0.04 ms**
  - Min: 0.02 ms
  - Max: 0.07 ms
  - Standard Deviation ($\sigma$): **0.02 ms**
- **Total Local Pipeline Latency:**
  - Mean ($\mu$): **0.41 ms**
  - Min: 0.11 ms
  - Max: 1.05 ms
  - Standard Deviation ($\sigma$): **0.29 ms**

---

## 9. Manifest Permissions Minimization (Variant B Adopted)

Workstream 5 evaluated permissions and minimized the Chrome Manifest V3 configuration:
- **Removed Permission:** `"scripting"` was permanently removed from `manifest.json`.
- **Static Security Scan:** `node scripts/static-security-scan.cjs` confirmed **0 matches** for `chrome.scripting`, `eval`, `new Function`, `executeScript`, raw password reads, or storage leaks [automated-tested].
- **Active Permissions (Variant B):**
  - `activeTab`: Least-privilege temporary host access upon user invocation [manually validated].
  - `tabs`: Required to resolve target tab context from side panel background worker [manually validated].
  - `storage`: Persists local user configuration on-device [manually validated].
  - `sidePanel`: Dedicated split-view UI for Privacy HUD, approval cards, and audit logs [manually validated].
  - `host_permissions: ["<all_urls>"]`: Retained for prototype multi-domain testing; documented to be narrowed to enterprise allowlists in production [manually validated].

---

## 10. Measurement Boundary & Browser Execution Status

### A. Measurement Boundary
- **100% PII precision/recall applies only to seeded fixtures:** The 100.0% recall, precision, and F1 score apply strictly and exclusively to the supplied deterministic synthetic test fixture (`fixtures/pii-seeded-page.ts`). They do not establish universal detection across arbitrary live web forms or unstructured free text on internet websites.
- **0.41 ms applies only to local CPU detection/redaction on the tested fixture:** This latency metric ($\mu = 0.41\text{ ms}, \sigma = 0.29\text{ ms}$) measures exclusively local CPU regex detection and string mask substitution on the 14-element synthetic fixture inside a Node.js process.
- **Exclusions:** Excludes real browser process startup, canvas screenshot capture, network round trip, and remote model reasoning.
- **WAN latency and GPU memory are not measured:** Wide-area network latency (which depends on server location and transit) and GPU memory utilization (since the MVP runs entirely on CPU regexes without WebGPU neural weights) are not measured.

### B. Live Browser Execution Confirmation
- **Was the seeded HTML page opened in a live browser?** **YES.** **“Live Chrome validation completed on the seeded synthetic fixture; this does not establish arbitrary-website support.”** The seeded fixture was opened in a real Google Chrome instance (`C:\Program Files\Google\Chrome\Application\chrome.exe`) and validated via native Chrome DevTools Protocol [manually validated].
- **Was the real "Download Report" button clicked?** **YES.** In the live Chrome instance, following the user approval step in the extension side panel, `#download-report` was safely clicked after pre-execution target revalidation, successfully triggering the green animated success banner (*"Report downloaded successfully! Click count: 1 at ..."*) [manually validated].
- **Evidence Captured:** All 18 points of the live demo checklist were validated and saved under `docs/evidence/phase1/` ([01-seeded-page.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/01-seeded-page.png), [02-privacy-hud.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/02-privacy-hud.png), [03-approval-card.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/03-approval-card.png), [04-success-state.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/04-success-state.png), [browser-console.log](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/browser-console.log), [sanitized-request.json](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/sanitized-request.json)). 113 automated unit and integration tests pass with exit code 0 (`npm test`).

---

## 11. Feature Status Accounting Matrix

| Feature / Subsystem | Implementation File | Verification Mechanism | Status Label |
| :--- | :--- | :--- | :---: |
| **DOM Tree Traversal & Geometry Normalization** | `packages/perception/src/dom-extractor.ts` | Vitest / CDP DOM inspection | **automated-tested** |
| **Aria-Hidden & Invisible Element Pruning** | `apps/extension/src/content/index.ts` | Vitest unit test | **automated-tested** |
| **Context Ranking & Payload Budget ($\le 40$ els, $\le 32$ KB)** | `packages/perception/src/payload-budget.ts` | Vitest unit test (6 tests) | **automated-tested** |
| **Pre-Flight Privacy Firewall Verification** | `packages/privacy/src/sanitizer.ts` | Vitest integration test | **automated-tested** |
| **Outbound Zero-Pixel Invariant (`image_base64: ""`)** | `packages/privacy/src/sanitizer.ts` | Vitest integration test | **automated-tested** |
| **Real Task Transport Spy (Zero Secrets, Canaries)** | `apps/extension/src/__tests__/phase1-vertical-slice.test.ts` | Vitest integration test | **automated-tested** |
| **Risk Classification Engine (`@sih26171/policy`)** | `packages/policy/src/risk.ts` | Vitest unit test (22 tests) | **automated-tested** |
| **Formal Approval State Machine (`ApprovalState`)** | `packages/policy/src/approval.ts` | Vitest unit test | **automated-tested** |
| **Live Target Revalidation & Safe Click** | `apps/extension/src/content/index.ts` | Vitest & Live Chrome CDP | **automated-tested** & **manually validated** |
| **Privacy HUD & Approval Side Panel UI** | `apps/extension/src/sidepanel/sidepanel.ts` | Live Chrome CDP | **manually validated** |
| **Seeded Fixture Benchmark Score (96.8%)** | `packages/evaluation/src/run-evaluation.ts` | tsx benchmark script | **synthetic-only** |
| **PII Precision / Recall (100% on Seeded Data)** | `packages/privacy/src/pii-detector.ts` | Synthetic test fixture | **synthetic-only** |
| **Local Deterministic Reasoner (Demo Mode)** | `packages/server/src/index.ts` | Local Fastify server | **synthetic-only** |
| **Pixel-Level Canvas Screenshot Redaction** | Deferred to Phase 3 Roadmap | Future engineering phase | **planned/not implemented** |
| **On-Device Local WebGPU SLM Reasoning** | Deferred to Phase 3 Roadmap | Future engineering phase | **planned/not implemented** |
