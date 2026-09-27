# SIH26171 — Smart India Hackathon 2026 Presentation
## PrivacySight Agent: On-device Visual Perception for Lightweight Browser Agents

---

### Slide 1: Problem & Solution

- **The Problem:**
  - Autonomous browser agents can expose sensitive DOM elements, plaintext credentials, and visual data to untrusted cloud servers.
  - Multi-modal agents typically stream raw 1080p screenshots and complete DOM trees, violating privacy before any server-side redaction can take place.
- **The Solution:**
  - **PrivacySight Agent** introduces a client-side local privacy firewall that intercepts, filters, and sanitizes page perception on-device before reasoning and action dispatch.
- **Problem Statement ID:** SIH26171 (On-device Visual Perception for Lightweight Browser Agents)
- **Tagline:** Perceive locally. Protect locally. Reason centrally.
- **Core Claim:** “DOM-first on-device perception.”
- **Validation Status:** “Live Chrome validation completed on the seeded synthetic fixture; this does not establish arbitrary-website support.”

---

### Slide 2: Threat Model & Privacy Boundary

- **Raw DOM/Screenshot Attack Surface in Existing Agents:**
  - Commercial vision agents stream raw canvas bitmaps and unredacted DOM dumps directly to remote LLMs.
  - Password inputs, payment details, session tokens, government identifiers, and personal user data cross the network boundary in cleartext.
- **Local Sanitization Boundary:**
  - Perception, PII detection, and context redaction occur strictly on the user's device inside the browser extension sandbox.
  - Password fields, unrendered DOM nodes, and hidden inputs are excluded at extraction time.
  - Outbound payloads undergo pre-flight verification; if unmasked secrets remain, network dispatch fails closed.
- **Architectural Invariant:**
  - “Zero screenshot-pixel transmission in the MVP.” (Outbound payload carries `image_base64: ""` and `raw_pixels_sent: false`).
  - “Pixel-level screenshot redaction is planned, not implemented.” (Canvas-based visual blurring deferred to roadmap).

---

### Slide 3: Architecture & Trust Boundary

- **The Central Visual Flow:**
  `Browser Page → Content Script → Local Perception → PII Detector/Redactor → Sanitized Payload → Reasoner → Policy Engine → Approval UI → Target Revalidation → Safe Execution → Audit Log`

- **Detailed Trust Boundary Components:**
  1. **Browser Page & Content Script:** Scans interactive elements, computes normalized bounding boxes $[0, 1]$, and eliminates aria-hidden and hidden nodes.
  2. **Local DOM/Accessibility Perception (`@sih26171/perception`):** Extracts semantic roles, accessibility labels, and enforces context ranking and payload budgets ($\le 40$ elements, $\le 32$ KB).
  3. **PII Detector & Redactor (`@sih26171/privacy`):** Detects structured sensitive identifiers (emails, Indian phone numbers, PAN, credit cards, passwords) and substitutes deterministic category tokens (`[EMAIL]`, `[PHONE]`, `[GOV_ID]`, `[FINANCIAL]`, `[PASSWORD]`).
  4. **Sanitized Payload (`AgentRequest`):** Carries verified DOM context, zero screenshot pixels, and privacy proofs.
  5. **Reasoner:** Central server or local deterministic reasoner proposes actions based on sanitized context.
  6. **Policy Engine (`@sih26171/policy`):** Evaluates action risk locally (`LOW`, `MEDIUM`, `HIGH`, `BLOCKED`). Enforces invariant: “Server responses cannot bypass local policy.”
  7. **Approval UI:** Side panel renders human confirmation card with explicit action, target, risk, and reason for all HIGH-risk actions.
  8. **Target Revalidation & Safe Action:** Pre-execution DOM re-read revalidates target fingerprint, connectivity, and visibility before triggering action.
  9. **Sanitized Audit Log:** Logs action metadata only, with zero secret leakage.

---

### Slide 4: Working Prototype Evidence

