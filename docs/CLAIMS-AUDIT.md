# PrivacySight Agent — Scientific Claims Audit Matrix

**Project:** SIH26171 — On-device Visual Perception for Lightweight Browser Agents  
**Date:** 2026-09-27  
**Core Benchmark Status:** “Live Chrome validation completed on the seeded synthetic fixture; this does not establish arbitrary-website support.”  

---

## 1. Implemented & Automated-Tested Capabilities

The following capabilities are verified by **113 automated unit and integration tests** (`npm test`):

| Capability | Implementation File | Verification Test | Status |
| :--- | :--- | :--- | :---: |
| **DOM-First Perception** | `apps/extension/src/content/index.ts` | `phase1-vertical-slice.test.ts` | ✅ **VERIFIED** |
| **Aria-Hidden & Hidden Element Exclusion** | `apps/extension/src/content/index.ts` | `phase1-vertical-slice.test.ts` | ✅ **VERIFIED** |
| **Raw Password & Input Value Omission** | `apps/extension/src/content/index.ts` | `phase1-vertical-slice.test.ts` | ✅ **VERIFIED** |
| **Pre-Flight Privacy Firewall Verification** | `packages/privacy/src/sanitizer.ts` | `security-and-network.test.ts` | ✅ **VERIFIED** |
| **Fail-Closed Verification Abort** | `apps/extension/src/background/index.ts` | `security-and-network.test.ts` | ✅ **VERIFIED** |
| **Zero-Pixel Outbound Invariant (`image_base64: ""`)** | `packages/privacy/src/sanitizer.ts` | `security-and-network.test.ts` | ✅ **VERIFIED** |
| **Risk Classification Package (`@sih26171/policy`)** | `packages/policy/src/risk.ts` | `policy.test.ts` (22 tests) | ✅ **VERIFIED** |
| **Formal Approval State Machine (`ApprovalState`)** | `packages/policy/src/approval.ts` | `policy.test.ts` | ✅ **VERIFIED** |
| **Context Ranking & Payload Budgeting ($\le 40$ els, $\le 32$ KB)** | `packages/perception/src/payload-budget.ts` | `payload-budget.test.ts` (6 tests) | ✅ **VERIFIED** |
| **Target Preservation Guarantee (`#download-report`)** | `packages/perception/src/payload-budget.ts` | `payload-budget.test.ts` | ✅ **VERIFIED** |
| **Server Policy Override Prevention** | `packages/policy/src/risk.ts` | `policy.test.ts` | ✅ **VERIFIED** |
| **Safe Target Revalidation (stale/hidden/disabled)** | `packages/protocol/src/validation.ts` | `phase1-vertical-slice.test.ts` | ✅ **VERIFIED** |
| **Real Task Transport Spy (Zero Secrets, Canaries)** | `apps/extension/src/__tests__/phase1-vertical-slice.test.ts` | `phase1-vertical-slice.test.ts` | ✅ **VERIFIED** |
| **Sanitized Audit Event Generation** | `apps/extension/src/background/index.ts` | `phase1-vertical-slice.test.ts` | ✅ **VERIFIED** |

---

## 2. Implemented & Manually Validated (Live Chrome GUI)

The following capabilities were validated in a real, running Google Chrome window (`C:\Program Files\Google\Chrome\Application\chrome.exe`) driving the unpacked extension via native Chrome DevTools Protocol (CDP) on the seeded fixture:

| Flow / Feature | Manual / CDP Verification Method | Evidence Artifact | Status |
| :--- | :--- | :--- | :---: |
| **Unpacked Extension Load** | Loaded via `--load-extension` flag | Service worker registered | ✅ **VALIDATED** |
| **Seeded Page UI Rendering** | Rendered at `http://127.0.0.1:8085/seeded-test-page.html` | [01-seeded-page.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/01-seeded-page.png) | ✅ **VALIDATED** |
| **Side Panel & Privacy HUD** | Clicked `#sp-scan-btn`; verified PASS, zero-transmission tiles, and counts | [02-privacy-hud.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/02-privacy-hud.png) | ✅ **VALIDATED** |
| **High-Risk Action Approval Card** | Triggered `#sp-run-btn`; observed Action, Target, Risk: HIGH, Reason | [03-approval-card.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/03-approval-card.png) | ✅ **VALIDATED** |
| **Cancel Prevention Flow** | Clicked `#sp-cancel-btn`; confirmed `clickCount === 0` | Evidence log in [sanitized-request.json](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/sanitized-request.json) | ✅ **VALIDATED** |
| **Approve & Execute Flow** | Clicked `#sp-approve-btn`; confirmed target revalidation and button click | [04-success-state.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/04-success-state.png) | ✅ **VALIDATED** |
| **Zero Secrets in Audit Trail** | Inspected rendered `#sp-audit-log` text for seeded secrets | Clean log; zero credentials stored | ✅ **VALIDATED** |
| **Browser Console Clean** | Streamed CDP `Runtime.consoleAPICalled` events | [browser-console.log](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/browser-console.log) (0 uncaught errors) | ✅ **VALIDATED** |

---

## 3. Mocked & Synthetic Only (Honest Accounting)

| Capability | Current State | Reason & Boundary |
| :--- | :--- | :--- |
| **96.8% Evaluation Score** | “Synthetic-fixture benchmark evaluation.” | Measured exclusively on the 14-element synthetic test fixture (`fixtures/pii-seeded-page.ts`). |
| **100% PII Recall & Precision** | Synthetic fixture baseline | Evaluated against seeded regular expressions and synthetic test cards. Unstructured natural language web forms will have different empirical accuracy. |
| **0.32 ms Processing Latency** | Local CPU regex processing | Measures local Node/browser JavaScript execution time. Excludes browser process launch, network round trips, and remote GPU inference. |
| **Remote Server Reasoning** | Local deterministic reasoner mock | Server reasoning operates via a local deterministic state machine in demo mode; no remote GPU cloud LLM was connected. |

---

## 4. Planned & Not Implemented (Future Roadmap)

| Roadmap Item | Status | Target Phase |
| :--- | :--- | :---: |
| **Pixel-Level Screenshot Redaction** | “Pixel-level screenshot redaction is planned, not implemented.” | Phase 3 |
| **On-Device Small Language Model (SLM)** | Architecturally planned via WebGPU / ONNX Runtime Web | Phase 3 |
| **Visual Confirmation Thumbnails** | Planned cropped bounding box preview for high-risk dialogs | Phase 2 |
| **Cross-Site Multi-Page Benchmark** | 100+ public government & commercial web forms | Phase 3 |

---

## 5. Audit Compliance Checklist

- [x] “DOM-first on-device perception.” claim verified.
- [x] “Zero screenshot-pixel transmission in the MVP.” claim verified.
- [x] “Fail-closed local privacy verification.” claim verified.
- [x] “Server responses cannot bypass local policy.” claim verified.
- [x] “Synthetic-fixture benchmark evaluation.” claim verified.
- [x] “Pixel-level screenshot redaction is planned, not implemented.” claim verified.
- [x] “Live browser results are reported only after manual execution.” claim verified.
- [x] Disallowed marketing claims strictly omitted (zero mentions of "100% privacy", "GDPR/DPDP compliant", "production-ready", "universal website support", "real-world 96.8% accuracy", "fully supported Chrome and Firefox", "pixel-level redaction").
