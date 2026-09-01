# ATS Resume Tailor

AI-powered resume & cover-letter tailoring. Paste a job description and your master
resume — get an ATS-optimized resume, a matching cover letter, a keyword-gap
dashboard, a multi-source job search, application tracking, and interview prep.

## Features

- **Tailor** a master resume to any job description (or job URL) — English or French
- **ATS dashboard** — before/after score, keyword coverage radar, formatting checks
- **Cover letters** — generated from the tailored resume + JD; export PDF / DOCX / TXT / Markdown
- **Deep job search** — merges results from job-board APIs (Arbeitnow, optional Adzuna/Jooble),
  a company watchlist (public Greenhouse / Lever / Ashby boards), and AI web search;
  deduped, fit-ranked against your resume, and URL-verified. Never fabricates listings.
- **Application tracker** — kanban board, funnel analytics, follow-up reminders,
  optional Gmail/Calendar integration
- **Interview prep** — AI question generation with STAR strategies, mock-answer scoring
- **Multi-provider AI** — Gemini (default), OpenAI, OpenRouter, any OpenAI-compatible
  endpoint, or the local Claude Code CLI. Automatic cross-provider fallback on
  quota/auth failure; optional per-task provider pinning.
- **Exports** — server-side PDF (puppeteer), DOCX, Markdown (drop into an Obsidian vault)
- **Chrome extension** (`extension/`) — one-click capture of the job posting you're viewing

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + Vite 6 + TailwindCSS 4 |
| Backend | Express (`server.ts`), run with `tsx` |
| AI | `@google/genai` (Gemini) + OpenAI-compatible + Claude Code CLI adapters |
| Auth / DB | Firebase Auth + Firestore (`firebase-admin` server-side) |
| Export | jspdf, pdf-lib, docx, puppeteer-core + @sparticuz/chromium |
| Tests | Vitest (pure-logic suites) |

## Run locally

**Prerequisites:** Node.js 20+

```bash
npm install
cp .env.example .env      # then edit .env (see below)
npm run dev               # http://localhost:3000
```

### Environment

Only `GEMINI_API_KEY` is required for full functionality. Everything in
`.env.example` is documented there; the essentials:

| Var | Required | Notes |
|-----|----------|-------|
| `GEMINI_API_KEY` | yes* | Free tier from [Google AI Studio](https://aistudio.google.com/apikey). *Guests can also paste their own key in the in-app AI Settings. |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | no | Free — [developer.adzuna.com](https://developer.adzuna.com/). Adds a job-search source. |
| `JOOBLE_API_KEY` | no | Free — [jooble.org/api/about](https://jooble.org/api/about). Adds a job-search source. |
| `ENABLE_CLAUDE_CLI_PROVIDER` | no | Local dev only. Route AI calls through the `claude` CLI on this machine (no API key). |
| `ENABLE_CLAUDE_CLI_WEB_SEARCH` | no | Local dev only. Lets job search use the CLI's WebSearch tool. |

**Firebase:** the config is hardcoded in `src/firebase.ts` and
`firebase-applet-config.json` (a Firebase web config is not a secret — access is
controlled by Firestore rules + authorized domains). To point at your own Firebase
project, edit those two files, enable Google sign-in, and add your domain under
Authentication → Settings → Authorized domains.

## Scripts

```bash
npm run dev        # dev server (:3000)
npm run build      # production build (client + esbuild server bundle)
npm run start      # run the production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm test           # vitest run
```

## Project docs

- [CLAUDE.md](CLAUDE.md) — architecture notes, provider-routing rules, known gaps
- `graphify-out/` — auto-generated codebase knowledge graph + Obsidian vault
  (regenerate with `/graphify . --obsidian` after structural changes)

## License

MIT — see [LICENSE](LICENSE).
