# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- `npm run dev` — Start Vite HMR dev server (from root or `extension/`)
- `npm run build` — TypeScript check + production build to `extension/dist/`
- `npm run zip` — Package `dist/` into `extension/release/irp-v1.0.0.zip`
- `npm run lint` — ESLint on the extension project
- `npm run crx` — Build + sign `.crx` file (requires `privatekey.pem`)
- `npm run publish` — Build + zip + upload to Chrome Web Store (requires `.env` credentials)

## Architecture

Chrome Extension (Manifest V3) — Local-first R&D resource scheduler with AI-powered scheduling. No backend server.

### Structure
- **`extension/src/options/`** — Options Page (SPA via `react-router-dom`, HashRouter): 4 routes
  - `Dashboard.tsx` — Main scheduling dashboard, audit tables, AI trigger
  - `Projects.tsx` — Project list + CSV/Excel file import
  - `Resources.tsx` — Team member CRUD with role/skill management
  - `Settings.tsx` — AI API config (OpenAI-compatible) + Jira credentials
- **`extension/src/popup/`** — Popup with quick stats and "open dashboard" link
- **`extension/src/content/`** — Jira page content script: watches assignee DOM, queries IndexedDB, shows load alert card (red/yellow/green)
- **`extension/src/background/`** — Service worker (minimal, no alarms currently)
- **`extension/src/db/`** — Dexie.js IndexedDB schema (`PlannerDatabase`) with tables: `resources`, `projects`, `allocations`, `jiraWorklogs`, `settings` + CRUD service layer
- **`extension/src/services/`** — AI scheduler (`ai.ts`), file import (`fileImport.ts`), Jira API client (`jira.ts`), Google Sheets (`googleSheets.ts`)
- **`extension/src/utils/`** — Chrome storage wrapper, date/working-day utilities

### Key Architecture Decisions
- **Step-by-Step Deduction Scheduling** (Phase 6): AI is called per-project (not global), and JS enforces hard caps via `Math.min(aiSuggestion, projectGap, resourceIdle)` — guarantees no overallocation
- **Priority = insertion order**: CSV import order determines project priority (auto-increment DB ID). No manual sort in UI.
- **5 standard roles**: 前端/后端/APP/全栈 → dev work only; 测试工程师 → test work only
- **Data stored in**: `chrome.storage.local` for config/API keys, IndexedDB (via Dexie) for business data
- **Holidays hardcoded** in `dateUtils.ts` for 2026 — will need maintenance for future years. Scheduling also loads user-defined holidays via `loadHolidaysConfig()` from `db.settings` before building the working-day set.
- **API keys never hardcoded** — read from `chrome.storage.local` via the storage utility
- **Local date keys**: use `formatLocalDate()` for all `YYYY-MM-DD` scheduling/working-day/holiday keys — never `toISOString().split('T')[0]` (UTC shift bug).
- **Shared gap calc**: `computeProjectGaps` in `utils/audit.ts` is the single source for both engine `runAudit` and Dashboard `runAuditForUI`; accumulate MD at full float precision, round only at final write/display.
- **Destructive imports + cascade deletes**: project/resource import REPLACES the whole table (confirm before importing when data exists); `deleteResource`/`deleteProject` cascade-delete related `allocations`.

### Validation Requirement
Every code modification MUST be followed by `npm run build` succeeding. The task is not complete until the build and packaging pass.

### Single Source of Truth
`docs/intelligent-resource-planner.md` contains the PRD and architecture. Update it when adding features or changing design.
