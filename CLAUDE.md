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
  lib/firebase.ts, firebase.ts  # firebase init (duplicate — check which is canonical before editing)
  utils/localDb.ts       # offline/local data fallback
  utils/spellcheck.ts    # spellcheck field logic
  utils/obsidianSync.ts  # formats resume/cover-letter/interview-prep as Markdown, POSTs to /api/obsidian/sync
  types.ts               # ResumeData, CoverLetterData, etc.
  data/samples.ts
server.ts                 # Express API (Gemini calls, PDF generation, auth-gated routes)
generate-pdf.ts           # standalone PDF generation script
```

## Known gaps / things to verify before touching

- `src/utils/obsidianSync.ts` calls `POST /api/obsidian/sync` — this route does **not** currently exist in `server.ts`. If asked to make Obsidian sync work, the server route must be added (write markdown file into a configured vault path).
- Two firebase init files exist (`src/firebase.ts` and `src/lib/firebase.ts`) — confirm which is actually imported before changing either.
- Root has stray `test*.cjs`/`test.js` files (test.cjs, test2.cjs...test18.cjs) — these look like scratch/debug scripts, not a real test suite. Don't treat them as coverage.

## Architecture rules

- Never hardcode API keys — `.env` / `.env.example` already lists required vars (`GEMINI_API_KEY`, Firebase config).
- Server routes: validate input, keep Gemini calls server-side only (never expose `GEMINI_API_KEY` to the client bundle).
- PDF/DOCX generation is server-side (puppeteer-core + chromium) — keep heavy rendering out of the client bundle.
- Firestore access should go through `src/db.ts` — no ad-hoc Firestore calls scattered in components.

## Commands

```bash
npm run dev      # tsx server.ts (dev server)
npm run build    # vite build + esbuild bundle server to dist/server.cjs
npm run start    # node dist/server.cjs
npm run lint      # tsc --noEmit
```

## Knowledge graph

Project has a graphify-generated knowledge graph + Obsidian vault under `graphify-out/`. Re-run `/graphify . --obsidian` after major structural changes to keep it current. See `graphify-out/GRAPH_REPORT.md` for god nodes, communities, and suggested questions; `graphify-out/obsidian/` is the vault.
