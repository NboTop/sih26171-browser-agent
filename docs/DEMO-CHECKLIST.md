# Live Chrome Demo Checklist & Acceptance Evidence

**Repository:** SIH26171 PrivacySight Agent  
**Date / Timestamp:** 2026-09-27T11:33:16+05:30  
**Browser Validated:** Google Chrome (x64 Windows)  
**Binary Path:** `C:\Program Files\Google\Chrome\Application\chrome.exe`  
**Extension Bundle:** `apps/extension/dist/chrome`  
**Seeded Fixture:** `http://127.0.0.1:8085/seeded-test-page.html` (`fixtures/seeded-test-page.html`)  
**Evidence Artifacts:** [`docs/evidence/phase1/`](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/)

---

## 1. 18-Point Acceptance Checklist

| # | Acceptance Criterion | Verification Method | Live Result | Evidence Artifact |
| :-: | :--- | :--- | :---: | :--- |
| **1** | Extension loads without manifest error | Loaded unpacked via `--load-extension` | ✅ PASS | Service worker registered (`chrome-extension://...`) |
| **2** | Seeded HTML page displays cleanly | Rendered in live Chrome window | ✅ PASS | [01-seeded-page.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/01-seeded-page.png) |
| **3** | Side panel opens | Rendered via sidepanel target | ✅ PASS | [02-privacy-hud.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/02-privacy-hud.png) |
| **4** | "Scan Active Page" clicked | Triggered `#sp-scan-btn` | ✅ PASS | Scanned in 0.42ms, DOM verified safe |
| **5** | HUD Firewall status displays `PASS` | Evaluated `#sp-firewall-status` | ✅ PASS | `PASS` badge (green pill) |
| **6** | Raw DOM values sent: `NO` | Evaluated `#sp-hud-raw-dom` | ✅ PASS | `NO` |
| **7** | Raw screenshot pixels sent: `NO` | Evaluated `#sp-hud-raw-pixels` | ✅ PASS | `NO` |
| **8** | Cookies / storage / passwords sent: `NO` | Evaluated `#sp-hud-secrets` | ✅ PASS | `NO` |
| **9** | Sensitive categories breakdown shown | Evaluated `#sp-sensitive-tags` | ✅ PASS | Email: 1, Phone: 1, Password: 1, Gov ID: 1, Financial: 1 |
| **10** | Retained / dropped element counts | Evaluated `#sp-retained-count`, `#sp-dropped-count` | ✅ PASS | Retained: 7, Dropped (Hidden): 1, Scanned: 8 |
| **11** | Local reasoner tag displayed | Evaluated `#sp-reasoner-mode` | ✅ PASS | "Local deterministic reasoner — demo mode" |
| **12** | Default task entered | Evaluated `#sp-task-goal` | ✅ PASS | `Click Download Report` |
| **13** | High-risk Approval Card appears | Evaluated `#sp-approval-section` | ✅ PASS | [03-approval-card.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/03-approval-card.png) |
| **14** | Download Report not clicked before approval | Queried live `window.clickCount` | ✅ PASS | `clickCount === 0` |
| **15** | Cancel tested and prevents execution | Clicked `#sp-cancel-btn` | ✅ PASS | Approval closed, `clickCount === 0`, rejected audit logged |
| **16** | "Approve and execute" clicked | Clicked `#sp-approve-btn` | ✅ PASS | Pre-execution DOM re-read & target validation passed |
| **17** | Download Report clicked; Success Banner displayed | Queried `#click-status`, `#click-status-text` | ✅ PASS | [04-success-state.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/04-success-state.png) |
| **18** | Zero secrets in audit log & console clean | Queried `#sp-audit-log`, console log scan | ✅ PASS | [sanitized-request.json](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/sanitized-request.json), [browser-console.log](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/browser-console.log) |

---

## 2. Captured Evidence Files

All files saved under `docs/evidence/phase1/`:
1. **[01-seeded-page.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/01-seeded-page.png)**: Full viewport render of the seeded test fixture showing synthetic data warning banner, profile card (Avatar, Email, Phone), confidential identifiers card (Password, PAN, Credit Card), and Download Report button.
2. **[02-privacy-hud.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/02-privacy-hud.png)**: Extension Side Panel showing Privacy Firewall `PASS`, zero-transmission indicators (`NO` across DOM values, screenshot pixels, cookies/storage), perception filtering counts (7 retained, 1 dropped), and local sensitive category counts.
3. **[03-approval-card.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/03-approval-card.png)**: High-Risk Action Approval card displaying Action: `click`, Target: `Download Report`, Risk: `HIGH`, Reason: `This action may create a file.`, with explicit `Approve and execute` and `Cancel` buttons.
4. **[04-success-state.png](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/04-success-state.png)**: Seeded test fixture after human approval and target revalidation showing the animated green success banner: *"Report downloaded successfully! Click count: 1 at ..."*.
5. **[browser-console.log](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/browser-console.log)**: Captured runtime log verifying zero uncaught exceptions, zero CSP violations, and clean DOM message exchange.
6. **[sanitized-request.json](file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/docs/evidence/phase1/sanitized-request.json)**: Audit record of verified zero-transmission guarantees and action approval flow.

---

## 3. Reproduction Command

To reproduce this validation sequence interactively:
```powershell
# 1. Start fixture server
node scripts/serve-fixtures.cjs

# 2. In a separate shell, execute automated live Chrome CDP runner
node scripts/validate-live-chrome.cjs
```
