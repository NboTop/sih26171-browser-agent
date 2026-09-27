export {
  extractDOM,
  getViewportInfo,
  resetElementCounter,
  type ExtractionResult,
} from './dom-extractor.js';
export {
  captureScreenshot,
  computeSHA256,
  stripDataUrlPrefix,
  getImageDimensions,
  type CaptureResult,
} from './screenshot.js';
export {
  rankAndBudgetElements,
  computeElementRelevanceScore,
  DEFAULT_MAX_ELEMENTS,
  DEFAULT_MAX_PAYLOAD_BYTES,
  type PayloadBudgetOptions,
  type BudgetedDOMResult,
} from './payload-budget.js';
