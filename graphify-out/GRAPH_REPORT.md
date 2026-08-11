# Graph Report - .  (2026-08-11)

## Corpus Check
- 53 files · ~63,788 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 327 nodes · 449 edges · 40 communities (32 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Feature Views & Data Types
- NPM Runtime Dependencies
- App Shell, Firestore & Local DB
- Build Tooling & Scripts
- Project Docs & Architecture Notes
- TypeScript Compiler Config
- Auth, Toast & Firebase Init
- Server: Gemini API Handlers
- Spellcheck Feature
- Scratch Test Script (test10)
- Scratch Test Script (test11)
- Scratch Test Script (test12)
- Scratch Test Script (test13)
- Scratch Test Script (test14)
- Scratch Test Script (test15)
- Scratch Test Script (test16)
- Scratch Test Script (test17)
- Scratch Test Script (test18)
- Scratch Test Script (test2)
- Scratch Test Script (test3)
- Scratch Test Script (test4)
- Scratch Test Script (test5)
- Scratch Test Script (test6)
- Scratch Test Script (test7)
- Scratch Test Script (test8)
- Scratch Test Script (test9)
- Scratch Test Script (test.cjs)
- Scratch Test Script (test.js)
- Duplicate Firebase Init (known gap)
- App Entry & DOM Mount
- Landing Page Component
- Animation Library Reference
- Charts Library Reference
- Google Fonts Reference
- Sample Data File
- Shared Types File
- Local DB Fallback File
- Spellcheck File

## God Nodes (most connected - your core abstractions)
1. `ResumeData` - 17 edges
2. `useToast()` - 15 edges
3. `compilerOptions` - 15 edges
4. `App()` - 14 edges
5. `ApplicationIntegrationsHub()` - 10 edges
6. `handleFirestoreError()` - 9 edges
7. `saveJobApplications()` - 9 edges
8. `getJobApplications()` - 8 edges
9. `ATS Resume Tailor (Project)` - 8 edges
10. `useAuth()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `CareerCraft AI (product branding in index.html meta tags)` --semantically_similar_to--> `ATS Resume Tailor (Project)`  [INFERRED] [semantically similar]
  index.html → CLAUDE.md
- `/src/main.tsx module entry script` --references--> `src/App.tsx (root shell/routing)`  [AMBIGUOUS]
  index.html → CLAUDE.md
- `README.md project overview (AI resume/cover-letter tailoring tool)` --cites--> `graphify-out/GRAPH_REPORT.md`  [EXTRACTED]
  README.md → CLAUDE.md
- `README.md project overview (AI resume/cover-letter tailoring tool)` --cites--> `graphify-out/obsidian/ (Obsidian vault)`  [EXTRACTED]
  README.md → CLAUDE.md
- `InterviewPrepCoach()` --calls--> `useToast()`  [EXTRACTED]
  src/components/InterviewPrepCoach.tsx → src/components/Toast.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Duplicate Firebase initialization files flagged as unresolved gap** — src_firebase_ts, src_lib_firebase_ts, claude_md_duplicate_firebase_init_gap [EXTRACTED 1.00]
- **Server-side PDF/DOCX export flow (stack + entry points)** — claude_md_pdf_docx_export_stack, server_ts, generate_pdf_ts [EXTRACTED 1.00]
- **graphify-generated knowledge graph artifacts for this project** — graphify_out_dir, graphify_out_graph_report_md, graphify_out_obsidian_vault [EXTRACTED 1.00]

## Communities (40 total, 8 thin omitted)

### Community 0 - "Feature Views & Data Types"
Cohesion: 0.07
Nodes (30): ApplicationIntegrationsHubProps, AtsDashboardProps, CoverLetterPreview(), CoverLetterPreviewProps, AnswerFeedback, InterviewPrepCoach(), InterviewPrepCoachProps, InterviewQuestion (+22 more)

### Community 1 - "NPM Runtime Dependencies"
Cohesion: 0.05
Nodes (41): docx, dotenv, express, express-rate-limit, firebase, firebase-admin, @google/genai, html2canvas (+33 more)

### Community 2 - "App Shell, Firestore & Local DB"
Cohesion: 0.13
Nodes (32): RFC-2822, App(), getInitialResume(), validateAndCleanResumeData(), useAuth(), ApplicationIntegrationsHub(), ApplicationTracker(), JobApplication (+24 more)

### Community 3 - "Build Tooling & Scripts"
Cohesion: 0.07
Nodes (28): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+20 more)

### Community 4 - "Project Docs & Architecture Notes"
Cohesion: 0.11
Nodes (22): ATS Resume Tailor (Project), Express (server.ts), Firebase (Auth + Firestore), firebase-admin (server-side), @google/genai (Gemini), Missing /api/obsidian/sync route (known gap), PDF/DOCX export stack (jspdf, pdf-lib, docx, html2canvas, puppeteer-core, @sparticuz/chromium), React 19 (+14 more)

### Community 5 - "TypeScript Compiler Config"
Cohesion: 0.11
Nodes (18): DOM, DOM.Iterable, ES2022, compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules (+10 more)

### Community 6 - "Auth, Toast & Firebase Init"
Cohesion: 0.15
Nodes (13): AuthContext, AuthContextType, AuthProvider(), ToastContext, ToastContextType, ToastMessage, ToastProvider(), ToastType (+5 more)

### Community 7 - "Server: Gemini API Handlers"
Cohesion: 0.33
Nodes (7): app, callOpenAICompatible(), generateContentWithRetry(), getGeminiClient(), repairIncompleteJson(), safeJsonParse(), sleep()

### Community 8 - "Spellcheck Feature"
Cohesion: 0.39
Nodes (6): SpellcheckField(), SpellcheckFieldProps, BASE_WORDS, checkWordSpelling(), DICTIONARY, getSpellingErrors()

### Community 9 - "Scratch Test Script (test10)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 10 - "Scratch Test Script (test11)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 11 - "Scratch Test Script (test12)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 12 - "Scratch Test Script (test13)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 13 - "Scratch Test Script (test14)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 14 - "Scratch Test Script (test15)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 15 - "Scratch Test Script (test16)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 16 - "Scratch Test Script (test17)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 17 - "Scratch Test Script (test18)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 18 - "Scratch Test Script (test2)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 19 - "Scratch Test Script (test3)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 20 - "Scratch Test Script (test4)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 21 - "Scratch Test Script (test5)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 22 - "Scratch Test Script (test6)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 23 - "Scratch Test Script (test7)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 24 - "Scratch Test Script (test8)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 25 - "Scratch Test Script (test9)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 26 - "Scratch Test Script (test.cjs)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 27 - "Scratch Test Script (test.js)"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 28 - "Duplicate Firebase Init (known gap)"
Cohesion: 1.00
Nodes (3): Duplicate firebase init files (known gap), src/firebase.ts (firebase init), src/lib/firebase.ts (firebase init)

### Community 29 - "App Entry & DOM Mount"
Cohesion: 0.67
Nodes (3): /src/main.tsx module entry script, #root mount div, src/App.tsx (root shell/routing)

## Ambiguous Edges - Review These
- `src/App.tsx (root shell/routing)` → `/src/main.tsx module entry script`  [AMBIGUOUS]
  index.html · relation: references
- `src/components/ (feature views)` → `src/db.ts (canonical Firestore access point)`  [AMBIGUOUS]
  CLAUDE.md · relation: references

## Knowledge Gaps
- **155 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+150 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `src/App.tsx (root shell/routing)` and `/src/main.tsx module entry script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `src/components/ (feature views)` and `src/db.ts (canonical Firestore access point)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `dependencies` connect `NPM Runtime Dependencies` to `Build Tooling & Scripts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `ResumeData` connect `Feature Views & Data Types` to `App Shell, Firestore & Local DB`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _155 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Feature Views & Data Types` be split into smaller, more focused modules?**
  _Cohesion score 0.06845513413506013 - nodes in this community are weakly interconnected._
- **Should `NPM Runtime Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._