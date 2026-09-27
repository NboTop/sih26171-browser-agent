// ─── apps/server/src/index.ts ───
// Mock server for development and testing.
// Implements the canonical server response contract.
// Uses Node.js built-in HTTP server (no Express dependency).

import { createServer, IncomingMessage, ServerResponse } from 'http';
import type {
  AgentRequest,
  AgentResponse,
  ActionCommand,
} from '@sih26171/protocol';
import { PROTOCOL_VERSION, ALLOWED_ACTION_TYPES } from '@sih26171/protocol';

const PORT = parseInt(process.env.PORT || '3001', 10);

export function generateResponse(request: AgentRequest): AgentResponse {
  const elements = request.dom_context.elements;

  // Strategy: find the first clickable element matching the task goal
  const goalLower = request.task.goal.toLowerCase();

  // Score elements by relevance to goal
  const scored = elements
    .filter(el => el.visible && !el.disabled)
    .map(el => {
      let score = 0;
      const text = (el.text + ' ' + (el.aria_label || '')).toLowerCase();
      // Keyword matching
      for (const word of goalLower.split(/\s+/)) {
        if (word.length > 2 && text.includes(word)) score += 10;
      }
      // Prefer interactive elements
      if (['button', 'link', 'textbox', 'combobox'].includes(el.role || '')) score += 5;
      if (['a', 'button', 'input', 'select'].includes(el.tag)) score += 3;
      return { el, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0 || scored[0].score === 0) {
    return {
      protocol_version: PROTOCOL_VERSION,
      request_id: request.request_id,
      status: 'ok',
      action: {
        type: 'observe',
        target: {
          element_id: 'none',
          bbox: { x: 0, y: 0, w: 0, h: 0 },
          selector_hint: '',
          text_hint: '',
        },
        arguments: {},
        confidence: 1.0,
        requires_confirmation: false,
      },
      next_observation: false,
      explanation: 'No elements match the task goal. Try a different goal.',
      server_metrics: {
        queue_ms: 0,
        inference_ms: 12,
        total_server_ms: 12,
        model: 'mock-keyword-v1',
      },
    };
  }

  const best = scored[0];
  const confidence = Math.min(0.99, 0.5 + best.score * 0.03);

  // Determine action type based on element and goal
  let actionType: ActionCommand['type'] = 'click';
  if (best.el.role === 'textbox' || best.el.tag === 'textarea' || best.el.input_type === 'text') {
    actionType = 'type';
  }
  if (goalLower.includes('scroll')) {
    actionType = 'scroll';
  }
  if (goalLower.includes('submit') || goalLower.includes('send')) {
    actionType = 'submit';
  }

  const args: Record<string, unknown> = {};
  if (actionType === 'type') {
    args.text = 'example text'; // Mock text
  }
  if (actionType === 'scroll') {
    args.delta_x = 0;
    args.delta_y = 0.5;
  }

  return {
    protocol_version: PROTOCOL_VERSION,
    request_id: request.request_id,
    status: 'ok',
    action: {
      type: actionType,
      target: {
        element_id: best.el.id,
        bbox: best.el.bbox,
        selector_hint: `[data-agent-id='${best.el.id}']`,
        text_hint: best.el.text.slice(0, 50),
      },
      arguments: args,
      confidence,
      requires_confirmation: actionType === 'submit',
    },
    next_observation: false,
    explanation: `Mock: ${actionType} on "${best.el.text.slice(0, 30)}" (score: ${best.score})`,
    server_metrics: {
      queue_ms: 2,
      inference_ms: 15,
      total_server_ms: 17,
      model: 'mock-keyword-v1',
    },
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/agent') {
    try {
      const body = await readBody(req);
      const request: AgentRequest = JSON.parse(body);

      console.log(`[Mock Server] Request ${request.request_id}`);
      console.log(`  Task: "${request.task.goal}"`);
      console.log(`  Elements: ${request.dom_context.elements.length}`);
      console.log(`  Redactions: ${request.redaction_manifest.length}`);
      console.log(`  Privacy passed: ${request.privacy.verification.passed}`);
      console.log(`  Capture: ${request.client_metrics.capture_ms.toFixed(1)}ms`);
      console.log(`  Detection: ${request.client_metrics.detection_ms.toFixed(1)}ms`);
      console.log(`  Redaction: ${request.client_metrics.redaction_ms.toFixed(1)}ms`);

      // Simulate some inference time
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = generateResponse(request);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (err) {
      console.error('[Mock Server] Error:', err);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request' }));
    }
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: PROTOCOL_VERSION }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`🚀 SIH26171 Mock Server running on http://localhost:${PORT}`);
  console.log(`   POST /api/agent — Agent endpoint`);
  console.log(`   GET  /health    — Health check`);
});
