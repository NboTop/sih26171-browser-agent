# Reference Repository Adaptation & Validation Audit

**Project:** SIH26171 PrivacySight Agent  
**Date:** September 2026  
**Status:** Validated — Clean Room Native Implementation  

---

## 1. Compliance Statement

> **Invariant:** “External repositories were studied, not integrated.”  
> No source code, binary blobs, npm dependencies, or remote control bridges from external open-source repositories were copied or imported into PrivacySight Agent. All modules in `@sih26171/*` are clean-room, native TypeScript implementations designed specifically for on-device privacy preservation.

---

## 2. Reference Studies & Adapted Architectural Patterns

| Reference Repository | Explored Concept | Security/Privacy Risk in Original | PrivacySight Native Adaptation | Validation Status |
| :--- | :--- | :--- | :--- | :--- |
| **Browser Use** (`browsercode`) | Structured accessibility tree & DOM node indexing | Raw screenshots & complete unredacted DOM dumps sent to cloud LLMs | Native `@sih26171/perception` extracts interactive accessibility nodes, excludes hidden/aria-hidden nodes, strips passwords, and applies a strict 40-element / 32 KB budget with zero pixel transmission. | **Automated-Tested** (`payload-budget.test.ts`) |
| **PinchTab** (`pinchtab`) | Lightweight element coordinate resolution & click synthesis | Dependent on external Go/CDP server daemon; unredacted credentials | Native `@sih26171/extension/content` performs pre-execution target re-reading, element connectedness checks, visibility checks, and synthetic event dispatch within the standard Web API sandbox. | **Automated & Live Chrome Validated** (`phase1-vertical-slice.test.ts`) |
| **TrueForge** (`trueforge`) | Human-in-the-loop action approval & state machines | Server-orchestrated approval states can be bypassed or forged by malicious endpoints | Native `@sih26171/policy` provides a client-side formal state machine (`ApprovalState`) where high-risk actions (`HIGH`, `CRITICAL`) require explicit side-panel user confirmation bound to nonces, tab IDs, and target fingerprints. | **Automated-Tested** (`policy.test.ts`) |

---

## 3. Strict Verification & Invariant Proofs

1. **No External Code Bloat:**
   - Package dependency tree contains zero references to `browsercode`, `pinchtab`, `trueforge`, `playwright`, `puppeteer`, or cloud LLM SDKs.
   - All runtime extension dependencies are internal monorepo workspaces (`@sih26171/protocol`, `@sih26171/privacy`, `@sih26171/perception`, `@sih26171/policy`).
2. **Zero-Pixel MVP Boundary:**
   - In contrast to external agents that transmit 1080p canvas bitmaps, PrivacySight strictly enforces `image_base64: ""` and `raw_pixels_sent: false`.
3. **Fail-Closed Privacy Gating:**
   - If unredacted sensitive identifiers or passwords remain in page context, `sanitizeBeforeSend` returns `verified: false`, aborting transmission locally before network transit.
4. **Client-Side Action Governance:**
   - Unlike remote agent frameworks where the server commands execution directly, PrivacySight's policy engine runs inside the browser extension and rejects unconfirmed high-risk operations.
