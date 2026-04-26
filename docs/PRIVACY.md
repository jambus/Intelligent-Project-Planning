# Privacy Policy for Intelligent Resource Planner (IRP)

**Last Updated: April 26, 2026**

This Privacy Policy describes how the **Intelligent Resource Planner** ("the Extension", "we", "us", or "our") handles your data. We are committed to protecting your privacy and ensuring that your data remains under your control.

## 1. Data Collection and Storage (Local-First)
The Extension is designed with a **local-first** architecture.
*   **Local Storage**: All project data, resource details, and scheduling information are stored exclusively in your browser's local storage (IndexedDB via Dexie.js and `chrome.storage.local`).
*   **No Central Server**: We do not maintain any central servers. Your data is never uploaded to our infrastructure because it does not exist.

## 2. AI Integration (User-Triggered)
The Extension uses AI (e.g., OpenAI or compatible APIs) to perform intelligent scheduling.
*   **User Configuration**: You must provide your own API Key, which is stored locally on your device.
*   **Data Transmission**: Only when you click the "AI Scheduling" button, the necessary project and resource descriptions are sent to the API provider you have configured (e.g., OpenAI).
*   **Third-Party Policies**: Data sent to AI providers is subject to their respective privacy policies. We recommend reviewing the policy of your chosen provider.

## 3. Permissions Usage
The Extension requests specific permissions to function:
*   **`storage`**: To save your project lists, resources, and settings locally.
*   **`host_permissions` (Atlassian/Jira)**: To provide non-intrusive workload alerts directly on your Jira issue pages. No data from Jira is collected or transmitted to external servers by this extension.

## 4. No Tracking or Analytics
*   We do not use any tracking scripts, cookies, or analytics tools (such as Google Analytics).
*   We do not collect any information about your browsing habits or usage patterns.

## 5. Data Security
Since your data is stored locally, its security depends on the security of your device and browser. You can clear all data at any time by uninstalling the extension or clearing your browser's site data.

## 6. Contact
If you have any questions about this Privacy Policy, you can contact the project maintainer through the GitHub repository issue tracker.
