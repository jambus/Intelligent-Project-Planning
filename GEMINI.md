# GEMINI.md - Intelligent Resource Planner (AI-Powered)

## Project Overview
**Kill-Project-Planning** has evolved into the **Intelligent Resource Planner (IRP)**, a Local-first Chrome Extension designed to streamline R&D resource scheduling. It uses AI (OpenAI) to automatically assign R&D resources (Frontend, Backend, Test, etc.) to projects based on priority, skills, and man-day (MD) estimates imported from CSV/XLSX files. It also provides real-time workload alerts directly on the Jira UI.

## Architecture
- **Environment**: Chrome Extension (Manifest V3).
- **Frontend**: React 19 + TypeScript + Tailwind CSS.
- **Storage**: Local-first via IndexedDB (Dexie.js) and `chrome.storage.local`.
- **Integrations**: 
  - **Data Source**: Manual CSV/XLSX file import for project lists.
  - **AI Engine**: OpenAI API for intelligent scheduling.
  - **Overlay**: Content Script injection on Jira issue pages for resource load warnings.

## Key Files & Directories
- `extension/src/`: Core source code (Background, Content Scripts, Options Page, Popup).
- `extension/src/db/`: Database schema and Dexie services.
- `extension/src/services/`: AI scheduling, file import, and Jira API utilities.
- `docs/DEVELOPMENT.md`: **Crucial** - Detailed local setup and build instructions.
- `docs/intelligent-resource-planner.md`: Full PRD, system architecture diagrams, and design specs.
- `docs/TASKS.md`: Project roadmap and current task status.

## Usage for AI Agents
1.  **Context First**: Always refer to `docs/intelligent-resource-planner.md` for functional requirements and architectural decisions.
2.  **Maintenance**: 
    - Keep `docs/DEVELOPMENT.md` updated if build scripts or dependencies change.
    - Synchronize PRD docs in `docs/intelligent-resource-planner.md` with any functional or design changes.
3.  **Local-First Mandate**: This is a serverless, local-first application. Do NOT introduce external backend dependencies unless explicitly requested.

## Building and Running
Refer to [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) for environment setup and build commands.
- Dev: `npm run dev`
- Build: `npm run build`
