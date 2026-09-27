# PrivacySight Agent (SIH26171)
## On-device Visual Perception for Lightweight Browser Agents

> **Tagline:** Perceive locally. Protect locally. Reason centrally.  
> **Problem Statement ID:** SIH26171 (Smart India Hackathon 2026)  
> **Core Differentiator:** A client-side privacy firewall that inspects, masks, and budgets DOM accessibility geometry before cloud reasoning, enforcing a non-bypassable local risk approval policy and zero screenshot-pixel transmission in the MVP.

---

## 1. Compliance & Measurement Invariants

To maintain strict scientific honesty and verifiable claims:
1. **“Live Chrome validation completed on the seeded synthetic fixture; this does not establish arbitrary-website support.”**
2. **“Zero screenshot-pixel transmission in the MVP.”**
3. **“Pixel-level screenshot redaction is planned, not implemented.”**
4. **“96.8% is a synthetic-fixture evaluation score.”**
5. **“External repositories were studied, not integrated.”**

---

## 2. Architecture & Data Flow

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  USER'S BROWSER RUNTIME (Local Trust Boundary)                                         │
│                                                                                        │
│  [ Web Page ]                                                                          │
│         │                                                                              │
│         ▼                                                                              │
│  [ Content Script ] ─── DOM traversal, normalized BBox [0,1], aria-hidden exclusion   │
│         │                                                                              │
│         ▼                                                                              │
│  [ Local Perception ] ─ packages/perception (context ranking, max 40 els, 32 KB limit) │
│         │                                                                              │
│         ▼                                                                              │
│  [ PII Firewall ] ───── packages/privacy (detects emails, phones, PAN, cards, secrets) │
│         │               substitutes category placeholders; verification gates send     │
│         ▼                                                                              │
│  [ Sanitized Outbound ] image_base64: "", raw_pixels_sent: false, zero raw secrets     │
└─────────┬──────────────────────────────────────────────────────────────────────────────┘
          │
          │ HTTPS (Sanitized Context Only)
          ▼
