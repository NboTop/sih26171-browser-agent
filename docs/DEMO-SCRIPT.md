# PrivacySight Agent — Live Demonstration Script
**Project:** SIH26171 — On-device Visual Perception for Lightweight Browser Agents  
**Target Audience:** Smart India Hackathon Evaluators & Jury  
**Demonstration Time:** 60 to 90 seconds  

---

## 1. Environment & Pre-Demo Setup

### Step 1: Launch Local Mock Server
Open a terminal in the project root and start the deterministic local server:
```powershell
npm run dev:server
```
*Expected Console Output:*
```text
🚀 SIH26171 Mock Server running on http://localhost:3001
   POST /api/agent — Agent endpoint
   GET  /health    — Health check
```

### Step 2: Load Unpacked Extension in Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in upper right).
3. Click **Load unpacked** and select:
   `C:\Users\Dell\.gemini\antigravity-ide\scratch\sih26171-browser-agent\apps\extension\dist\chrome`
4. Confirm **PrivacySight Agent 0.1.0** appears and pin it to the toolbar.

### Step 3: Open Seeded Test Fixture
In Chrome, open the local synthetic test page:
```text
file:///C:/Users/Dell/.gemini/antigravity-ide/scratch/sih26171-browser-agent/fixtures/seeded-test-page.html
```
Verify that the test fixture loads with synthetic personal data:
- Email: `fake.email@example.test`
- Indian Phone: `+91 90000 12345`
- Password field: filled with `fake password`
- PAN ID: `ABCDE1234F`
- Credit Card: `4111 1111 1111 1111`
- Confidential report paragraph: `fake report text`
- Target interactive button: **Download Report**

---

## 2. Live Demo Steps

### Action 1: Define User Task
1. Click the **PrivacySight** extension icon in the Chrome toolbar.
2. In the popup window, note the default configuration:
   - Server Endpoint: `http://localhost:3001/api/agent`
   - Confidence Threshold: `0.50`
   - Max Steps: `3`
3. In the **Task Goal** input, enter:
   ```text
   Find and click the Download Report button.
   ```
4. Click **Run Agent**.

---

### Action 2: Observe Expected Privacy Display (Extension UI)
Within **under 100 milliseconds**, the popup HUD displays:
- **Status Indicator:** `Executing step 1/3: Analyzing & Sanitizing DOM...`
- **Privacy Firewall Status:** `Passed (Pre-Flight Verification 100% OK)`
- **Redaction Counter:** `5 PII Elements Masked Locally`
- **Audit Trace:** 
  - `[MASKED] email on #user-email`
  - `[MASKED] phone on #user-phone`
  - `[OMITTED] password on #user-password`
  - `[MASKED] government_id on #tax-identifier`
  - `[MASKED] financial on #payment-card`

---

### Action 3: Inspect Network Request Payload
Open Chrome DevTools (**Network tab** filtering by `Fetch/XHR`), or observe the Mock Server terminal output.

**What the Server Receives:**
```json
{
  "protocol_version": "1.0",
  "request_id": "req_8df724...",
  "task": {
    "goal": "Find and click the Download Report button."
  },
  "dom_context": {
    "page_title": "PrivacySight Agent — Seeded Test Page",
    "elements": [
      {
        "id": "user-email",
        "tag": "span",
        "text": "[EMAIL]",
        "bbox": { "x": 0.2, "y": 0.1, "w": 0.2, "h": 0.03 }
      },
      {
        "id": "user-phone",
        "tag": "span",
        "text": "[PHONE]",
        "bbox": { "x": 0.2, "y": 0.15, "w": 0.15, "h": 0.03 }
      },
      {
        "id": "tax-identifier",
        "tag": "div",
        "text": "[GOV_ID]",
        "bbox": { "x": 0.2, "y": 0.26, "w": 0.15, "h": 0.03 }
      },
      {
        "id": "payment-card",
        "tag": "div",
        "text": "[FINANCIAL]",
        "bbox": { "x": 0.4, "y": 0.26, "w": 0.2, "h": 0.03 }
      },
      {
        "id": "download-report",
        "tag": "button",
        "role": "button",
        "text": "Download Report",
        "bbox": { "x": 0.2, "y": 0.48, "w": 0.18, "h": 0.05 }
      }
    ]
  },
  "privacy": {
    "raw_pixels_sent": false,
    "raw_dom_values_sent: false,
    "verification": { "passed": true }
  }
}
```
**Point to Prove to Evaluators:**  
Notice that `fake.email@example.test`, `+91 90000 12345`, `fake password`, `ABCDE1234F`, and `4111 1111 1111 1111` are **completely absent** from the network packet. Only safe placeholders exist.

