# SIH26171 Browser Extension — Integration Note for Neel

## What's Ready

The complete extension codebase is at:
```
C:\Users\Dell\.gemini\antigravity-ide\scratch\sih26171-browser-agent\
```

### Files to Copy into the Repository

Copy the entire directory structure as-is. All files are implementation-ready:

```
/apps/extension/          → Complete extension (MV3, TS, Chrome+Firefox)
/apps/server/             → Mock server (Node.js HTTP, no deps)
/packages/protocol/       → Canonical types + runtime validation
/packages/privacy/        → PII detection (regex) + redaction engine
/packages/perception/     → DOM extraction + screenshot capture
/packages/evaluation/     → Scoring harness (all 5 criteria)
/docs/                    → Architecture docs + README
/fixtures/                → PII-seeded test fixtures (14 elements, 12 PII)
/scripts/                 → Icon generation, build utilities
```

### What Requires Real-Device Testing

1. **Chrome `captureVisibleTab`** — works only in actual Chrome with `activeTab` permission granted. Cannot be tested in Node/Vitest. Requires loading the extension in Chrome and clicking the popup.

2. **Firefox MV3 background scripts** — Firefox uses `scripts` array instead of `service_worker`. The build script generates the correct manifest, but needs testing in Firefox Nightly or Developer Edition (109+).

3. **Side panel / sidebar_action** — Chrome's `sidePanel` API and Firefox's `sidebar_action` behave differently. UI renders the same HTML but the API to open them differs. Test on both browsers.

4. **Content script DOM extraction** — The extraction logic is unit-tested with mock elements, but real-page extraction (querySelector on live DOM, getBoundingClientRect, computed styles) needs manual testing on a variety of pages.

5. **Action execution** — click, type, scroll, keypress, submit all use real DOM APIs. The `type` action uses `nativeInputValueSetter` for React compatibility, which should be tested on React/Vue forms.

6. **WebP vs PNG** — Chrome captures WebP, Firefox captures PNG. Verify the server can handle both media types.

7. **Service worker lifecycle** — MV3 service workers are terminated after ~5 minutes of inactivity. Test multi-step agent loops that may span several minutes.

### What You Can Test Without a Browser

- **All unit tests** (validation, PII detection, redaction) — run with `vitest`
- **Mock server** — run with `npm run dev:server`, hit with `curl`
- **Evaluation harness** — run against fixtures
- **Protocol type checking** — TypeScript compilation

### Setup Instructions

```bash
# 1. Install Node.js 20+ (required)
# Download from https://nodejs.org or use nvm/fnm

# 2. Install dependencies
cd sih26171-browser-agent
npm install

# 3. Generate icons (placeholder PNGs)
node scripts/generate-icons.mjs

# 4. Run tests
cd apps/extension
npm test

# 5. Build for Chrome
npm run build:chrome
# Output: apps/extension/dist/chrome/

# 6. Build for Firefox
npm run build:firefox
# Output: apps/extension/dist/firefox/

# 7. Start mock server (separate terminal)
cd apps/server
npm run dev
# Server at http://localhost:3001

# 8. Load in Chrome
# chrome://extensions → Developer mode → Load unpacked → dist/chrome/

# 9. Load in Firefox
# about:debugging → Load Temporary Add-on → dist/firefox/manifest.json
```

### Protocol Compliance

- **No protocol changes** were made. All types match the canonical spec exactly.
- **No privacy contract violations**: raw pixels sent = false, raw DOM values sent = false.
- In P0 MVP, the `image_base64` field is strictly set to `""` (empty string) to guarantee zero raw pixel leakage over the network. For future production (P2), integrate verifiable pixel-level redaction (canvas-based face blurring and bounding box overlays) before populating raw pixel buffers.

### Key Integration Points

| Component | File | Integration Need |
|-----------|------|------------------|
| Server endpoint | `background/index.ts` L12 | Update `DEFAULT_CONFIG.server_endpoint` |
| Privacy model | `privacy/pii-detector.ts` | Replace regex with ONNX NER model |
| Screenshot redaction | `perception/screenshot.ts` | Add pixel-level blur before base64 |
| Evaluation runner | `evaluation/src/index.ts` | Wire into CI pipeline |

### Performance Expectations

On a typical page with ~100 interactive elements:
- DOM extraction: **5-15ms**
- PII detection: **1-5ms**  
- Redaction: **0.5-2ms**
- Screenshot capture: **50-200ms** (browser API bottleneck)
- Total client-side: **60-220ms**
- Mock server round-trip: **50-100ms**
