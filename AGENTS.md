# Project Guidelines

## Build and Test

```bash
cd extension && npm install   # install dependencies
cd extension && npm run build # TypeScript check + Vite production build → dist/
cd extension && npm run dev   # Vite HMR dev server
cd extension && npm run lint  # ESLint
```

**Every code change MUST pass `npm run build` before the task is considered complete.** The build runs `tsc -b` (strict mode) then Vite bundling.

No automated test framework exists — validation is manual via extension loading in Chrome.

## Architecture

Chrome Extension (Manifest V3). Local-first, no backend server. Data flows:

- **`chrome.storage.local`** → API keys, user settings (via `src/utils/storage.ts` wrapper)
- **IndexedDB (Dexie v2)** → business data: projects, resources, allocations, worklogs, skills

Key directories under `extension/src/`:

| Directory | Purpose |
|-----------|---------|
| `db/` | Dexie schema + CRUD service layer |
| `services/` | AI scheduling, Jira API, file import, Google Sheets |
| `utils/` | Chrome storage wrapper, working-day calendar |
| `context/` | React Context for global scheduling state |
| `options/pages/` | Options SPA routes (HashRouter) |
| `popup/` | Browser action popup |
| `content/` | Jira page content script (load alerts) |
| `background/` | Service worker (minimal) |

For full PRD and architecture: [docs/requirement.md](docs/requirement.md)  
For build/setup details: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

## Conventions

- **Language**: UI labels, role names, and comments are in Chinese. Roles: 前端/后端/APP/全栈/测试工程师
- **TypeScript strict mode**: `noUnusedLocals`, `noUnusedParameters` — unused imports/vars fail the build
- **Dexie schema changes**: Must increment version number AND redefine all tables in the new version block
- **API keys**: Never hardcoded — always via `chrome.storage.local`. Never log secrets.
- **Jira sync**: `syncEpicLoggedHours()` in `services/jira.ts` must receive ALL epic keys in one batch call (not per-project). The JQL uses `project in (...)`, wildcard `*`, and `created >= -365d` — do not remove any of these.
- **Priority = insertion order**: Project priority determined by auto-increment DB ID (CSV import order). No manual sort.
- **Working days**: Holidays hardcoded in `utils/dateUtils.ts` for 2026 — requires annual maintenance.
- **AI scheduling**: Called per-project sequentially. JS enforces hard caps via `Math.min(aiSuggestion, projectGap, resourceIdle)`.
- **Styling**: Tailwind CSS utility classes. No separate CSS modules.
- **Icons**: Lucide React (`lucide-react` package).

## Pitfalls

- After modifying code, always reload the extension in `chrome://extensions` to test changes
- `useLiveQuery()` (Dexie) triggers async re-renders on DB mutations — be careful with allocation logic
- Content script only matches `*://*.atlassian.net/browse/*`
- The `@crxjs/vite-plugin` is a beta (2.0.0-beta.33) — check compatibility when upgrading Vite
- **Calendar dates**: Use `formatLocalDate(date)` from `utils/dateUtils.ts` for any `YYYY-MM-DD` date key. Never use `toISOString().split('T')[0]` for scheduling/working-day/holiday logic — it shifts by a day in UTC+8.
- **Holiday config**: Scheduling must `await loadHolidaysConfig()` before building the working-day set, otherwise user-defined holidays in `db.settings` are ignored.
- **Gap calculation**: `runAudit` (engine) and `runAuditForUI` (Dashboard) share `computeProjectGaps` in `utils/audit.ts`. Keep MD accumulation at full float precision; round only at final write/display.
- **Imports are destructive**: project/resource file import does `db.<table>.clear()` then `bulkAdd` — it REPLACES the whole table. UI must confirm before import when data exists.
- **Cascade deletes**: `deleteResource`/`deleteProject` also delete related `allocations` to avoid orphan schedule rows. Preserve this when editing the service layer.
- **PRD doc is UTF-8 with very long lines**: the buffer-based edit tools may read a stale/empty view of `docs/requirement.md`. Verify against disk if an edit fails to match.


**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.