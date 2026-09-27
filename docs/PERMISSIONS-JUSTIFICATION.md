# Manifest Permissions Justification & Minimization Audit

**Project:** SIH26171 PrivacySight Agent  
**Date:** September 2026  
**Manifest Specification:** Chrome Manifest V3 (Variant B Adopted)  
**Status:** Workstream 5 Complete — Minimized to Least Privilege Baseline  

---

## 1. Active Manifest Permissions Breakdown (Variant B)

Following Workstream 5 verification, the redundant `"scripting"` permission has been permanently removed from the source manifest. The generated Chrome bundle contains **0 references** to `chrome.scripting`.

| Permission | Category | Necessity & Architectural Justification |
| :--- | :--- | :--- |
| `sidePanel` | UI Window API | **Retained:** Required by Chrome MV3 to render the split-view Privacy Firewall HUD, high-risk approval card, and audit log side panel via `chrome.sidePanel`. |
| `storage` | Local Storage | **Retained:** Persists user settings (`mock_mode`, `confidence_threshold`, `request_timeout_ms`) on-device using `chrome.storage.local`. No cloud storage is accessed. |
| `activeTab` | Temporary Access | **Retained:** Principle of least privilege baseline. Grants temporary host access upon explicit user invocation. Automatically revoked upon navigation or tab closure. |
| `tabs` | Tab Resolution | **Retained:** Required by background service worker to resolve active tab IDs (`chrome.tabs.query({ active: true, currentWindow: true })`) when messages originate from the side panel window context. |
| ~~`scripting`~~ | Dynamic Injection | **REMOVED:** Content scripts are statically registered in `manifest.json` under `content_scripts`. Dynamic code injection (`chrome.scripting.executeScript`) is not used and was eliminated. |
| `host_permissions: ["<all_urls>"]` | Origin Scope | **Retained for Prototype:** Permitted origin scope to allow content script attachment and testing across arbitrary synthetic fixtures and local test servers. In production, host access must be narrowed to explicit enterprise domains or user-granted origins. |

---

## 2. Experimental Variant Verification Results

All three permission configurations were built and empirically tested in Google Chrome:

| Feature / Capability | Variant A (`activeTab` + `storage` + `sidePanel`) | Variant B *(Active)* (`activeTab` + `tabs` + `storage` + `sidePanel`) | Variant C *(Legacy Baseline)* (`activeTab` + `tabs` + `scripting` + `storage` + `sidePanel`) |
| :--- | :---: | :---: | :---: |
| **Extension Loads in Chrome** | ✅ YES | ✅ YES | ✅ YES |
| **Side Panel Opens** | ✅ YES | ✅ YES | ✅ YES |
| **Active Tab Query from Side Panel** | ❌ FAILS (sidepanel has own windowId) | ✅ PASS | ✅ PASS |
| **Page Scan via Content Script** | ❌ BLOCKED | ✅ PASS | ✅ PASS |
| **Zero-Transmission HUD Updates** | ❌ BLOCKED | ✅ PASS | ✅ PASS |
| **High-Risk Approval Flow** | ❌ BLOCKED | ✅ PASS | ✅ PASS |
| **Safe Click Execution on Target** | ❌ BLOCKED | ✅ PASS | ✅ PASS |
| **chrome.scripting Invocations** | 0 | 0 | 0 (Unused) |
| **Status in Repository** | Rejected (Broken) | **ADOPTED AS ACTIVE BASELINE** | Deprecated |

---

## 3. Platform Security Boundaries & Constraints

### A. Why `activeTab` Alone Is Insufficient
While `activeTab` is a best practice for minimal permissions, Chrome MV3 treats `activeTab` as temporary and invocation-dependent:
1. It is granted only after an explicit user gesture on the extension's browser action icon.
2. It is revoked immediately when the user navigates away or closes the tab.
3. In Manifest V3, content scripts declared statically in `manifest.json` require matching host permissions to bind to pages at `document_idle`.
4. When user input occurs inside a `sidePanel` document, the side panel window is the active focus; querying `chrome.tabs.query` from the background worker requires the `tabs` permission to resolve the web page tab.

### B. Why `<all_urls>` Remains for Prototype
- The prototype demonstrates cross-domain privacy protection on arbitrary local servers (`http://127.0.0.1:8085`) and seeded pages.
- Static content script registration requires match patterns (`content_scripts[0].matches: ["<all_urls>"]`).
- **Production Roadmap:** Production deployments should replace `<all_urls>` with an enterprise domain allowlist or use dynamic runtime host permission requests (`chrome.permissions.request`).

### C. Local File URL Access Policy (`file:///`)
Google Chrome platform security strictly forbids extensions from accessing `file:///` URLs by default:
- To test local HTML files directly from disk, users must manually toggle **“Allow access to file URLs”** in `chrome://extensions` -> Details.
- To eliminate this manual user requirement during automated and live evaluation passes, the project utilizes a lightweight local HTTP server (`scripts/serve-fixtures.cjs` on `http://127.0.0.1:8085`).
