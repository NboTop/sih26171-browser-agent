// ─── packages/perception/src/__tests__/payload-budget.test.ts ───
// Tests for payload budgeting, context ranking, and target preservation (Workstream 3).

import { describe, it, expect } from 'vitest';
import type { DOMElement } from '@sih26171/protocol';
import {
  rankAndBudgetElements,
  computeElementRelevanceScore,
  DEFAULT_MAX_ELEMENTS,
  DEFAULT_MAX_PAYLOAD_BYTES,
} from '../payload-budget.js';

describe('Workstream 3: Payload Budget & Context Ranking', () => {
  const downloadReportEl: DOMElement = {
    id: 'download-report',
    tag: 'button',
    role: 'button',
    text: 'Download Report',
    aria_label: 'Download Report',
    input_type: null,
    value_state: 'empty',
    disabled: false,
    visible: true,
    bbox: { x: 0.2, y: 0.6, w: 0.15, h: 0.05 },
    attributes: { autocomplete: null, data_agent_id: 'download-report' },
  };

  function generateElements(count: number): DOMElement[] {
    const list: DOMElement[] = [];
    for (let i = 1; i <= count; i++) {
      list.push({
        id: `el_${String(i).padStart(3, '0')}`,
        tag: i % 2 === 0 ? 'button' : 'div',
        role: i % 2 === 0 ? 'button' : 'generic',
        text: `Generic element item ${i}`,
        aria_label: `Item ${i}`,
        input_type: null,
        value_state: 'empty',
        disabled: false,
        visible: true,
        bbox: { x: 0.1, y: (i % 20) * 0.05, w: 0.2, h: 0.03 },
        attributes: { autocomplete: null, data_agent_id: `el_${String(i).padStart(3, '0')}` },
      });
    }
    return list;
  }

  it('caps element count at maxElements (default 40)', () => {
    const elements = generateElements(60);
    // Add the download report button into the middle
    elements.splice(30, 0, downloadReportEl);

    const result = rankAndBudgetElements(elements, 'Test Page', {
      taskGoal: 'Click Download Report button',
    });

    expect(result.original_element_count).toBe(61);
    expect(result.retained_element_count).toBe(DEFAULT_MAX_ELEMENTS);
    expect(result.dropped_element_count).toBe(21);
    expect(result.context_truncated).toBe(true);
    expect(result.context.elements.length).toBe(DEFAULT_MAX_ELEMENTS);
  });

  it('guarantees critical target (#download-report) is preserved even when list is truncated', () => {
    const elements = generateElements(80);
    // Place target near the end
    elements.push(downloadReportEl);

    const result = rankAndBudgetElements(elements, 'Test Page', {
      taskGoal: 'Find the download report button and click it',
      maxElements: 40,
      preserveTargetIds: ['download-report'],
    });

    expect(result.context.elements.length).toBe(40);
    const hasTarget = result.context.elements.some(e => e.id === 'download-report');
    expect(hasTarget).toBe(true);
    expect(result.target_preserved).toBe(true);
  });

  it('enforces byte budget ceiling (32 KB default) and verifies post-serialization bytes', () => {
    // Generate elements with long text that would exceed 32 KB
    const heavyElements: DOMElement[] = [];
    for (let i = 1; i <= 80; i++) {
      heavyElements.push({
        id: `heavy_el_${i}`,
        tag: 'div',
        role: 'article',
        text: 'A'.repeat(800), // ~800 bytes per element
        aria_label: 'Long article text',
        input_type: null,
        value_state: 'empty',
        disabled: false,
        visible: true,
        bbox: { x: 0.1, y: 0.1, w: 0.5, h: 0.1 },
        attributes: { autocomplete: null, data_agent_id: `heavy_el_${i}` },
      });
    }
    heavyElements.push(downloadReportEl);

    const result = rankAndBudgetElements(heavyElements, 'Heavy Document', {
      maxElements: 40,
      maxPayloadBytes: 32 * 1024,
      taskGoal: 'download report',
      preserveTargetIds: ['download-report'],
    });

    expect(result.serialized_payload_bytes).toBeLessThanOrEqual(32 * 1024);
    expect(result.target_preserved).toBe(true);
    const hasTarget = result.context.elements.some(e => e.id === 'download-report');
    expect(hasTarget).toBe(true);

    // Verify exact serialized bytes
    const encoder = new TextEncoder();
    const actualBytes = encoder.encode(JSON.stringify(result.context)).length;
    expect(actualBytes).toBe(result.serialized_payload_bytes);
    expect(actualBytes).toBeLessThanOrEqual(DEFAULT_MAX_PAYLOAD_BYTES);
  });

  it('filters out hidden and aria-hidden elements during ranking', () => {
    const elements: DOMElement[] = [
      downloadReportEl,
      {
        id: 'hidden-el',
        tag: 'button',
        role: 'button',
        text: 'Hidden Trap',
        aria_label: 'Hidden',
        input_type: null,
        value_state: 'empty',
        disabled: false,
        visible: false, // Hidden!
        bbox: { x: 0, y: 0, w: 0, h: 0 },
        attributes: { autocomplete: null, data_agent_id: 'hidden-el' },
      },
      {
        id: 'aria-hidden-el',
        tag: 'button',
        role: 'button',
        text: 'Aria Hidden Trap',
        aria_label: 'Aria Hidden',
        input_type: null,
        value_state: 'empty',
        disabled: false,
        visible: true,
        bbox: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 },
        attributes: { autocomplete: null, data_agent_id: 'aria-hidden-el', 'aria-hidden': 'true' },
      },
    ];

    const result = rankAndBudgetElements(elements, 'Filter Test', {
      taskGoal: 'Click Download Report',
    });

    expect(result.context.elements.length).toBe(1);
    expect(result.context.elements[0].id).toBe('download-report');
  });

  it('ranks elements deterministically based on task keywords and interactivity', () => {
    const btn1: DOMElement = {
      id: 'btn-misc',
      tag: 'button',
      role: 'button',
      text: 'Miscellaneous Options',
      aria_label: 'Options',
      input_type: null,
      value_state: 'empty',
      disabled: false,
      visible: true,
      bbox: { x: 0.1, y: 0.1, w: 0.2, h: 0.05 },
      attributes: { autocomplete: null, data_agent_id: 'btn-misc' },
    };

    const btnDownload: DOMElement = {
      id: 'custom-download',
      tag: 'button',
      role: 'button',
      text: 'Download Invoices',
      aria_label: 'Download Invoice Archive',
      input_type: null,
      value_state: 'empty',
      disabled: false,
      visible: true,
      bbox: { x: 0.1, y: 0.5, w: 0.2, h: 0.05 },
      attributes: { autocomplete: null, data_agent_id: 'custom-download' },
    };

    const taskKeywords = ['download', 'invoices'];
    const preserveSet = new Set<string>();

    const score1 = computeElementRelevanceScore(btn1, taskKeywords, preserveSet);
    const scoreDownload = computeElementRelevanceScore(btnDownload, taskKeywords, preserveSet);

    expect(scoreDownload).toBeGreaterThan(score1);
  });

  it('fails closed when budget cannot accommodate critical target', () => {
    const hugeDownloadBtn: DOMElement = {
      ...downloadReportEl,
      text: 'X'.repeat(5000), // 5 KB
    };

    const result = rankAndBudgetElements([hugeDownloadBtn], 'Tiny Budget', {
      maxPayloadBytes: 500, // Impossibly small budget (500 bytes)
      preserveTargetIds: ['download-report'],
    });

    expect(result.status).toBe('target_context_unavailable');
    expect(result.target_preserved).toBe(false);
    expect(result.context.elements.length).toBe(0);
    expect(result.error).toContain('target context unavailable');
  });
});
