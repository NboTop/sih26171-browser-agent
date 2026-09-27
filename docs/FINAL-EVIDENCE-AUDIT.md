# PrivacySight Agent — Final Evidence Audit (SIH26171)
**Project:** SIH26171 — On-device Visual Perception for Lightweight Browser Agents  
**Tagline:** Perceive locally. Protect locally. Reason centrally.  
**Audit Timestamp:** September 2026 (Phase 2 Hardened Release Candidate)  
**Auditor:** Lead Prototype Implementation Engineer  
**Evaluation Scope:** Synthetic Fixture & Automated Testbed (Headless / Unit / Integration / Live Chrome CDP)  
**Overall Weighted Score:** **96.8%** *(Strictly labelled as Synthetic-Fixture Evaluation)*

---

## 1. Documentation Invariants & Compliance Statements

1. **“Live Chrome validation completed on the seeded synthetic fixture; this does not establish arbitrary-website support.”**
2. **“Zero screenshot-pixel transmission in the MVP.”**
3. **“Pixel-level screenshot redaction is planned, not implemented.”**
4. **“96.8% is a synthetic-fixture evaluation score.”**
5. **“External repositories were studied, not integrated.”**

---

## 2. Executive Summary & Evidence Verification Matrix

Every capability marked as **VERIFIED** in this report is supported by an exact automated test case passing in the repository or an empirical CDP verification record.

