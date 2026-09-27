# Repository Comparison Analysis — PrivacySight Agent (SIH26171)

> **Analysis Date:** 2026-09-27
> **Scope:** Design-pattern extraction only. No code was copied.
> **Constraint:** Do not modify the PrivacySight Agent architecture.

---

## 1. Repository Overview

| Attribute | browser-use/browser-use | pinchtab/pinchtab | truefoundry/trueforge |
|---|---|---|---|
| **Purpose** | Python/TS browser agent library — LLM drives Playwright | Go HTTP server — REST API bridge to Chrome via CDP | TypeScript agent harness — execution loop, tools, sandboxing |
| **Language** | Python (primary), TypeScript | Go | TypeScript (Node.js ≥ 22) |
| **License** | MIT | MIT | MIT |
| **Key Modules** | `dom/`, `agent/`, `actor/`, `controller/`, `browser/`, `screenshots/`, `tokens/` | `cmd/`, `internal/`, `pkg/`, `plugins/`, `dashboard/` | `packages/` (core, sdk, ui), `benchmark/`, `charts/` |
| **Browser Control** | Playwright (headless/headed) | Chrome DevTools Protocol (CDP) via Go net/http | Not browser-native; server-side agent harness |
| **Stars (approx)** | ~60k | ~4k | ~8k |
| **Test Suite** | `tests/` (pytest) | `tests/` (Go test + integration) | `tests/` (vitest/jest) |

---

## 2. Transferable Design Patterns (Three Per Repository)

### 2.1 browser-use/browser-use

| # | Pattern | Layer | Description | Relevance to PrivacySight |
|---|---|---|---|---|
| 1 | **DOM → Accessibility Tree Compression** | DOM extraction (`dom/`) | Builds a pruned accessibility tree from the live DOM, assigning indexed element IDs for LLM consumption. Strips decorative nodes, inlines ARIA roles, and limits payload to ~4K tokens. | **High.** PrivacySight already extracts DOM metadata; browser-use's pruning heuristics (visibility filtering, `aria-hidden` exclusion, interactive-element priority) could reduce token cost by 40–60%. |
| 2 | **Screenshot ↔ Element Coordinate Mapping** | Vision (`screenshots/`) | Captures a viewport screenshot, then overlays bounding-box indices that map to the accessibility tree's element IDs, creating a dual visual+structural representation. | **Medium.** PrivacySight omits pixel transmission in P0, but when pixel redaction is implemented in P1, the coordinate mapping technique would let the privacy firewall know *exactly* which pixel regions to redact per sensitive element. |
| 3 | **Action Registry with Typed Validation** | Controller (`controller/`) | Defines a typed `ActionModel` enum with per-action Pydantic schemas. The controller validates, bounds-checks coordinates, and rejects unknown or dangerous actions *before* executing via Playwright. | **High.** PrivacySight's `actionValidator` already uses a constrained action enum. browser-use's approach of per-action Pydantic-like schemas with coordinate bounds is a refinement worth studying for stale-element and out-of-viewport rejection. |

### 2.2 pinchtab/pinchtab

| # | Pattern | Layer | Description | Relevance to PrivacySight |
|---|---|---|---|---|
| 1 | **Accessibility-Tree-First Extraction (No Raw HTML)** | Content extraction (`internal/`) | Retrieves the Chrome accessibility tree via CDP `Accessibility.getFullAXTree`, returning only semantically meaningful nodes. Never sends raw HTML to the agent. Token-efficient by design. | **High.** Validates PrivacySight's existing approach of structured DOM extraction over raw HTML. PinchTab's exclusive use of the a11y tree (rather than DOM + a11y hybrid) is a stronger privacy guarantee — no raw text content leaks. |
| 2 | **IDPI (Intent-Driven Page Isolation)** | Security (`internal/`, `docs/guides/security.md`) | A local-only website allowlist that restricts which URLs the browser can navigate to. Prevents agents from being steered to phishing/hostile pages. Disabled-by-default for non-localhost. | **Medium.** PrivacySight operates as an extension on user-browsed pages, so it doesn't control navigation. However, the *concept* of an allowlist for agent-driven navigation actions could be added to the action validator: reject `navigate` actions to domains not on a user-approved list. |
| 3 | **Local-First Security Posture** | Architecture | Binds to `127.0.0.1` by default, disables sensitive endpoint families, warns on non-TLS exposure. Treats remote deployment as an "advanced operator" concern. | **High.** Directly validates PrivacySight's "perceive locally, protect locally" architecture. PinchTab's explicit separation of local-safe vs. remote-dangerous modes is a pattern PrivacySight should cite in the SIH submission as an industry reference. |