- **Demonstrated Live Chrome Flow (Installed Chrome + Clean Profile):**
  1. **Seeded Test Fixture (`fixtures/seeded-test-page.html`):** Renders dark-mode interface with synthetic warning banner, synthetic email, phone (+91 90000 12345), PAN, credit card, and `#download-report` button.
  2. **SIH Redaction Targets Explicit Breakdown:**
     - *Passwords:* Input-type and autocomplete heuristics omit password values completely (`[automated-tested]`).
     - *Text PII:* Multi-pattern detector masks emails, phones, PAN, and credit cards with category tokens (`[automated-tested]`).
     - *Faces / Visual Data:* Zero-pixel transmission boundary (`image_base64: ""`, `raw_pixels_sent: false`) prevents any visual leaks in MVP; on-device canvas pixel blurring is staged as Phase 2/3 Roadmap (`[planned/not implemented]`).
  3. **Privacy Firewall HUD:** User clicks *Scan Active Page*. Firewall status displays **PASS** with zero-transmission tiles (`NO` for raw DOM, `NO` for screenshot pixels, `NO` for cookies/secrets) and category breakdown tags.
  4. **Task Input & Central Reasoning:** User runs task: `"Click Download Report"`. Local deterministic reasoner matches target to `#download-report` (confidence: 0.95) in demo mode.
  5. **HIGH-Risk Approval Card:** Side panel displays high-risk approval card (Action: `click`, Target: `Download Report`, Risk: `HIGH`, Reason: `This action may create a file.`).
  6. **Cancellation & Safety Verification:** User cancellation blocks execution cleanly (`clickCount === 0`).
  7. **Approval & Revalidation:** User clicks *Approve and execute*. Target is revalidated; click triggers green animated success banner (*"Report downloaded successfully! Click count: 1"*).
  8. **Live Validation Status:** All 18 criteria verified in live Google Chrome and archived in `docs/evidence/phase1/` ([01-seeded-page.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/01-seeded-page.png), [02-privacy-hud.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/02-privacy-hud.png), [03-approval-card.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/03-approval-card.png), [04-success-state.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/04-success-state.png)).

---

### Slide 5: Empirical Measurements & Repeatability Statistics

- **Workspace Build & Automated Testing:**
  - Build Status: Clean build across all 6 workspaces (`npm run build`, exit code 0).
  - Automated Tests: **113 passed tests** across 6 test suites (`npm test`, 0 failed).
    - `@sih26171/extension`: 85 passed (validation, security-and-network, pii-detection, phase1-vertical-slice).
    - `@sih26171/policy`: 22 passed (risk rules, approval state machine, fingerprinting).
    - `@sih26171/perception`: 6 passed (payload budget, context ranking, target preservation).
- **Benchmark Evaluation:**
  - Benchmark Type: “Synthetic-fixture benchmark evaluation.”
  - Overall Weighted Score: **96.8%** maintained against baseline fixture (`fixtures/pii-seeded-page.ts`).
  - Visual Context Accuracy (25% weight): 87.1%
  - PII Detection Recall & Precision (20% weight): 100.0% (12 of 12 synthetic entities detected)
  - Redaction Precision (20% weight): 100.0%
- **10-Run Latency Statistics (Workstream 4, Mean $\pm$ StdDev):**
  - PII Detection: $\mu = 0.09\text{ ms}$ ($\text{min}=0.04\text{ ms}, \text{max}=0.14\text{ ms}, \sigma=0.03\text{ ms}$)
  - Redaction: $\mu = 0.19\text{ ms}$ ($\text{min}=0.06\text{ ms}, \text{max}=0.89\text{ ms}, \sigma=0.23\text{ ms}$)
  - Sanitized Serialization: $\mu = 0.06\text{ ms}$ ($\text{min}=0.02\text{ ms}, \text{max}=0.28\text{ ms}, \sigma=0.07\text{ ms}$)
  - Total Local Pipeline: $\mu = 0.34\text{ ms}$ ($\text{min}=0.17\text{ ms}, \text{max}=1.05\text{ ms}, \sigma=0.25\text{ ms}$)
- **Payload Budget & Privacy Guarantees:**
  - Serialized Payload: **1.36 KB** actual request body vs **32 KB limit** (95.7% bandwidth headroom).
  - Zero Screenshot Pixels: `image_base64: ""` and `raw_pixels_sent: false`.
  - Zero Raw Secrets: 0 seeded passwords, emails, phone numbers, PAN, or credit cards transmitted.

---

### Slide 6: Differentiation, Roadmap & Architectural References

- **Key Differentiators:**
  - **Local PII Firewall:** Sanitization occurs client-side before any network transit; fail-closed verification prevents accidental leakage.
  - **Zero-Pixel MVP Boundary:** Completely eliminates visual privacy risks by operating on structured semantic accessibility geometry.
  - **Client-Side Action Governance:** Non-bypassable local risk policies and cryptographically bound approval tokens prevent server-side action forgery.
  - **Evidence-Driven Testing:** 113 automated unit/integration tests and automated live CDP Chrome validation.
- **Architectural Reference Studies:**
  - “External repositories were studied, not integrated.”
  - *Browser Use:* Studied structured element tree representations and lifecycle management.
  - *PinchTab:* Explored lightweight DOM extraction boundaries.
  - *TrueForge:* Analyzed agent session flow and approval state machine patterns.
- **Engineering Roadmap:**
  - **P1:** Live multi-site evaluation benchmark on real-world e-commerce and banking portals.
  - **P2:** Local on-device pixel-level screenshot redaction (HTML5 Canvas bounding box blurring).
  - **P3:** Privacy-preserving on-device local model (WebGPU small language model for complex semantic reasoning).
