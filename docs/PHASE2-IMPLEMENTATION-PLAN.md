# SIH26171 PrivacySight Agent — Phase 2 Implementation Plan
**Document Version:** 2.0.0  
**Status:** Completed & Fully Verified (Post Workstreams 1–6)  
**Date:** September 2026  

---

## 1. Executive Summary & Delivery Status

All six Phase 2 workstreams have been implemented, tested, and validated in live Chrome:
- **Build Status:** Clean workspace build across all 6 workspaces (`npm run build`, exit code 0).
- **Automated Tests:** **113 passing tests** across 6 test suites (`npm test`, 0 failing).
- **Benchmark Evaluation:** **96.8%** weighted score on the synthetic fixture benchmark (`fixtures/pii-seeded-page.ts`) with 10-run repeatability statistics.
- **Static Security Scan:** Zero matches for unsafe dynamic execution (`eval`, `new Function`, `executeScript`), storage leaks, raw password reads, remote scripts, or raw screenshot transmissions.
- **Permission Minimization:** Variant B adopted (`activeTab`, `tabs`, `storage`, `sidePanel`); `"scripting"` permanently removed from source manifest with 0 references in dist bundles.
- **Live Chrome Validation:** All 18 criteria verified against installed Google Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) via native CDP over WebSocket.
- **Architectural Invariant:** Zero screenshot-pixel transmission (`image_base64: ""`, `raw_pixels_sent: false`) strictly enforced.
- **Presentation Deck:** Exactly six slides formatted in `docs/SIH-SIX-SLIDE-CONTENT.md`.

---

## 2. Phase 2 Implementation Order (Strict Sequence)

In accordance with release-candidate constraints, Phase 2 tasks must be executed in this exact order:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Extract Policy Logic into packages/policy                │
│    (Decouple risk rules & assessment from background worker)│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Add Typed RiskLevel & ApprovalState Machine              │
│    (Formal state transitions; forbid server approval forge) │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Add Payload Budget & Context Ranking                     │
│    (Enforce max 40 elements / 32 KB; relevance scoring)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Add Repeatability Metrics                                │
│    (10-run benchmark statistics: mean, min, max, stddev)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Improve Permission Minimization                          │
│    (Transition from Variant C to Variant B; drop scripting) │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Rewrite Final PPT Content                                │
│    (Update only after all Phase 2 measurements are locked)  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Workstream Details & Acceptance Criteria

### Workstream 1: Extract Policy Logic into `packages/policy`
- **Objective:** Separate governance rules from Chrome extension plumbing. Currently, action risk assessment (`assessActionRisk`) resides inside `apps/extension/src/background/index.ts`.
- **Target Architecture:**
  - Create `packages/policy/package.json` (`@sih26171/policy`).
  - Create `packages/policy/tsconfig.json` extending root configuration.
  - Implement `packages/policy/src/index.ts`:
    - `PolicyEngine`: Pure TypeScript evaluation engine.
    - `assessActionRisk(command, target, context)`: Evaluates risk based on action category, target role, keyword attributes, and irreversibility.
    - Deterministic rule matrix:
      - File download/creation triggers: `HIGH` risk.
      - Form submission / state-altering requests: `HIGH` risk.
      - Passive reading / focus / harmless scroll: `LOW` risk.
      - Ambiguous / unvalidated clicks: `MEDIUM` risk.
  - Update root `package.json` workspaces to include `packages/policy`.
  - Add `@sih26171/policy` dependency to `apps/extension` and `services/mock-server`.
- **Verification:** Unit tests in `packages/policy/src/__tests__/policy.test.ts` validating rule evaluation across all action types.

---

### Workstream 2: Add Typed RiskLevel and ApprovalState Machine
- **Objective:** Prevent unverified action execution and eliminate implicit or forged approval states.
- **Target Types (`@sih26171/protocol` or `@sih26171/policy`):**
  ```typescript
  export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  export type ApprovalStatus =
    | 'NONE'        // Low-risk action, no approval required
    | 'PENDING'     // Awaiting human review in UI
    | 'APPROVED'    // Human explicitly approved via side panel gesture
    | 'CANCELLED'   // Human cancelled execution
    | 'REJECTED';   // Target revalidation failed or timeout

  export interface ActionApprovalContext {
    commandId: string;
    riskLevel: RiskLevel;
    status: ApprovalStatus;
    reason: string;
    userConfirmedAt?: number;
    targetFingerprint: string;
  }
  ```
- **State Machine Rules:**
  1. If `riskLevel === 'HIGH' || riskLevel === 'CRITICAL'`, status **MUST** transition to `PENDING`.
  2. While `PENDING`, execution **CANNOT** proceed.
  3. `APPROVED` transition **ONLY** occurs upon receipt of a trusted internal UI message (`USER_APPROVAL_RESPONSE` with `approved: true`).
  4. Remote server responses cannot declare or set `status: 'APPROVED'`. Any server response attempting to bypass approval is rejected.
  5. Upon `APPROVED`, the content script must revalidate that the target DOM element still exists, is visible, and matches the pre-approval fingerprint.