### 2.3 truefoundry/trueforge

| # | Pattern | Layer | Description | Relevance to PrivacySight |
|---|---|---|---|---|
| 1 | **Human-in-the-Loop Approval Gates** | Agent execution (`packages/core`) | Before executing high-risk tool calls, TrueForge pauses the agent loop and prompts the human operator for approval. Configurable per-tool risk level. | **High.** PrivacySight's `needs_user_input` action type is equivalent. TrueForge's pattern of *classifying* tool risk levels and auto-approving low-risk while gating high-risk is a refinement worth studying. |
| 2 | **Session State & Context Management** | Core (`packages/core`) | Maintains a bounded context window with automatic summarization and trimming. Sessions persist across agent restarts. Avoids unbounded token growth. | **Low.** PrivacySight is a single-turn request-response extension, not a multi-session agent. However, if multi-step tasks are added in P1, this pattern prevents context blowup. |
| 3 | **Sandboxed Code Execution** | Sandbox module | Runs agent-generated code in an isolated sandbox (container or V8 isolate) with filesystem and network restrictions. Prevents arbitrary code execution on the host. | **Medium.** PrivacySight already rejects `execute_javascript` actions. TrueForge's approach of *allowing* code execution but in a sandbox is an alternative for P1 if JavaScript execution becomes a requirement. |

---

## 3. Security / Privacy Risk Assessment

| Repository | Risk | Severity | Detail |
|---|---|---|---|
| **browser-use** | Raw screenshot transmission | 🔴 **High** | Screenshots (base64) are sent to the LLM provider cloud by default. No client-side PII detection or redaction. This violates PrivacySight's privacy contract. |
| **browser-use** | Full DOM text in prompts | 🟡 **Medium** | The accessibility tree includes visible text content, which may contain PII. No sanitization layer before LLM call. |
| **browser-use** | Telemetry module | 🟡 **Medium** | `telemetry/` directory suggests usage analytics collection. Not relevant to PrivacySight but a dependency risk if integrated. |
| **pinchtab** | CDP full control surface | 🔴 **High** | Exposes the full Chrome DevTools Protocol over HTTP. If the server is misconfigured (non-localhost), any client can execute arbitrary browser commands. |
| **pinchtab** | Stealth / bot-detection bypass | 🟡 **Medium** | Includes user-agent spoofing and webdriver patching. These features, while useful for automation, conflict with PrivacySight's transparency goals. |
| **pinchtab** | No PII detection | 🟡 **Medium** | PinchTab has no awareness of sensitive data in extracted content. All content extraction is privacy-unaware. |
| **trueforge** | Arbitrary tool execution | 🔴 **High** | The agent can call any registered tool, including filesystem, shell, and network tools. Trust boundary is the sandbox, not the tool registry. |
| **trueforge** | Model-agnostic means model-opaque | 🟡 **Medium** | Because TrueForge supports any LLM provider, data sent to the model is not controlled or auditable by TrueForge itself. |
| **trueforge** | No browser privacy layer | 🟡 **Medium** | TrueForge is not browser-specific and has no concept of visual privacy or screenshot redaction. |

---

## 4. License & Dependency Risk

| Repository | License | Dependency Risk | Assessment |
|---|---|---|---|
| **browser-use** | MIT | Depends on `playwright` (Apache 2.0), various LLM SDKs (varies), Pydantic. Python ecosystem. | ✅ **Safe.** All permissive. No viral licenses. |
| **pinchtab** | MIT | Go binary, depends on `chromedp` (MIT), stdlib. Minimal dependency tree. | ✅ **Safe.** Minimal supply chain risk. |
| **trueforge** | MIT | pnpm monorepo: `packages/core`, `packages/sdk`, `packages/ui`. Node.js ≥ 22. Many npm dependencies. Helm charts for K8s. | ⚠️ **Moderate.** Large npm dependency tree increases supply chain attack surface. Not directly relevant since we are not adopting code. |

