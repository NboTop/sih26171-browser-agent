# Baseline Report — Phase 0 Freeze

**Date / Timestamp:** 2026-09-27T10:43:00+05:30  
**Repository:** SIH26171 PrivacySight Agent  
**Backup Path:** `C:\Users\Dell\.gemini\antigravity-ide\scratch\sih26171-browser-agent-backup-phase0`  
**Status:** Frozen prior to Phase 1 Vertical Slice implementation. This baseline file will NOT be overwritten.

---

## 1. Build Result
- **Status:** PASS (exit code 0)
- **Workspaces Built:**
  - `@sih26171/protocol@0.1.0` (tsc -p tsconfig.json)
  - `@sih26171/privacy@0.1.0` (tsc -p tsconfig.json)
  - `@sih26171/perception@0.1.0` (tsc -p tsconfig.json)
  - `@sih26171/evaluation@0.1.0` (tsc -p tsconfig.json)
  - `@sih26171/extension@0.1.0` (Chrome and Firefox dist bundles via esbuild)
  - `@sih26171/server@0.1.0` (tsc -p tsconfig.json)

## 2. Test Suite Result
- **Runner:** vitest v2.1.9
- **Status:** PASS (exit code 0)
- **Total Test Files:** 3
- **Total Tests Passed:** 67 / 67 (0 failed)
- **Breakdown:**
  - `src/__tests__/validation.test.ts`: 31 passed
  - `src/__tests__/security-and-network.test.ts`: 10 passed
  - `src/__tests__/pii-detection.test.ts`: 26 passed
- **Duration:** ~707ms

## 3. Evaluation Harness Result
- **Script:** `tsx src/run-evaluation.ts` (@sih26171/evaluation)
- **Benchmark Type:** Synthetic-fixture benchmark evaluation (`fixtures/pii-seeded-page.ts`)
- **Metric Breakdown:**
  1. Visual Context Accuracy (25% weight): 87.1% (elements=14, hasBBox=true, roleRatio=0.36)
  2. PII Detection Recall & Precision (20% weight): 100.0% (TP=12, FP=0, FN=0, F1=1.00)
  3. Redaction Precision (20% weight): 100.0% (12/12 elements redacted, verification=true)
  4. Client Resource Utilization (20% weight): 100.0% (detection=0.08ms, redaction=0.28ms, total=0.36ms)
  5. End-to-End Latency (15% weight): 100.0% (total pipeline latency=2.88ms)
- **Overall Weighted Score:** 96.8%

## 4. Files Tracked / Changed Afterward
This baseline records state prior to Phase 1. Subsequent phases will record their diffs relative to this baseline.