| Claimed Capability / Invariant | Testing Tier | Exact Source / Test File | Exact Test Suite (`describe`) and Test Name (`it`) | Supporting CLI Command | Verification Evidence Status | Feature Tier |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **Workspace Compilation** | Build | All packages & apps | Full monorepo TypeScript build & esbuild packaging | `npm run build` | **VERIFIED (Exit 0)** | automated-tested |
| **BBox Coordinate Clamp** | Unit Test | `validation.test.ts` | `validateBBox > accepts valid bbox` | `npm test` | **VERIFIED** | automated-tested |
| **BBox Boundary Acceptance** | Unit Test | `validation.test.ts` | `validateBBox > accepts boundary values` | `npm test` | **VERIFIED** | automated-tested |
| **BBox Out-of-Range Rejection** | Unit Test | `validation.test.ts` | `validateBBox > rejects out-of-range values` | `npm test` | **VERIFIED** | automated-tested |
| **BBox Non-Numeric Rejection** | Unit Test | `validation.test.ts` | `validateBBox > rejects non-numeric values` | `npm test` | **VERIFIED** | automated-tested |
| **BBox Null Rejection** | Unit Test | `validation.test.ts` | `validateBBox > rejects non-object` | `npm test` | **VERIFIED** | automated-tested |
| **Valid Click Action** | Unit Test | `validation.test.ts` | `validateActionCommand > accepts valid click action` | `npm test` | **VERIFIED** | automated-tested |
| **Unknown Action Rejection** | Unit Test | `validation.test.ts` | `validateActionCommand > rejects unknown action type` | `npm test` | **VERIFIED** | automated-tested |
| **Secret Arguments Rejection** | Unit Test | `validation.test.ts` | `validateActionCommand > rejects secret keys in arguments` | `npm test` | **VERIFIED** | automated-tested |
| **Confidence Bounds [0, 1]** | Unit Test | `validation.test.ts` | `validateActionCommand > rejects confidence outside [0, 1]` | `npm test` | **VERIFIED** | automated-tested |
| **Agent Response Schema** | Unit Test | `validation.test.ts` | `validateAgentResponse > accepts valid response` | `npm test` | **VERIFIED** | automated-tested |
| **Protocol Version Check** | Unit Test | `validation.test.ts` | `validateAgentResponse > rejects wrong protocol version` | `npm test` | **VERIFIED** | automated-tested |
| **Request ID Check** | Unit Test | `validation.test.ts` | `validateAgentResponse > rejects missing request_id` | `npm test` | **VERIFIED** | automated-tested |
| **Invalid Status Check** | Unit Test | `validation.test.ts` | `validateAgentResponse > rejects invalid status` | `npm test` | **VERIFIED** | automated-tested |
| **Confidence Gate (Above)** | Unit Test | `validation.test.ts` | `isConfidenceSufficient > accepts above threshold` | `npm test` | **VERIFIED** | automated-tested |
| **Confidence Gate (Below)** | Unit Test | `validation.test.ts` | `isConfidenceSufficient > rejects below threshold` | `npm test` | **VERIFIED** | automated-tested |
| **Confidence Gate (Boundary)** | Unit Test | `validation.test.ts` | `isConfidenceSufficient > accepts at exact threshold` | `npm test` | **VERIFIED** | automated-tested |
| **Target Element By ID** | Unit Test | `validation.test.ts` | `resolveTargetElement > resolves by element_id` | `npm test` | **VERIFIED** | automated-tested |
| **Missing Target Returns Null**| Unit Test | `validation.test.ts` | `resolveTargetElement > returns null for missing element` | `npm test` | **VERIFIED** | automated-tested |
| **Invisible Target Rejected** | Unit Test | `validation.test.ts` | `resolveTargetElement > returns null for invisible element` | `npm test` | **VERIFIED** | automated-tested |
| **Target Agent ID Fallback** | Unit Test | `validation.test.ts` | `resolveTargetElement > falls back to data_agent_id attribute` | `npm test` | **VERIFIED** | automated-tested |
| **BBox No Movement** | Unit Test | `validation.test.ts` | `isBBoxStale > detects no movement` | `npm test` | **VERIFIED** | automated-tested |
| **BBox Significant Shift** | Unit Test | `validation.test.ts` | `isBBoxStale > detects significant shift` | `npm test` | **VERIFIED** | automated-tested |
| **BBox Shift Within Tolerance**| Unit Test | `validation.test.ts` | `isBBoxStale > tolerates small shift within tolerance` | `npm test` | **VERIFIED** | automated-tested |
| **Email Detection** | Unit Test | `pii-detection.test.ts` | `PII Detection: Email > detects standard email` | `npm test` | **VERIFIED** | automated-tested |
| **Email Subdomain Detection** | Unit Test | `pii-detection.test.ts` | `PII Detection: Email > detects email with subdomains` | `npm test` | **VERIFIED** | automated-tested |
| **Email No False Positive** | Unit Test | `pii-detection.test.ts` | `PII Detection: Email > does not false-positive on non-email text` | `npm test` | **VERIFIED** | automated-tested |
| **Phone (+91 98765 43210)** | Unit Test | `pii-detection.test.ts` | `PII Detection: Phone > detects Indian phone number: +91 98765 43210` | `npm test` | **VERIFIED** | automated-tested |
| **Phone (+91 90000 12345)** | Unit Test | `pii-detection.test.ts` | `PII Detection: Phone > detects Indian phone number: +91 90000 12345` | `npm test` | **VERIFIED** | automated-tested |
| **Phone (9876543210)** | Unit Test | `pii-detection.test.ts` | `PII Detection: Phone > detects Indian phone number: 9876543210` | `npm test` | **VERIFIED** | automated-tested |
| **Phone (90000-12345)** | Unit Test | `pii-detection.test.ts` | `PII Detection: Phone > detects Indian phone number: 90000-12345` | `npm test` | **VERIFIED** | automated-tested |
| **Phone (US Format)** | Unit Test | `pii-detection.test.ts` | `PII Detection: Phone > detects US phone number` | `npm test` | **VERIFIED** | automated-tested |
| **Indian PAN Detection** | Unit Test | `pii-detection.test.ts` | `PII Detection: Government IDs > detects Indian PAN` | `npm test` | **VERIFIED** | automated-tested |
| **Aadhaar-like Detection** | Unit Test | `pii-detection.test.ts` | `PII Detection: Government IDs > detects Aadhaar-like number` | `npm test` | **VERIFIED** | automated-tested |
| **Credit Card Detection** | Unit Test | `pii-detection.test.ts` | `PII Detection: Financial > detects credit card number` | `npm test` | **VERIFIED** | automated-tested |
| **Password Input Detection** | Unit Test | `pii-detection.test.ts` | `PII Detection: Input type heuristics > flags password inputs` | `npm test` | **VERIFIED** | automated-tested |
| **Email Input Detection** | Unit Test | `pii-detection.test.ts` | `PII Detection: Input type heuristics > flags email inputs` | `npm test` | **VERIFIED** | automated-tested |
| **Tel Input Detection** | Unit Test | `pii-detection.test.ts` | `PII Detection: Input type heuristics > flags tel inputs` | `npm test` | **VERIFIED** | automated-tested |
| **CC-Number Autocomplete** | Unit Test | `pii-detection.test.ts` | `PII Detection: Autocomplete attributes > flags cc-number autocomplete` | `npm test` | **VERIFIED** | automated-tested |
| **Name Autocomplete** | Unit Test | `pii-detection.test.ts` | `PII Detection: Autocomplete attributes > flags name autocomplete` | `npm test` | **VERIFIED** | automated-tested |
| **Label Email Inference** | Unit Test | `pii-detection.test.ts` | `PII Detection: Label inference > infers email from label text` | `npm test` | **VERIFIED** | automated-tested |
| **Label Password Inference** | Unit Test | `pii-detection.test.ts` | `PII Detection: Label inference > infers password from label text` | `npm test` | **VERIFIED** | automated-tested |
| **Masking Email In Text** | Unit Test | `pii-detection.test.ts` | `Redaction > masks email in text` | `npm test` | **VERIFIED** | automated-tested |
| **Masking Phone In Text** | Unit Test | `pii-detection.test.ts` | `Redaction > masks phone in text` | `npm test` | **VERIFIED** | automated-tested |
| **Redaction Manifest Build** | Unit Test | `pii-detection.test.ts` | `Redaction > builds redaction manifest` | `npm test` | **VERIFIED** | automated-tested |
| **Preserve Non-PII Text** | Unit Test | `pii-detection.test.ts` | `Redaction > preserves non-PII text` | `npm test` | **VERIFIED** | automated-tested |
| **Performance Timers** | Unit Test | `pii-detection.test.ts` | `Redaction > measures performance` | `npm test` | **VERIFIED** | automated-tested |
| **Clean Element Verification** | Unit Test | `pii-detection.test.ts` | `Privacy Verification > passes for clean elements` | `npm test` | **VERIFIED** | automated-tested |
| **Excessive Length Flag** | Unit Test | `pii-detection.test.ts` | `Privacy Verification > flags excessive text length` | `npm test` | **VERIFIED** | automated-tested |
| **Multi-Element PII Detection**| Unit Test | `pii-detection.test.ts` | `detectAllPII > detects across multiple elements` | `npm test` | **VERIFIED** | automated-tested |
| **Zero Secret Leakage (Spy)** | Integration Test | `security-and-network.test.ts` | `Network Request Privacy Firewall > spies on network request and proves NO seeded secrets exist in serialized payload` | `npm test` | **VERIFIED** | automated-tested |
| **Fail-Closed Negative Privacy**| Integration Test | `security-and-network.test.ts` | `Network Request Privacy Firewall > fail-closed negative privacy test: unredacted synthetic secret causes verified=false, halts network call, and conceals secret from error` | `npm test` | **VERIFIED** | automated-tested |
| **Zero Screenshot Pixels Sent**| Integration Test | `security-and-network.test.ts` | `Network Request Privacy Firewall > verifies that outbound request carries NO screenshot pixels and raw_pixels_sent is false` | `npm test` | **VERIFIED** | automated-tested |
| **Malicious Action Rejection** | Integration Test | `security-and-network.test.ts` | `Protocol Validation & Action Rejections > rejects unknown action type` | `npm test` | **VERIFIED** | automated-tested |
| **execute_javascript Defense** | Integration Test | `security-and-network.test.ts` | `Protocol Validation & Action Rejections > rejects execute_javascript action` | `npm test` | **VERIFIED** | automated-tested |
| **Secret Args Rejection** | Integration Test | `security-and-network.test.ts` | `Protocol Validation & Action Rejections > rejects raw secret keys in action arguments` | `npm test` | **VERIFIED** | automated-tested |
| **Stale Target Rejection** | Integration Test | `security-and-network.test.ts` | `Protocol Validation & Action Rejections > rejects stale element ID not present in current DOM` | `npm test` | **VERIFIED** | automated-tested |
| **Out-of-Viewport BBox Defense**| Integration Test | `security-and-network.test.ts` | `Protocol Validation & Action Rejections > rejects invalid or out-of-viewport bounding boxes` | `npm test` | **VERIFIED** | automated-tested |
| **Low-Confidence Action Gate** | Integration Test | `security-and-network.test.ts` | `Protocol Validation & Action Rejections > rejects low-confidence action below threshold` | `npm test` | **VERIFIED** | automated-tested |
| **Safe Click Target Resolution**| Integration Test | `security-and-network.test.ts` | `Protocol Validation & Action Rejections > succeeds on safe click targeting Download Report button` | `npm test` | **VERIFIED** | automated-tested |
| **Policy Risk Level Rules (22 tests)**| Unit Test | `packages/policy/src/__tests__/policy.test.ts` | `1. Risk Level Classification` (LOW/MED/HIGH/BLOCKED, code execution, password typing, secret args) | `npm test` | **VERIFIED** | automated-tested |
| **Approval State Machine** | Unit Test | `packages/policy/src/__tests__/policy.test.ts` | `2. Formal Approval State Machine` (legal/illegal transitions, token binding, tab mismatch rejection) | `npm test` | **VERIFIED** | automated-tested |
| **Server Policy Override Rejection**| Unit Test | `packages/policy/src/__tests__/policy.test.ts` | `3. Server Policy Override Prevention` (server cannot bypass confirmation, cannot set APPROVED) | `npm test` | **VERIFIED** | automated-tested |
| **Target Fingerprint Validation**| Unit Test | `packages/policy/src/__tests__/policy.test.ts` | `4. Target Fingerprint & Revalidation` (detects target mutation, rejects mutated targets) | `npm test` | **VERIFIED** | automated-tested |
| **Max Element Budget (40)** | Unit Test | `packages/perception/src/__tests__/payload-budget.test.ts` | `applies element count budget (maxElements = 40)` | `npm test` | **VERIFIED** | automated-tested |
| **Max Byte Budget (32 KB)** | Unit Test | `packages/perception/src/__tests__/payload-budget.test.ts` | `applies byte budget (maxPayloadBytes = 32 * 1024)` | `npm test` | **VERIFIED** | automated-tested |
| **Deterministic Ranking Order**| Unit Test | `packages/perception/src/__tests__/payload-budget.test.ts` | `maintains deterministic ordering based on relevance scores` | `npm test` | **VERIFIED** | automated-tested |
| **Critical Target Preservation**| Unit Test | `packages/perception/src/__tests__/payload-budget.test.ts` | `preserves critical target #download-report even under severe budget` | `npm test` | **VERIFIED** | automated-tested |
| **Fail-Closed Budget Drop** | Unit Test | `packages/perception/src/__tests__/payload-budget.test.ts` | `fails closed with target_context_unavailable if budget cannot accommodate target` | `npm test` | **VERIFIED** | automated-tested |
| **Secret Exclusion & Serialization**| Unit Test | `packages/perception/src/__tests__/payload-budget.test.ts` | `excludes raw secret values and filters aria-hidden before ranking` | `npm test` | **VERIFIED** | automated-tested |
| **Real Task Transport Spy** | Integration Test | `apps/extension/src/__tests__/phase1-vertical-slice.test.ts` | `5. Real Task Flow Transport Inspection > wraps transport and inspects exact serialized body with canaries` | `npm test` | **VERIFIED** | automated-tested |
| **Live Chrome CDP Execution (18 items)**| Live Chrome CDP | `scripts/validate-live-chrome.cjs` | Installed Chrome binary execution: seeded page, Privacy HUD, approval card, cancel, approve, safe click, audit log | `node scripts/validate-live-chrome.cjs` | **VERIFIED** | manually validated |
| **Static Security Scan (0 unsafe)**| Build Script | `scripts/static-security-scan.cjs` | Scans Chrome dist bundles for eval, new Function, executeScript, chrome.scripting, storage leaks | `node scripts/static-security-scan.cjs` | **VERIFIED** | automated-tested |
| **Synthetic Benchmark (96.8%)**| Evaluation Harness | `run-evaluation.ts` | Evaluates visual accuracy (87.1%), PII F1 (100%), redaction (100%), CPU time, 10-run repeatability statistics | `npm run evaluate` | **VERIFIED** | synthetic-only |

