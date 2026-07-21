# AI Agent Instructions - Intelligent Resource Planner

This file is intentionally written as plain Markdown so it can be used by both Gemini-style agent files (`GEMINI.md`) and Codex agent files (`AGENTS.md`). If both files are maintained, keep their project rules synchronized.

## Project Context

The Intelligent Resource Planner (IRP) is a local-first Chrome Extension for R&D resource scheduling using AI.

- Single source of truth for product requirements and architecture: `docs/requirement.md`
- Local development, build, and packaging guide: `docs/DEVELOPMENT.md`
- Extension source root: `extension/`

## Core Mandates

1. **Build and packaging are required after code changes.** Every code modification must pass `npm run build` and the ZIP packaging step before the task is considered complete. Prefer the project script:
   ```bash
   cd extension
   npm run build
   npm run zip
   ```
   If `docs/DEVELOPMENT.md` defines a newer packaging process, follow that document.
2. **Keep requirements synchronized.** Any new functional requirement, feature addition, or design change must be reflected in `docs/requirement.md` before or during implementation.
3. **Use the PRD as the authority.** Always refer to `docs/requirement.md` for functional requirements and architectural decisions.
4. **Maintain development docs.** Update `docs/DEVELOPMENT.md` when build scripts, project structure, setup steps, packaging, or dependencies change.
5. **Preserve local-first architecture.** This is a serverless Chrome Extension. Do not introduce backend services, remote databases, or external runtime dependencies unless explicitly requested.
6. **Protect secrets.** API keys and credentials must be read from `chrome.storage.local` or approved local environment mechanisms. Never hardcode or log secrets.

## Build and Test

```bash
cd extension && npm install   # install dependencies
cd extension && npm run build # TypeScript check + Vite production build -> dist/
cd extension && npm run zip   # package dist/ into release ZIP
cd extension && npm run dev   # Vite HMR dev server
cd extension && npm run lint  # ESLint
```

No automated test framework currently exists. Validate manually by loading or reloading `extension/dist` in `chrome://extensions` when behavior changes.

## Architecture

Chrome Extension (Manifest V3). Data stays local by default.

- `chrome.storage.local`: API keys and user settings, accessed through `src/utils/storage.ts`
- IndexedDB (Dexie v2): business data such as projects, resources, allocations, worklogs, and skills

Key directories under `extension/src/`:

| Directory | Purpose |
| --- | --- |
| `db/` | Dexie schema and CRUD service layer |
| `services/` | AI scheduling, Jira API, file import, Google Sheets |
| `utils/` | Chrome storage wrapper, working-day calendar |
| `context/` | React Context for global scheduling state |
| `options/pages/` | Options SPA routes (HashRouter) |
| `popup/` | Browser action popup |
| `content/` | Jira page content script and load alerts |
| `background/` | Service worker |

## Conventions

- UI labels, role names, and code comments are in Chinese.
- Role names: 前端, 后端, APP, 全栈, 开发组长, 测试工程师, 测试组长.
- TypeScript runs in strict mode with `noUnusedLocals` and `noUnusedParameters`; unused imports or variables fail the build.
- Styling uses Tailwind CSS utility classes. Do not add separate CSS modules unless requested.
- Use `lucide-react` for icons.
- Keep changes minimal and directly tied to the task. Do not refactor unrelated code.

## Domain Rules and Pitfalls

- Dexie schema changes must increment the database version and redefine all tables in the new version block.
- Jira sync: `syncEpicLoggedHours()` in `services/jira.ts` must receive all epic keys in one batch call, not per project. The JQL must retain `project in (...)`, wildcard `*`, and `created >= -365d`.
- Project priority is insertion order, determined by auto-increment DB ID and CSV import order. Do not add manual sorting unless requested.
- Working-day and holiday logic must use `formatLocalDate(date)` from `utils/dateUtils.ts` for `YYYY-MM-DD` date keys. Do not use `toISOString().split('T')[0]` for scheduling, working-day, or holiday keys.
- Scheduling must `await loadHolidaysConfig()` before building the working-day set so user-defined holidays in `db.settings` are honored.
- AI scheduling runs per project sequentially. JavaScript enforces hard caps with `Math.min(aiSuggestion, projectGap, resourceIdle)`.
- One task per person per day: a person can only work on one operations or project task on a given day. Weekly schedule values are always integers; multiple projects may share a week on different days, but never a single day for the same person.
- Gap calculation is shared by `runAudit` and `runAuditForUI` through `computeProjectGaps` in `utils/audit.ts`. Keep MD accumulation at full float precision and round only at final write or display.
- CSV import normalizes fuzzy date strings such as `"Apr"`, `"Q3"`, and `"Jun (UAT...)"` to ISO dates via `normalizeDateField()` in `fileImport.ts`.
- Project and resource imports are destructive: they clear the relevant table and replace it with imported data. UI must confirm before import when existing data is present.
- `deleteResource` and `deleteProject` must also delete related `allocations` to avoid orphan schedule rows.
- `useLiveQuery()` triggers async re-renders after Dexie mutations; be careful with allocation and scheduling UI flows.
- Content script matches only `*://*.atlassian.net/browse/*`.
- The `@crxjs/vite-plugin` version is beta; check compatibility before upgrading Vite.
- Holidays are currently maintained in code for 2026 and require annual maintenance.
- `docs/requirement.md` is UTF-8 with very long lines. If an edit fails to match, verify the content directly from disk before retrying.

## Execution Style

1. Think before coding. State assumptions when they matter; ask when ambiguity would make the change risky.
2. Choose the simplest implementation that satisfies the request. Do not add speculative options, abstractions, or configurability.
3. Make surgical edits. Preserve existing style and do not clean up unrelated code.
4. Remove only unused imports, variables, or functions introduced by your own change.
5. Define success criteria for multi-step work and verify them.
6. For code changes, run `npm run build` and package the extension before reporting completion. Mention any validation that could not be performed.

