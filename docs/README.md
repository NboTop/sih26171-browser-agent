# SIH26171 — Privacy-Preserving Visual Browser Agent

## Overview

A Chrome and Firefox browser extension that acts as a privacy-preserving visual browser agent. The extension captures page context, extracts DOM metadata, runs a local privacy firewall to detect and redact PII, sends only sanitized context to a server, validates the server's action commands, and safely executes them.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  BROWSER (Extension)                                  │
│  ┌──────────────┐  ┌─────────────────────────────┐   │
│  │ Popup /      │  │  Background Service Worker   │   │
│  │ Side Panel   │──│  • Orchestration loop        │   │
│  │ (UI, Audit)  │  │  • Screenshot capture        │   │
│  └──────────────┘  │  • Privacy firewall          │   │
│                    │  • Server transport           │   │
│  ┌──────────────┐  │  • Response validation       │   │
│  │ Content      │──│  • Confidence gating         │   │
│  │ Script       │  │  • Confirmation policy       │   │
│  │ • DOM extract│  └──────────┬──────────────────┘   │
│  │ • Action exec│             │                       │
│  └──────────────┘             │ HTTPS (sanitized)     │
│                               │                       │
└───────────────────────────────┼───────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    Server / Mock      │
                    │  POST /api/agent      │
                    │  Returns ActionCommand│
                    └──────────────────────┘
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build packages and extensions in topological dependency order
npm run build

# 3. Run all unit and integration tests (113 passing tests)
npm test

# 4. Run evaluation benchmark harness (96.8% score + 10-run repeatability statistics)
npm run evaluate

# 5. Run static security audit (0 unsafe patterns in bundles)
node scripts/static-security-scan.cjs

