// ─── packages/evaluation/src/run-evaluation.ts ───
// Runs evaluation harness against the seeded fixture and outputs measurements.

import { evaluate, runRepeatabilityBenchmark } from './index.js';
import {
  PII_SEEDED_ELEMENTS,
  EXPECTED_PII,
  EXPECTED_CLEAN,
} from '../../../fixtures/pii-seeded-page.js';

console.log('='.repeat(60));
console.log('  SIH26171 PrivacySight Agent — Evaluation Harness');
console.log('='.repeat(60));

const results = evaluate(PII_SEEDED_ELEMENTS, EXPECTED_PII, EXPECTED_CLEAN);

console.log('\n--- 1. Visual Context Accuracy (Weight: 25%) ---');
console.log(`Score: ${(results.visual_context.score * 100).toFixed(1)}%`);
console.log(`Details: ${results.visual_context.details}`);

console.log('\n--- 2. PII Detection Recall & Precision (Weight: 20%) ---');
console.log(`Score (F1): ${(results.pii_detection.score * 100).toFixed(1)}%`);
console.log(`Recall: ${(results.pii_detection.recall * 100).toFixed(1)}%`);
console.log(`Precision: ${(results.pii_detection.precision * 100).toFixed(1)}%`);
console.log(`True Positives: ${results.pii_detection.true_positives}`);
console.log(`False Positives: ${results.pii_detection.false_positives}`);
console.log(`False Negatives: ${results.pii_detection.false_negatives}`);
console.log(`Details: ${results.pii_detection.details}`);

console.log('\n--- 3. Redaction Precision (Weight: 20%) ---');
console.log(`Score: ${(results.redaction.score * 100).toFixed(1)}%`);
console.log(`Details: ${results.redaction.details}`);

console.log('\n--- 4. Client Resource Utilization (Weight: 20%) ---');
console.log(`Score: ${(results.resource_utilization.score * 100).toFixed(1)}%`);
console.log(`Detection: ${results.resource_utilization.detection_ms.toFixed(2)} ms`);
console.log(`Redaction: ${results.resource_utilization.redaction_ms.toFixed(2)} ms`);
console.log(`Elements Processed: ${results.resource_utilization.elements_processed}`);
console.log(`Details: ${results.resource_utilization.details}`);

console.log('\n--- 5. End-to-End Latency (Weight: 15%) ---');
console.log(`Score: ${(results.latency.score * 100).toFixed(1)}%`);
console.log(`Total Pipeline Latency: ${results.latency.total_ms.toFixed(2)} ms`);
console.log(`Details: ${results.latency.details}`);

// ─── 6. Repeatability Evaluation (Workstream 4) ───
const repeatability = runRepeatabilityBenchmark(PII_SEEDED_ELEMENTS, 10);
console.log('\n--- 6. Repeatability Statistics (10-run sample, Workstream 4) ---');
console.log(`Sample Count: ${repeatability.total_local_pipeline.sample_count} consecutive runs`);
console.log(`Detection:     mean=${repeatability.detection.mean.toFixed(2)}ms (min=${repeatability.detection.min.toFixed(2)}ms, max=${repeatability.detection.max.toFixed(2)}ms, stddev=${repeatability.detection.stddev.toFixed(2)}ms)`);
console.log(`Redaction:     mean=${repeatability.redaction.mean.toFixed(2)}ms (min=${repeatability.redaction.min.toFixed(2)}ms, max=${repeatability.redaction.max.toFixed(2)}ms, stddev=${repeatability.redaction.stddev.toFixed(2)}ms)`);
console.log(`Serialization: mean=${repeatability.serialization.mean.toFixed(2)}ms (min=${repeatability.serialization.min.toFixed(2)}ms, max=${repeatability.serialization.max.toFixed(2)}ms, stddev=${repeatability.serialization.stddev.toFixed(2)}ms)`);
console.log(`Total Pipeline:mean=${repeatability.total_local_pipeline.mean.toFixed(2)}ms (min=${repeatability.total_local_pipeline.min.toFixed(2)}ms, max=${repeatability.total_local_pipeline.max.toFixed(2)}ms, stddev=${repeatability.total_local_pipeline.stddev.toFixed(2)}ms)`);

console.log('\n' + '='.repeat(60));
console.log(`OVERALL WEIGHTED SCORE: ${(results.overall * 100).toFixed(1)}%`);
console.log('='.repeat(60));