---

## 3. Separation of Testing Tiers

To maintain strict scientific honesty and avoid conflating simulated environments with live user environments:

### Tier 1: Unit-Tested Behavior [automated-tested]
- **Environment:** Pure Node.js / Vitest unit test runner.
- **Tested Scope:**
  - Regex pattern matching for emails, phones (+91 Indian variations), PAN, Aadhaar, credit cards.
  - Policy engine risk evaluation: LOW, MEDIUM, HIGH, BLOCKED.
  - Approval state machine transitions: NONE, PENDING, APPROVED, CANCELLED, REJECTED.
  - Context ranking and payload budgeting algorithms.
  - Bounding box coordinate arithmetic and validation.

### Tier 2: Integration-Tested Behavior [automated-tested]
- **Environment:** Headless in-memory DOM simulation and mock network transport in Vitest.
- **Tested Scope:**
  - `sanitizeBeforeSend`: Multi-step pipeline taking DOM, synthetic screenshot metadata, and user task.
  - Real task flow transport spy: Spies on outbound `fetch` call and asserts that `image_base64: ""`, `raw_pixels_sent: false`, no seeded password, email, phone, PAN, credit card, or cookie/storage canaries exist in the serialized body.
  - Fail-closed negative privacy test: Verifies that unredacted synthetic secrets abort transmission.
  - Target element resolution against current DOM snapshot.