- **Verification:** Dedicated unit tests asserting impossible state transitions and rejecting mock-server forge attempts.

---

### Workstream 3: Add Payload Budget and Context Ranking
- **Objective:** Ensure predictable network payloads, sub-millisecond local processing, and bandwidth efficiency.
- **Constraints:**
  - `MAX_ELEMENTS = 40` (cap on DOM elements sent to reasoning server).
  - `MAX_PAYLOAD_BYTES = 32 * 1024` (32 KB total payload budget).
- **Ranking Algorithm (`@sih26171/perception` or `@sih26171/policy`):**
  - Compute heuristic relevance score for each DOM/accessibility element based on:
    1. **Task Keyword Proximity:** Name/text matching terms from the user task.
    2. **Interactivity Score:** Form controls (`button`, `a`, `input`, `select`) weighted above static text (`p`, `div`, `span`).
    3. **Viewport Visibility:** Elements in the active viewport ranked higher than offscreen elements.
    4. **Structural Significance:** Interactive landmarks and form containers prioritized.
  - Sort elements descending by score; slice to `MAX_ELEMENTS`.
  - Serializer checks byte length; if payload exceeds 32 KB, gracefully truncates lowest-ranked elements while maintaining valid JSON structure.
  - PII masking is applied **before** ranking to ensure no unmasked text is ranked or transmitted.
- **Verification:** Unit tests verifying truncation at 40 elements, byte size under 32 KB, and preservation of high-relevance actionable targets.

---

### Workstream 4: Add Repeatability Metrics
- **Objective:** Move beyond single-run timing figures to standard statistical reporting across repeated iterations.
- **Implementation in `@sih26171/evaluation`:**
  - Run the detection, redaction, and perception pipeline 10 consecutive times against the seeded benchmark fixture.
  - Compute:
    - Mean latency ($\mu$)
    - Standard deviation ($\sigma$)
    - Min and Max latency
  - Measure per-component breakdown:
    - PII detection time (mean ± stddev)
    - Redaction string masking time (mean ± stddev)
    - Total on-device pipeline latency (mean ± stddev)
- **Documentation Standard:**
  - All claims in `VALIDATION-REPORT.md` and presentation slides must be updated to display `mean ± stddev (N=10 runs)`.

---

### Workstream 5: Improve Permission Minimization
- **Objective:** Eliminate unnecessary Chrome permissions from `manifest.json`.
- **Action Items:**
  - Remove `"scripting"` permission from `apps/extension/manifest.chrome.json`.
  - Transition from Variant C (`activeTab, tabs, scripting, storage, sidePanel`) to Variant B (`activeTab, tabs, storage, sidePanel`).
  - Content scripts are statically registered in `manifest.json` under `"content_scripts"`, making dynamic `chrome.scripting.executeScript` redundant.
  - Re-run `npm run build` and `scripts/validate-live-chrome.cjs` to confirm 100% functionality without `"scripting"`.
  - Update `docs/PERMISSIONS-JUSTIFICATION.md` to reflect the reduced permission set.

---

### Workstream 6: Update Presentation Content (PPT Slides)
- **Objective:** Synchronize the 6-slide presentation deck with final measured Phase 2 data.
- **Prerequisites:** Must **NOT** be executed until Workstreams 1–5 are complete and verified.
- **Updates to `docs/SIH-SIX-SLIDE-CONTENT.md`:**
  - Insert 10-run latency statistics (mean ± stddev).
  - Insert payload budget metrics (actual payload bytes vs 32 KB ceiling).
  - Document the updated minimized permission manifest.
  - Maintain the required claim boundary:
    *“Live Chrome validation completed on the seeded synthetic fixture; this does not establish arbitrary-website support.”*

---

## 4. Phase 2 Risk Management & Non-Goals

| Potential Risk | Prevention Strategy |
| :--- | :--- |
| **Breaking Existing Live Demo** | Run `scripts/validate-live-chrome.cjs` after each workstream to ensure zero regression. |
| **Regression in Evaluation Score** | Run `npm run evaluate` continuously; keep score locked at baseline 96.8%. |
| **Accidental Pixel Transmission** | Maintain unit test asserting `image_base64: ""` and `raw_pixels_sent: false`. |
| **Over-abstraction Bloat** | Keep `packages/policy` lightweight; do not add external npm dependencies. |

**Strict Non-Goals for Phase 2:**
- No WebGPU or on-device neural model integration.
- No remote cloud LLM endpoints or live API keys.
- No OCR or computer-vision facial bounding box models.
- No arbitrary website crawling or browser automation drivers.
