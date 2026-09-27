# PrivacySight Agent — SIH Evaluation Rubric Mapping
**Project:** SIH26171 — On-device Visual Perception for Lightweight Browser Agents  
**Scoring Rubric Alignment:** Official Smart India Hackathon Evaluation Criteria

---

## Rubric Weight Summary

| Scoring Criterion | Weight | Measured Prototype Performance | Prototype Status |
| :--- | :---: | :---: | :---: |
| **1. Visual-Context Accuracy** | **25%** | **87.1%** (BBox, ARIA roles, normalized layout) | **Exceeds Baseline** |
| **2. Sensitive/PII Detection (Recall & Precision)** | **20%** | **100.0%** on synthetic fixture (F1: 1.00; TP: 12, FP: 0, FN: 0) | **Exceeds Baseline** |
| **3. Redaction Precision** | **20%** | **100.0%** (12/12 masked, verified fail-closed) | **Exceeds Baseline** |
| **4. Client Resource Utilization** | **20%** | **100.0%** (0.51 ms local processing overhead, 0 external ML weights) | **Exceeds Baseline** |
| **5. End-to-End Latency** | **15%** | **3.76 ms** local harness latency (WAN: *not measured*) | **Exceeds Baseline** |
| **Overall Weighted Score** | **100%** | **96.8%** *(on deterministic benchmark harness)* | **Strong SIH Submission** |

---

## Detailed Criterion Mapping

### 1. Visual-Context Accuracy (Weight: 25%)

- **Objective:** Can the agent accurately perceive the webpage's visual structure, identify actionable components, and localize them spatially?
- **Implementation Modules:**
  - `packages/perception/src/dom-extractor.ts`: Traverses interactive DOM nodes (`button`, `a`, `input`, `select`, `textarea`, ARIA roles).
  - `packages/perception/src/screenshot.ts`: Local viewport canvas capture with normalized coordinate projection.
  - `packages/protocol/src/validation.ts`: `validateBBox` strictly bounds coordinates to $[0, 1]$.
- **Evaluation Formula in Harness:**
  $$\text{Score} = (0.3 \times \text{hasElements}) + (0.3 \times \text{hasBBox}) + (0.2 \times \text{roleRatio}) + (0.2 \times \text{hasIds})$$
- **Measured Result:**
  - Elements Extracted: 14 / 14
  - Bounding Box Validity: 100% ($x, y, w, h \in [0, 1]$)
  - Interactive Role Ratio: 36%
  - Element ID Stability: 100% (deterministic agent IDs assigned)
  - **Component Score:** **87.1%**

---

### 2. Sensitive / PII Detection Recall & Precision (Weight: 20%)

- **Objective:** Does the system detect sensitive information before any network packet is dispatched, maintaining high recall (zero leaks) and high precision (minimal false alarms)?
- **Implementation Modules:**
  - `packages/privacy/src/pii-detector.ts`: Multi-pattern detection covering:
    - Indian Mobile Numbers: `/(?:(?:\+91[\s\-]?)|\b)[6-9]\d{4}[\s\-]?\d{5}\b/g`
    - International Phones: `/(?:\+?\d{1,3}[\s\-]?)?\(?\d{2,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{4}\b/g`
    - Indian PAN Cards: `/\b[A-Z]{5}\d{4}[A-Z]\b/g`
    - Aadhaar Identifiers: `/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g`
    - Credit Card Numbers: `/\b(?:\d{4}[\s\-]?){3}\d{4}\b/g`
    - Email Addresses: Standard RFC 5322 regex
    - Passwords & Secrets: Input type heuristics (`input[type="password"]`), autocomplete tags (`current-password`, `new-password`), and label inferences.