# 6. Run live Chrome validation (drives installed chrome.exe via native CDP)
node scripts/validate-live-chrome.cjs
```

### Loading the Extension

**Chrome:**
1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `apps/extension/dist/chrome`

**Firefox:**
1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `apps/extension/dist/firefox/manifest.json`

## Repository Structure

```
sih26171-browser-agent/
├── apps/
│   ├── extension/            # Browser extension
│   │   ├── src/
│   │   │   ├── background/   # Service worker (orchestration)
│   │   │   ├── content/      # Content script (DOM extraction + execution)
│   │   │   ├── popup/        # Popup UI
│   │   │   ├── sidepanel/    # Side panel UI
│   │   │   ├── shared/       # Shared utilities
│   │   │   └── __tests__/    # Unit tests
│   │   ├── assets/           # Icons
│   │   └── scripts/          # Build scripts
│   └── server/               # Mock server
│       └── src/
├── packages/
│   ├── protocol/             # Canonical types + validation
│   │   └── src/
│   ├── privacy/              # PII detection + redaction
│   │   └── src/
│   ├── perception/           # DOM extraction + screenshot
│   │   └── src/
│   └── evaluation/           # Scoring harness
│       └── src/
├── docs/                     # Documentation
├── fixtures/                 # Test fixtures with seeded PII
└── scripts/                  # Build utilities
```

## Key Design Decisions

### Stable Element ID Strategy

Elements are assigned a `data-agent-id` attribute (e.g., `e_001`) using a monotonic counter per page lifecycle. On re-extraction, existing IDs are reused. This provides:
- **Stability**: same physical element → same ID across captures.
- **Resilience**: works even if the DOM structure changes around the element.
- **Selector fallback**: `[data-agent-id='e_001']` as CSS selector.
- **Counter reset**: on full page navigation (`beforeunload`).

### Privacy Contract

The extension **NEVER** sends:
- Raw input values, passwords, or hidden field values
- Cookies, authorization headers, or local storage
- Unsanitized page text
- Raw screenshots without privacy verification

The extension **ALWAYS**:
- Runs PII detection before constructing requests
- Runs privacy verification checks that gate outbound requests
- Builds a `redaction_manifest` documenting every redaction
- Sets `raw_pixels_sent: false` and `raw_dom_values_sent: false`

### Confirmation Policy

Actions require user confirmation when:
1. Action type is in `CONFIRMATION_REQUIRED_ACTIONS` (submit)
2. Server sets `requires_confirmation: true`
3. Target element text matches `CONFIRMATION_REQUIRED_PATTERNS`:
   - Payment: pay, purchase, transfer, send money, confirm order
   - Deletion: delete, remove
   - Account: sign out, log out, deactivate, cancel account
   - Navigation: navigate

### Command Validation

Every server response is validated:
1. **Structure**: JSON Schema-equivalent runtime validation
2. **Action type**: must be in `ALLOWED_ACTION_TYPES`
3. **Secret injection**: arguments checked for password/secret/token keys
4. **Confidence**: below `confidence_threshold` → reject
5. **Stale DOM**: element re-resolved against current DOM
6. **BBox drift**: significant shift → request new observation

## Chrome vs Firefox Compatibility

| Feature | Chrome | Firefox |
|---------|--------|---------|
| Manifest V3 | ✅ Native | ✅ Supported (109+) |
| Service worker | `service_worker` | `scripts` array |
| Side panel | `sidePanel` API | `sidebar_action` |
| Screenshot format | WebP native | PNG (no WebP captureVisibleTab) |
| `captureVisibleTab` | ✅ | ✅ |
| `chrome.storage.local` | ✅ | `browser.storage.local` |
| `createImageBitmap` in SW | ✅ | ✅ (limited) |
| `crypto.subtle` in SW | ✅ | ✅ |

### API Compatibility Notes

- **`chrome` vs `browser` namespace**: We use `(globalThis as any).chrome || (globalThis as any).browser` for cross-browser compatibility.
- **Service worker vs background scripts**: Chrome uses `service_worker` (single file), Firefox uses `scripts` array. The build script generates the correct manifest.
- **Screenshot format**: Chrome supports WebP via `captureVisibleTab({format:'webp'})`. Firefox only supports PNG. The code detects the browser and uses the appropriate format.
- **Side panel**: Chrome uses `chrome.sidePanel.open()`. Firefox uses `sidebar_action`. The manifest and code adapt accordingly.

## Scoring Criteria Mapping

| Criterion | Weight | Implementation | Measurement |
|-----------|--------|----------------|-------------|
| Visual-context accuracy | 25% | DOM extraction with bbox, roles, text | Element count, bbox validity, role coverage |
| PII detection recall/precision | 20% | Regex patterns + heuristics | F1 score against seeded fixtures |
| Redaction precision | 20% | Category-specific masking | Verified redaction in output |
| Client resource utilization | 20% | Timing at each stage | detection_ms + redaction_ms |
| End-to-end latency | 15% | Full pipeline timing | Total capture→response ms |

## Configuration

All settings are configurable via:
1. **Extension popup**: Settings section with save button
2. **`chrome.storage.local`**: Persisted across sessions
3. **Defaults** in `packages/protocol/src/types.ts`

| Setting | Default | Description |
|---------|---------|-------------|
| `server_endpoint` | `http://localhost:3001/api/agent` | Server URL |
| `mock_mode` | `true` | Use built-in mock responses |
| `confidence_threshold` | `0.5` | Minimum confidence to execute |
| `max_elements` | `200` | Max DOM elements per capture |
| `screenshot_quality` | `65` | WebP quality (0-100) |
| `request_timeout_ms` | `30000` | Server request timeout |
| `max_retries` | `2` | Retry count on failure |
| `max_text_length` | `120` | Max text per element |

## Known Limitations

1. **Screenshot pixel transmission omitted in MVP**: Because client-side pixel-level redaction (e.g. face blurring or bounding-box canvas masking) is deferred to P2, the P0 MVP strictly sets `image_base64: ""` and transmits only sanitized DOM context, accessibility metadata, and viewport geometry. Raw screenshot pixels are never sent over the wire, guaranteeing zero visual secret leakage and enforcing `privacy.raw_pixels_sent: false`.

2. **Firefox WebP**: Firefox's `captureVisibleTab` does not support WebP format. Screenshots are captured as PNG, which increases payload size (~2-3x). Consider server-side conversion or WASM-based WebP encoding.

3. **Service worker lifecycle**: MV3 service workers can be terminated after 5 minutes of inactivity. Long-running agent loops must handle wake-up. The current implementation completes within the timeout for typical use.

4. **Content script isolation**: Content scripts run in an isolated world but share the DOM. Injected `data-agent-id` attributes are visible to page scripts. This is acceptable for the use case but could be obfuscated if needed.

5. **Cross-origin iframes**: Elements inside cross-origin iframes are not extracted. This is a browser security constraint with no workaround in MV3.

6. **Dynamic content**: Elements added after extraction are not captured until the next observation cycle. SPAs with frequent DOM mutations may need more frequent re-extraction.
