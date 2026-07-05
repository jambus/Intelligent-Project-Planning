# GEMINI.md - Intelligent Resource Planner (AI-Powered)

## Project Context
The **Intelligent Resource Planner (IRP)** is a Local-first Chrome Extension for R&D resource scheduling using AI.
- **Primary Docs**: `docs/requirement.md` (PRD/Arch).` (PRD/Arch).
- **Setup/Build**: `docs/DEVELOPMENT.md`.

## Usage for AI Agents (Core Mandates)

1.  **Validation Requirement**: Every code modification **MUST** be followed by a successful build and packaging process. A task is not considered complete until `npm run build` and the ZIP packaging step (as defined in `docs/DEVELOPMENT.md`) succeed without errors.
2.  **Requirement Sync**: Any new functional requirements, feature additions, or design changes **MUST** be updated in `docs/requirement.md` before or during the implementation phase to ensure it remains the Single Source of Truth.
3.  **Single Source of Truth**: Always refer to `docs/requirement.md` for functional requirements and architectural decisions.
4.  **Documentation Maintenance**: Keep `docs/DEVELOPMENT.md` updated if build scripts, project structure, or dependencies change.
5.  **Local-First Mandate**: This is a serverless, local-first application. Do NOT introduce external backend dependencies unless explicitly requested.
6.  **Security**: Ensure API keys (OpenAI) are handled via `chrome.storage.local` and never hardcoded or logged.
