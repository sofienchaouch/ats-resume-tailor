# ATS Resume Tailor

AI-powered resume and cover-letter tailoring tool. Paste a job description and your master resume — get an ATS-optimized resume, a matching cover letter, an ATS score dashboard, application tracking, and interview prep.

## Stack

React 19 + Vite + Tailwind on the frontend, Express + Gemini (`@google/genai`) on the backend, Firebase for auth/data, puppeteer for server-side PDF export.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in `GEMINI_API_KEY` and Firebase config
3. Run the app: `npm run dev`

## Scripts

```bash
npm run dev      # start dev server
npm run build    # production build (client + server bundle)
npm run start    # run production build
npm run lint      # typecheck
```

## Project docs

- [CLAUDE.md](CLAUDE.md) — architecture notes and known gaps for AI-assisted development
- `graphify-out/GRAPH_REPORT.md` — auto-generated codebase knowledge graph report
- `graphify-out/obsidian/` — Obsidian vault of the codebase (one note per module/component, cross-linked)

Regenerate the graph/vault after structural changes: `/graphify . --obsidian`
