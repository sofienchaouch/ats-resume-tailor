# CLAUDE.md — ATS Resume Tailor

Auto-loaded by Claude Code for this project. Overrides the generic Downloads-level CLAUDE.md when working here.

## What this is

AI resume/cover-letter tailoring tool. User pastes job description + master resume, app tailors resume/cover letter for ATS, tracks applications, preps interviews.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 6 + TailwindCSS 4 |
| Backend | Express (server.ts), tsx dev runner |
| AI | @google/genai (Gemini) |
| Auth/DB | Firebase (Auth + Firestore), firebase-admin server-side |
| PDF/DOCX export | jspdf, pdf-lib, docx, html2canvas, puppeteer-core + @sparticuz/chromium |
| Local persistence | src/utils/localDb.ts (IndexedDB/localStorage fallback) |
| Charts | recharts |
| Animation | motion |

## Structure

```
src/
  App.tsx               # root shell, routing between views
  AuthContext.tsx        # firebase auth context
  components/            # feature views (Dashboard, ResumeWizard, CoverLetter, InterviewPrep, JobsDeepSearch, ApplicationTracker, IntegrationsHub...)
  firebase.ts            # canonical firebase init; src/lib/firebase.ts re-exports it
  utils/localDb.ts       # offline/local data fallback
  utils/spellcheck.ts    # spellcheck field logic
  utils/obsidianSync.ts  # ORPHANED — formatters written, no importer, no /api/obsidian/sync route
  types.ts               # ResumeData, CoverLetterData, etc.
  data/samples.ts
server.ts                 # Express API (Gemini calls, PDF generation, auth-gated routes)
generate-pdf.ts           # standalone PDF generation script
```

## Known gaps / things to verify before touching

- `src/utils/obsidianSync.ts` now provides Markdown formatters + `downloadMarkdown()` (client-side blob download). Wired into ResumePreview and CoverLetterPreview "Markdown (.md)" buttons. No server route / vault path — user drops the file into their own vault. `interviewPrepToMarkdown` is exported but not yet surfaced in the UI.
- `src/firebase.ts` is the canonical init; `src/lib/firebase.ts` just re-exports it. Edit `src/firebase.ts`.
- Test suite is vitest, pure-logic only (`server/*.test.ts`, `src/**/*.test.ts` — 12 files). No component/UI tests (no jsdom). No `server.ts` request-level tests.
- ~47 pre-existing eslint errors; `npm run lint` exits non-zero. A `config-protection` hook blocks editing `eslint.config.js` — fix lint issues in source.
- `claude-cli` provider (`callClaudeCli` in `server.ts`, gated by `ENABLE_CLAUDE_CLI_PROVIDER`): always spawn `claude` via `claudeCliEnv()`, which strips inherited `CLAUDE_*` / `ANTHROPIC_BASE_URL` vars. Without it a server started from inside a Claude Code session produces exit `3221225794` on Windows with empty stderr. Account UI lives in `src/components/ClaudeCliAuthPanel.tsx`, backed by `GET /api/claude-cli/status` and `POST /api/claude-cli/login` (both localhost-only + env-gated). `claude auth status` alone is not a health check — it reports `loggedIn:true` for expired sessions, so the status route also runs a live probe.

## Job search (multi-source pipeline)

`/api/jobs-deep-search` fans out across source adapters (`server/jobSources.ts`), then dedupes + fit-ranks + URL-verifies (`server/jobRank.ts`). **Hard rule: adapters return only what a real API gave back — AI may rewrite the query, never invent a result.** Sources: Arbeitnow (keyless), Adzuna / Jooble (free keys, optional), a company watchlist hitting public Greenhouse/Lever/Ashby board APIs (`watchlist: ["greenhouse:adyen", ...]`), and the existing AI web-search as one source among many (kept only when the provider has `webGrounding`). `deepMode` adds ~4 AI-generated query variants. `fitScore` blends resume-keyword coverage + skill/title overlap (`rankJobs`, reuses `server/scoring.ts`). `GET /api/job-sources` reports which adapters are configured. The route now 400s only when NO source at all is available.

## Provider capabilities

`server/capabilities.ts` is the single source of truth for what each AI provider can do (`webGrounding`, `multimodal`, `structuredOutput`). Gate on it — never on `provider === 'gemini'` string compares.

Only Gemini has `webGrounding`: the other adapters ignore `config.tools` entirely, so a `googleSearch` tool passed to them is dropped **silently**. `/api/jobs-deep-search` used to do exactly that and returned invented job listings with invented URLs; it now returns `PROVIDER_CANNOT_SEARCH_WEB` (400). Any new route that passes `tools` must gate on `webGrounding` first.

`ENABLE_CLAUDE_CLI_WEB_SEARCH=true` (local, needs `ENABLE_CLAUDE_CLI_PROVIDER` too) turns on `webGrounding` for `claude-cli`: `providerCapabilities()` flips the flag, and `runProvider` routes any call carrying a `googleSearch` tool to `callClaudeCli({webSearch:true})`, which spawns `claude -p --tools WebSearch --permission-mode bypassPermissions`. Only the phase-1 search call gets tools; the phase-2 structuring call stays tool-free. ~60s and ~$0.30 subscription usage per search — a Gemini key is faster/cheaper and also does multimodal PDF.

`generateContentWithRetry` (server.ts) is a thin wrapper over `runProvider`: `buildProviderChain` (server/capabilities.ts) returns an ordered `[selected, ...fallbacks]` list — Gemini and/or claude-cli, whichever is actually available and capability-compatible — and the wrapper advances to the next entry on any `isProviderLevelFailure` (bad key, quota, CLI auth). Grounding/multimodal calls drop incompatible providers from the chain rather than degrade.

Per-task provider pins: `AiConfig.taskOverrides` (`src/types.ts`) maps a coarse bucket → provider. A middleware in server.ts tags each AI request with its bucket from `req.path` (`PATH_TASK_BUCKET`); `buildProviderChain` makes the pinned provider the chain head when it's usable for that call. `server/auth.ts` `requireServerKey` also resolves the override so a task pinned to `claude-cli` isn't 401'd when the global provider needs a key.

## Architecture rules

- Never hardcode API keys — `.env` / `.env.example` already lists required vars (`GEMINI_API_KEY`, Firebase config).
- Server routes: validate input, keep Gemini calls server-side only (never expose `GEMINI_API_KEY` to the client bundle).
- PDF/DOCX generation is server-side (puppeteer-core + chromium) — keep heavy rendering out of the client bundle.
- PDF export inlines the app's OWN compiled CSS (`collectDocumentCss()` in `ResumePreview.tsx`) — never re-add the Tailwind Play CDN: it serves v3 while this app is v4, so utilities silently resolved to nothing. `page.pdf()` must pass an explicit `margin` (puppeteer defaults to 0, which clipped every line), and the export must reset `#printable-resume-canvas` to `position: static` because `index.css`'s `@media print` block pins it `absolute; left: 0`.
- Firestore access should go through `src/db.ts` — no ad-hoc Firestore calls scattered in components.

## Commands

```bash
npm run dev        # tsx server.ts (dev server, :3000)
npm run build      # vite build + esbuild bundle server to dist/server.cjs
npm run start      # node dist/server.cjs
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm test           # vitest run
```

## Knowledge graph

Project has a graphify-generated knowledge graph + Obsidian vault under `graphify-out/`. Re-run `/graphify . --obsidian` after major structural changes to keep it current. See `graphify-out/GRAPH_REPORT.md` for god nodes, communities, and suggested questions; `graphify-out/obsidian/` is the vault.