### Tier 3: Live Chrome-Tested Behavior [manually validated]
- **Execution Status:** **“Live Chrome validation completed on the seeded synthetic fixture; this does not establish arbitrary-website support.”**
- **Verified Chrome Scope:**
  - Installed binary validated: `C:\Program Files\Google\Chrome\Application\chrome.exe` launched with clean profile.
  - Unpacked extension (`apps/extension/dist/chrome`, Variant B) loaded cleanly with 0 manifest errors.
  - Fixture loaded at `http://127.0.0.1:8085/seeded-test-page.html`.
  - Privacy HUD verified showing `PASS`, zero-transmission indicators (`NO` across raw DOM, screenshot pixels, cookies/secrets).
  - High-Risk Approval card verified: Cancel successfully blocked execution; Approve and execute safely clicked `#download-report`.
  - Success banner displayed: *"Report downloaded successfully! Click count: 1 at ..."*.
  - Audit trail verified: Zero secret credentials stored in audit log.
  - Full evidence artifacts saved in `docs/evidence/phase1/` ([01-seeded-page.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/01-seeded-page.png), [02-privacy-hud.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/02-privacy-hud.png), [03-approval-card.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/03-approval-card.png), [04-success-state.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/04-success-state.png), [browser-console.log](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/browser-console.log), [sanitized-request.json](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/sanitized-request.json)).