- **Evaluation Formula in Harness:**
  $$\text{Recall} = \frac{\text{TP}}{\text{TP} + \text{FN}}, \quad \text{Precision} = \frac{\text{TP}}{\text{TP} + \text{FP}}, \quad F_1 = \frac{2 \cdot \text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$$
- **Measured Result on Synthetic Fixture:**
  - True Positives (TP): 12
  - False Negatives (FN): 0
  - False Positives (FP): 0 (clean button and clean link not flagged)
  - Recall: **1.00 (100.0%)**
  - Precision: **1.00 (100.0%)**
  - F1 Score: **1.00 (100.0%)**
  - *Boundary Limitation:* Figures established on supplied deterministic benchmark; arbitrary free-text web forms may exhibit lower recall.

---

### 3. Redaction Precision (Weight: 20%)

- **Objective:** Are detected sensitive items properly masked, leaving zero raw secrets in outbound requests while preserving safe interactive elements?
- **Implementation Modules:**
  - `packages/privacy/src/redactor.ts`: `redactText` replaces sensitive spans with category masks (`[EMAIL]`, `[PHONE]`, `[GOV_ID]`, `[FINANCIAL]`) and filters overlapping matches.
  - `packages/privacy/src/sanitizer.ts`: `sanitizeBeforeSend` constructs `AgentRequest` with `raw_pixels_sent: false` and `raw_dom_values_sent: false`.
  - `apps/extension/src/__tests__/security-and-network.test.ts`: Network spy asserts that `fake.email@example.test`, `+91 90000 12345`, `fake password`, `ABCDE1234F`, and `4111 1111 1111 1111` are strictly absent from the serialized JSON payload.
- **Evaluation Formula in Harness:**
  $$\text{Score} = \frac{\text{Redacted Correctly}}{\text{Total Expected}} \quad (\text{penalized to } 0 \text{ if privacy verification fails})$$
- **Measured Result:**
  - Correctly Masked Elements: 12 / 12
  - Pre-flight Privacy Verification: **Passed**
  - Safe Interactive Target ("Download Report"): Preserved unredacted
  - **Component Score:** **100.0%**

---

### 4. Client Resource Utilization (Weight: 20%)

- **Objective:** Does the extension operate with minimal client-side resource overhead without slowing down user browsing?
- **Implementation Modules:**
  - Native TypeScript execution utilizing browser built-in DOM APIs.
  - Zero heavy neural network weights or WebGPU runtime loaded for baseline perception.
  - Single-pass regex evaluation on visible element subsets rather than raw whole-DOM string dumps.
- **Evaluation Formula in Harness:**
  - Total local processing time $< 20\text{ ms} \implies 1.00$
  - Elements processed: 14
- **Measured Result:**
  - Local PII Detection Latency (10-run mean): **0.09 ms** (stddev: 0.03 ms)
  - Local Redaction Latency (10-run mean): **0.19 ms** (stddev: 0.23 ms)
  - Sanitized Serialization (10-run mean): **0.06 ms** (stddev: 0.07 ms)
  - Total Local Pipeline Latency (10-run mean): **0.34 ms** (stddev: 0.25 ms)
  - GPU Memory Allocated: **0 MB** (zero WebGPU requirement)
  - **Component Score:** **100.0%**

---

### 5. End-to-End Latency (Weight: 15%)

- **Objective:** Does the perception-to-action cycle operate efficiently within interactive human tolerances?
- **Implementation Modules:**
  - Synchronous pre-flight firewall (`sanitizeBeforeSend`) completes in $< 1\text{ ms}$.
  - Lightweight payload size (**1.36 KB** vs 32 KB ceiling) minimizes serialization and transfer time compared to multi-megabyte image streaming.
  - Client command validation (`validateAgentResponse`) executes in $< 0.1\text{ ms}$.
- **Measured Result:**
  - Full Evaluation Harness Pipeline Latency: **3.23 ms**
  - Simulated Server Inference Delay: **50 ms**
  - Total Roundtrip in Local Testbed: $\approx 55\text{ ms}$
  - Real WAN Network Roundtrip: *not measured* (depends on remote server geographical hosting)
  - **Component Score:** **100.0%** (benchmark threshold $< 500\text{ ms}$)

---

## Verification Reproducibility Instructions

Any evaluator can independently reproduce all rubric scores using the standard commands:

```powershell
# 1. Compile entire monorepo (all 6 workspaces)
npm run build

# 2. Run automated test suite (113 passing tests across 6 files)
npm test

# 3. Run evaluation scoring harness (96.8% overall score + 10-run statistics)
npm run evaluate

# 4. Run static security audit (0 executable patterns matched)
node scripts/static-security-scan.cjs

# 5. Run live Chrome validation (all 18 criteria verified)
node scripts/validate-live-chrome.cjs
```