┌───────────────────────────────────┐
│  REASONING SERVER (Remote or Local)│
│  • Matches user goal to target    │
│  • Proposes candidate action      │
│  • Cannot override local policy   │
└─────────┬─────────────────────────┘
          │
          │ Action Proposal (e.g. click #download-report)
          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  POLICY & EXECUTION ENGINE (Local Governance Boundary)                                 │
│                                                                                        │
│  [ Policy Engine ] ──── packages/policy (RiskLevel: LOW | MEDIUM | HIGH | BLOCKED)     │
│         │               server responses CANNOT reduce risk or bypass confirmation     │
│         ▼                                                                              │
│  [ Side Panel HUD ] ─── Renders HIGH-risk approval card with bound session token       │
│         │               User gesture triggers NONE → PENDING → APPROVED transition     │
│         ▼                                                                              │
│  [ Target Revalidation] Re-reads live DOM; checks connectivity, visibility, mutation   │
│         │                                                                              │
│         ▼                                                                              │
│  [ Safe Action ] ────── Dispatches synthetic DOM event; updates sanitized audit log    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Quick Start (Fresh Clone)

### Prerequisites
- Node.js $\ge$ 20.x
- npm $\ge$ 10.x
- Google Chrome (optional, for live CDP validation)

### Build & Verification Commands
```bash
# 1. Install dependencies
npm install

# 2. Build packages and extension in topological dependency order
npm run build

# 3. Run all unit and integration test suites (113 passing tests)
npm test

# 4. Run evaluation benchmark harness (96.8% score + 10-run repeatability statistics)
npm run evaluate

# 5. Run static security audit (0 unsafe patterns in bundles)
node scripts/static-security-scan.cjs

# 6. Run live Chrome validation (drives installed chrome.exe via native CDP)
node scripts/validate-live-chrome.cjs
```

---

## 4. Repository Structure

```text
sih26171-browser-agent/
├── apps/
│   ├── extension/            # Manifest V3 browser extension (Variant B)
│   │   ├── src/
│   │   │   ├── background/   # Service worker orchestration & privacy gating
│   │   │   ├── content/      # DOM extraction, target revalidation, click synthesis
│   │   │   ├── sidepanel/    # Split-view Privacy HUD & Action Approval UI
│   │   │   └── popup/        # Quick controls & configuration
│   │   └── dist/             # Generated bundles (Chrome & Firefox)
│   └── server/               # Fastify mock reasoning server
├── packages/
│   ├── protocol/             # Pure types, schemas, and coordinate bounds validation
│   ├── privacy/              # PII detectors, string mask substitution, fail-closed sanitizer
│   ├── perception/           # DOM traversal, context ranking, payload budgeting (40 els / 32 KB)
│   ├── policy/               # RiskLevel rules, formal ApprovalState machine, fingerprinting
│   └── evaluation/           # Benchmark evaluation harness & 10-run repeatability statistics
├── fixtures/                 # Seeded test fixture with synthetic sensitive credentials
├── docs/                     # Full SIH submission documents, slide content, and evidence
│   ├── SIH-SIX-SLIDE-CONTENT.md
│   ├── PERMISSIONS-JUSTIFICATION.md
│   ├── CLAIMS-AUDIT.md
│   ├── RUBRIC-MAPPING.md
│   ├── ADAPTATION-VALIDATION.md
│   └── evidence/phase1/      # Live Chrome screenshots, console logs, sanitized payloads
└── scripts/                  # Static scan, live Chrome CDP validation, and fixture server
```

---

## 5. Empirical Verification Status

| Capability / Benchmark | Measured Value | Testing Tier | Status |
| :--- | :---: | :--- | :---: |
| **Workspace Compilation** | Exit 0 | Build (`npm run build`) | `[automated-tested]` |
| **Automated Tests Count** | **113 passed, 0 failed** | Vitest (`npm test`) | `[automated-tested]` |
| **Synthetic Fixture Benchmark** | **96.8% weighted score** | Harness (`npm run evaluate`) | `[synthetic-only]` |
| **Local Pipeline Latency (10 runs)** | $\mu = 0.37\text{ ms} \pm 0.38\text{ ms}$ | Harness (`npm run evaluate`) | `[synthetic-only]` |
| **Payload Budget Compliance** | **1.36 KB** (vs 32 KB limit) | Vitest payload budget suite | `[automated-tested]` |
| **Outbound Zero-Pixel Invariant** | `image_base64: ""` | Transport inspection test | `[automated-tested]` |
| **Real Task Transport Secrets** | 0 leaked credentials/canaries | Transport inspection test | `[automated-tested]` |
| **Static Security Scan** | **0 unsafe patterns** | Script (`static-security-scan.cjs`) | `[automated-tested]` |
| **Live Chrome GUI Execution** | **18/18 criteria verified** | CDP script (`validate-live-chrome.cjs`) | `[manually validated]` |

---

## 6. Honest Scope & Roadmap Accounting

- **Synthetic Benchmark Boundary:** The 96.8% score and 100% PII recall/precision are measured strictly on the deterministic seeded synthetic fixture (`fixtures/pii-seeded-page.ts`). They do not establish arbitrary internet webpage support.
- **Zero-Pixel MVP Boundary:** To eliminate visual data leakage risks, the MVP transmits zero screenshot pixels (`image_base64: ""` and `raw_pixels_sent: false`) and operates on structured semantic accessibility geometry.
- **Face / Visual Redaction Roadmap:** Canvas-based pixel blurring for face and avatar regions is staged for Phase 2/3 and is currently labeled as `[planned/not implemented]`.
- **Reasoning Model:** The included reasoner runs in local deterministic demo mode; cloud LLM/VLM connections are intentionally decoupled from the privacy firewall.