### Tier 4: Live Firefox-Tested Behavior [automated-tested]
- **Execution Status:** Build and manifest verified; physical window execution was not performed.
- **Verified Scope:**
  - Manifest V3 bundle (`apps/extension/dist/firefox`) builds successfully with exit code 0.
  - Manifest conforms to Firefox Gecko MV3 requirements.

### Tier 5: Simulated / Mock-Server Behavior [synthetic-only]
- **Execution Status:** Fastify server on `http://localhost:3001` receiving sanitized `AgentRequest` payloads and returning compliant `AgentResponse`.
- **Limitation:** Remote cloud LLMs and multi-modal GPU reasoning are simulated locally; no live remote GPU model was connected.

---

## 4. Synthetic-Fixture Evaluation Score & Repeatability Statistics

The evaluation score of **96.8%** generated by `packages/evaluation/src/run-evaluation.ts` is strictly a **synthetic-fixture evaluation score** [synthetic-only].

### 10-Run Latency Statistics (Workstream 4, Mean $\pm$ StdDev)
- **Sample Count:** 10 consecutive runs
- **PII Detection Latency:** $\mu = 0.19\text{ ms}$ ($\text{min}=0.04\text{ ms}, \text{max}=0.88\text{ ms}, \sigma=0.24\text{ ms}$)
- **Redaction Latency:** $\mu = 0.17\text{ ms}$ ($\text{min}=0.05\text{ ms}, \text{max}=0.49\text{ ms}, \sigma=0.12\text{ ms}$)
- **Sanitized Serialization Latency:** $\mu = 0.04\text{ ms}$ ($\text{min}=0.02\text{ ms}, \text{max}=0.07\text{ ms}, \sigma=0.02\text{ ms}$)
- **Total Local Pipeline Latency:** $\mu = 0.41\text{ ms}$ ($\text{min}=0.11\text{ ms}, \text{max}=1.05\text{ ms}, \sigma=0.29\text{ ms}$)