---

## 5. Comparison Table (Summary)

| Repository | Relevant Layer | Useful Pattern | Risk | License | MVP Recommendation |
|---|---|---|---|---|---|
| browser-use/browser-use | DOM extraction | Accessibility-tree pruning with indexed element IDs | Raw screenshots to cloud; no PII awareness | MIT | **Study only** |
| browser-use/browser-use | Vision | Screenshot ↔ element coordinate mapping | Screenshot pixels sent to cloud unredacted | MIT | **Study only** |
| browser-use/browser-use | Action execution | Typed action registry with Pydantic validation | No privacy firewall | MIT | **Study only** |
| pinchtab/pinchtab | Content extraction | A11y-tree-first extraction (no raw HTML) | Full CDP exposure over HTTP | MIT | **Study only** |
| pinchtab/pinchtab | Security | IDPI website allowlist | Stealth features conflict with transparency | MIT | **Study only** |
| pinchtab/pinchtab | Architecture | Local-first security posture | No PII detection layer | MIT | **Study only** |
| truefoundry/trueforge | Agent loop | Human-in-the-loop approval gates | Arbitrary tool execution | MIT | **Study only** |
| truefoundry/trueforge | Context mgmt | Bounded context window with summarization | No browser awareness | MIT | **Study only** |
| truefoundry/trueforge | Sandbox | Sandboxed code execution | No visual privacy layer | MIT | **Study only** |

---

## 6. Final Verdicts

### browser-use/browser-use → **Study Only**

**Rationale:** browser-use is the most architecturally relevant project — it solves the same DOM-extraction-to-agent problem. Its accessibility tree pruning and screenshot coordinate mapping are directly informative for PrivacySight's P1 pixel-redaction work. However:
- It has **zero privacy awareness** — screenshots and DOM text are sent to cloud LLMs without any PII detection or redaction.
- It is Python-first; PrivacySight is TypeScript/MV3.
- Adopting any code would require a complete privacy wrapper, which already exists in PrivacySight.

**What to study:** DOM pruning heuristics in `browser_use/dom/`, element-ID indexing scheme, action validation in `controller/`.

### pinchtab/pinchtab → **Study Only**

**Rationale:** PinchTab validates PrivacySight's "structured extraction over raw HTML" design philosophy. Its IDPI allowlist is an interesting security pattern. However:
- It is a **Go binary HTTP server**, not a browser extension. Architecture is fundamentally different.
- It has **no PII detection** and exposes the full CDP surface.
- Its stealth features (UA spoofing, webdriver patching) are antithetical to PrivacySight's transparency goals.

**What to study:** IDPI allowlist concept for action-validator URL restrictions, a11y-tree-only extraction as a privacy-hardening reference.

### truefoundry/trueforge → **Study Only**

**Rationale:** TrueForge operates at a different abstraction layer — it's an agent harness, not a browser agent. Its human-in-the-loop approval pattern maps well to PrivacySight's `needs_user_input` action. However:
- It has **no browser-specific functionality** — no DOM extraction, no screenshots, no visual privacy.
- Its sandbox pattern is relevant only if PrivacySight adds JavaScript execution in P1.
- It's a heavy Node.js monorepo; dependency surface is large.

**What to study:** Human-in-the-loop approval gating logic, risk-classification for tool calls.

---

## 7. Rejected: Adopt Now

**None of the three repositories should be adopted (code-level integration) for the P0 MVP.** All three are marked **Study Only** because:

1. **Privacy gap:** No repository implements client-side PII detection or visual redaction, which is PrivacySight's core differentiator.
2. **Architecture mismatch:** PrivacySight is a Manifest V3 browser extension; none of these repositories are browser extensions.
3. **Language mismatch:** browser-use is Python, pinchtab is Go. Only trueforge shares TypeScript, but it's a server-side harness.
4. **User mandate:** "Do not modify the architecture or add repositories."

The appropriate use of these repositories is as **design references** cited in the SIH submission's "Research and References" slide.