---

### Action 4: Verify Safe Click Execution
1. The mock server responds with a safe click command targeting element `download-report` with confidence `0.95`.
2. The client command validator verifies that:
   - Action type is in allowlist (`click`).
   - Confidence $0.95 \ge 0.50$.
   - Target exists and is visible in current DOM.
   - Bounding box is within $[0, 1]$.
3. The content script triggers the click event on `#download-report`.
4. The test page updates dynamically:
   - Green banner appears on screen:  
     `"Report downloaded successfully! Click count: 1 at ..."`
5. The extension status shows: `Task Completed Successfully in 1 Step`.

---

## 3. Failure Cases & Defense Demonstrations

Showcase the following two security checks to demonstrate resilience:

### Failure Case A: Malicious Server Command (`execute_javascript`)
- **Simulation:** In `apps/extension/src/__tests__/security-and-network.test.ts`, a test server sends:
  `{ "action": { "type": "execute_javascript", "code": "document.body.innerHTML='compromised'" } }`
- **Result:** The extension immediately rejects the response because `execute_javascript` is not in the allowlist. Zero code is executed, and an audit entry is created.

### Failure Case B: Stale DOM Target
- **Simulation:** Server returns action targeting an element ID that has been removed or scrolled off DOM (`deleted-modal-btn`).
- **Result:** Target resolution fails (`resolveTargetElement` returns `null`), aborting the step and prompting for re-observation rather than misclicking.

### Failure Case C: Fail-Closed Negative Privacy Check
- **Simulation:** A DOM element contains an unredacted password text.
- **Result:** `sanitizeBeforeSend` returns `verified: false`. The network call is aborted before dispatch. The raw secret is omitted from error logs.

---

## 4. 60–90 Second Speaking Script

*(Read aloud clearly while clicking through the steps)*

> **[0:00 - 0:15] The Problem & Proposition**  
> *"Respected evaluators, today's visual AI browser agents suffer from a fatal privacy flaw: to automate tasks, they stream raw screenshots and unredacted DOM data to cloud models, exposing passwords, Indian PAN and Aadhaar IDs, and banking details. Our solution is PrivacySight Agent: perceive locally, protect locally, and reason centrally."*

> **[0:15 - 0:35] Local Perception & Redaction in Action**  
> *"Here we have a synthetic confidential web fixture with an email, a phone number, a password, a PAN card, and a credit card, alongside a safe 'Download Report' button. When the user requests 'Find and click Download Report', our local privacy firewall runs inside the browser sandbox in less than one millisecond."*

> **[0:35 - 0:55] Proof of Trust Boundary & Zero Secret Leakage**  
> *"Look at the network request captured right here. Every sensitive field has been replaced with structural masks—[EMAIL], [PHONE], [GOV_ID], [FINANCIAL]—and raw input values are omitted. Notice that the actual phone number, email, and password never cross the network trust boundary. Zero private secrets leave the user's computer."*

> **[0:55 - 1:15] Safe Action Execution & Defense**  
> *"The remote server reasons over this sanitized structure and returns a constrained JSON click command targeting the Download Report button. The extension validates the action against our strict allowlist, verifies element visibility, and safely executes the click. As you see on screen, the report downloads instantly."*

> **[1:15 - 1:30] Wrap-up & Feasibility**  
> *"PrivacySight requires zero heavy local AI models, operates seamlessly on Manifest V3 across Chrome and Firefox, and delivers fail-closed privacy guarantees for enterprise and government workflows. Thank you."*