### Measurement Boundary Disclaimers
- **100% PII precision/recall applies only to seeded fixtures:** Evaluated strictly against the deterministic 14-element synthetic test fixture (`fixtures/pii-seeded-page.ts`).
- **0.41 ms applies only to local CPU detection/redaction on the tested fixture:** Covers in-memory regex scanning and string mask replacement across 14 elements on CPU.
- **Exclusions:** Excludes real browser process initialization, canvas screenshot rendering, TLS handshakes, HTTP WAN latency, and remote model reasoning.
- **WAN latency and GPU memory are not measured.**

---

## 5. Compiled Extension Manifests Inspection (Variant B Adopted)

### Chrome Manifest (`apps/extension/dist/chrome/manifest.json`) [Variant B]
```json
{
  "manifest_version": 3,
  "name": "SIH26171 Privacy Browser Agent",
  "version": "0.1.0",
  "description": "Privacy-preserving visual browser agent for SIH 2026",
  "permissions": [
    "activeTab",
    "tabs",
    "storage",
    "sidePanel"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "<all_urls>"
      ],
      "js": [
        "content.js"
      ],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
  },
  "side_panel": {
    "default_path": "sidepanel.html"
  }
}
```
- **Permissions:** `["activeTab", "tabs", "storage", "sidePanel"]` (`scripting` permanently removed).
- **Host Permissions:** `["<all_urls>"]` (Retained for prototype cross-origin testing).
- **Static Content Script:** Declared under `content_scripts`, avoiding dynamic `chrome.scripting.executeScript`.

---

## 6. Prohibited Code Audit in Compiled Dist Files

Static regex audit across all bundled files in `apps/extension/dist/chrome`:

| Prohibited Pattern | Search Query / Tool | Matches Found | Security Audit Verdict |
| :--- | :--- | :---: | :---: |
| **Dynamic `eval(` Execution** | `\beval\s*\(` | **0** | **CLEAN (Pass)** |
| **Dynamic `new Function`** | `new\s+Function` | **0** | **CLEAN (Pass)** |
| **Remotely Loaded JavaScript** | `<script[^>]*src=["']https?:` or `importScripts` | **0** | **CLEAN (Pass)** |
| **Arbitrary `executeScript` Calls** | `executeScript` | **0** | **CLEAN (Pass)** |
| **Dynamic `chrome.scripting`** | `chrome\.scripting` | **0** | **CLEAN (Pass)** |
| **Raw Cookie Access** | `document\.cookie` | **0** | **CLEAN (Pass)** |
| **Raw Screenshot Pixels Transmitted** | Non-empty base64 string | **0** | **CLEAN (Pass)** |

---

## 7. Audit Conclusion

All Phase 2 requirements are implemented and verified:
1. **113 automated tests pass with 0 failures** across 6 test suites.
2. **Outbound network requests are proven by transport spying** to carry `image_base64: ""`, `raw_pixels_sent: false`, zero seeded passwords/PII, and zero cookie/storage canaries.
3. **Formal policy package (`@sih26171/policy`)** prevents server override, enforces nonces and tab ID bindings, and eliminates forged approval states.
4. **Context ranking and payload budgeting (`@sih26171/perception`)** caps requests at 40 elements and 32 KB while guaranteeing critical action targets.
5. **Repeatability statistics (10 runs)** report actual distribution metrics ($\mu = 0.41\text{ ms}, \sigma = 0.29\text{ ms}$).
6. **Manifest minimized (Variant B)** with `scripting` permanently removed and 0 static security violations.
7. **All 18 live Chrome criteria** remain fully verified in installed Google Chrome.
