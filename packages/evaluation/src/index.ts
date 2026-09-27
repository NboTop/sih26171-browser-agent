// ─── packages/evaluation/src/index.ts ───
// Evaluation harness for the five scoring criteria.
// Runs against fixtures and reports scores.

import type { DOMElement, PIICategory, RedactionEntry } from '@sih26171/protocol';
import { detectAllPII, redactElements, verifyPrivacy } from '@sih26171/privacy';

export interface EvaluationResult {
  /** Visual-context accuracy (25%): are elements correctly extracted with bbox? */
  visual_context: { score: number; details: string };
  /** PII detection recall and precision (20%): did we find all PII? */
  pii_detection: {
    score: number;
    recall: number;
    precision: number;
    true_positives: number;
    false_positives: number;
    false_negatives: number;
    details: string;
  };
  /** Redaction precision (20%): are redacted values actually masked? */
  redaction: { score: number; details: string };
  /** Client resource utilization (20%): timing and efficiency. */
  resource_utilization: {
    score: number;
    detection_ms: number;
    redaction_ms: number;
    elements_processed: number;
    details: string;
  };
  /** End-to-end latency (15%): total pipeline timing. */
  latency: { score: number; total_ms: number; details: string };
  /** Overall weighted score. */
  overall: number;
}

export function evaluate(
  elements: DOMElement[],
  expectedPII: Array<{ element_id: string; categories: string[] }>,
  expectedClean: string[]
): EvaluationResult {
  const start = performance.now();

  // ─── 1. Visual Context (25%) ───
  const hasElements = elements.length > 0;
  const hasBBox = elements.every(
    el => el.bbox && typeof el.bbox.x === 'number' && typeof el.bbox.y === 'number'
  );
  const hasRoles = elements.filter(el => el.role !== null).length / Math.max(1, elements.length);
  const hasIds = elements.every(el => el.id && el.id.length > 0);
  const visualScore =
    (hasElements ? 0.3 : 0) +
    (hasBBox ? 0.3 : 0) +
    hasRoles * 0.2 +
    (hasIds ? 0.2 : 0);

  // ─── 2. PII Detection (20%) ───
  const detectedMap = detectAllPII(elements);

  let tp = 0, fp = 0, fn = 0;

  for (const expected of expectedPII) {
    const matches = detectedMap.get(expected.element_id);
    if (matches && matches.length > 0) {
      const detectedCats = new Set(matches.map(m => m.category));
      for (const cat of expected.categories) {
        if (detectedCats.has(cat as PIICategory)) {
          tp++;
        } else {
          fn++;
        }
      }
    } else {
      fn += expected.categories.length;
    }
  }

  // False positives: clean elements that were flagged
  for (const cleanId of expectedClean) {
    const matches = detectedMap.get(cleanId);
    if (matches && matches.length > 0) {
      fp += matches.length;
    }
  }

  const recall = tp / Math.max(1, tp + fn);
  const precision = tp / Math.max(1, tp + fp);
  const f1 = 2 * (precision * recall) / Math.max(0.001, precision + recall);

  // ─── 3. Redaction (20%) ───
  const redactionResult = redactElements(elements);
  const verification = verifyPrivacy(redactionResult.elements, redactionResult.manifest);

  // Check that PII values are actually replaced in output
  let redactionCorrect = 0;
  let redactionTotal = 0;
  for (const expected of expectedPII) {
    const original = elements.find(el => el.id === expected.element_id);
    const redacted = redactionResult.elements.find(el => el.id === expected.element_id);
    if (original && redacted) {
      redactionTotal++;
      // If the redacted text differs from original, redaction happened
      if (redacted.text !== original.text || redactionResult.manifest.some(r => r.element_id === expected.element_id)) {
        redactionCorrect++;
      }
    }
  }
  const redactionScore = redactionTotal > 0 ? redactionCorrect / redactionTotal : 0;

  // ─── 4. Resource Utilization (20%) ───
  // Score based on timing — under 10ms is excellent
  const detMs = redactionResult.detection_ms;
  const redMs = redactionResult.redaction_ms;
  const totalProcessing = detMs + redMs;
  let resourceScore: number;
  if (totalProcessing < 5) resourceScore = 1.0;
  else if (totalProcessing < 10) resourceScore = 0.9;
  else if (totalProcessing < 50) resourceScore = 0.7;
  else if (totalProcessing < 200) resourceScore = 0.5;
  else resourceScore = 0.3;

  // ─── 5. Latency (15%) ───
  const totalMs = performance.now() - start;
  let latencyScore: number;
  if (totalMs < 20) latencyScore = 1.0;
  else if (totalMs < 50) latencyScore = 0.9;
  else if (totalMs < 200) latencyScore = 0.7;
  else if (totalMs < 1000) latencyScore = 0.5;
  else latencyScore = 0.3;

  // ─── Overall ───
  const overall =
    visualScore * 0.25 +
    f1 * 0.20 +
    redactionScore * 0.20 +
    resourceScore * 0.20 +
    latencyScore * 0.15;

  return {
    visual_context: {
      score: visualScore,
      details: `elements=${elements.length}, hasBBox=${hasBBox}, roleRatio=${hasRoles.toFixed(2)}`,
    },
    pii_detection: {
      score: f1,
      recall,
      precision,
      true_positives: tp,
      false_positives: fp,
      false_negatives: fn,
      details: `TP=${tp}, FP=${fp}, FN=${fn}, recall=${recall.toFixed(2)}, precision=${precision.toFixed(2)}`,
    },
    redaction: {
      score: redactionScore,
      details: `${redactionCorrect}/${redactionTotal} elements correctly redacted, verification=${verification.passed}`,
    },
    resource_utilization: {
      score: resourceScore,
      detection_ms: detMs,
      redaction_ms: redMs,
      elements_processed: elements.length,
      details: `detection=${detMs.toFixed(2)}ms, redaction=${redMs.toFixed(2)}ms, total=${totalProcessing.toFixed(2)}ms`,
    },
    latency: {
      score: latencyScore,
      total_ms: totalMs,
      details: `total=${totalMs.toFixed(2)}ms`,
    },
    overall,
  };
}

export interface StatSummary {
  min: number;
  max: number;
  mean: number;
  stddev: number;
  sample_count: number;
}

export interface RepeatabilityMetrics {
  detection: StatSummary;
  redaction: StatSummary;
  serialization: StatSummary;
  total_local_pipeline: StatSummary;
}

export function runRepeatabilityBenchmark(
  elements: DOMElement[],
  iterations: number = 10
): RepeatabilityMetrics {
  const detectionTimes: number[] = [];
  const redactionTimes: number[] = [];
  const serializationTimes: number[] = [];
  const totalTimes: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const iterStart = performance.now();

    // 1. Detection
    const detStart = performance.now();
    detectAllPII(elements);
    const detMs = performance.now() - detStart;
    detectionTimes.push(detMs);

    // 2. Redaction
    const redStart = performance.now();
    const redacted = redactElements(elements);
    const redMs = performance.now() - redStart;
    redactionTimes.push(redMs);

    // 3. Sanitized Serialization
    const serStart = performance.now();
    const jsonStr = JSON.stringify({ page_title: 'Document', elements: redacted.elements });
    new TextEncoder().encode(jsonStr);
    const serMs = performance.now() - serStart;
    serializationTimes.push(serMs);

    const totalMs = performance.now() - iterStart;
    totalTimes.push(totalMs);
  }

  function calcStats(nums: number[]): StatSummary {
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = sum / nums.length;
    const variance = nums.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / nums.length;
    const stddev = Math.sqrt(variance);
    return {
      min: Number(min.toFixed(3)),
      max: Number(max.toFixed(3)),
      mean: Number(mean.toFixed(3)),
      stddev: Number(stddev.toFixed(3)),
      sample_count: nums.length,
    };
  }

  return {
    detection: calcStats(detectionTimes),
    redaction: calcStats(redactionTimes),
    serialization: calcStats(serializationTimes),
    total_local_pipeline: calcStats(totalTimes),
  };
}
