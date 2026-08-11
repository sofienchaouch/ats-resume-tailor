# ATS Resume Tailor — Job Capture extension

Minimal Manifest V3 Chrome extension. Captures the URL of the job posting
you're currently viewing and opens ATS Resume Tailor with it pre-filled,
ready to tailor — no copy-paste.

## Load it locally

1. Open `chrome://extensions`
2. Enable "Developer mode" (top right)
3. "Load unpacked" → select this `extension/` folder

## Pointing it at a deployed app

By default the popup opens `http://localhost:3000`. Once the app is deployed,
either edit `DEFAULT_APP_URL` in `popup.js`, or set it at runtime from the
extension's own console:

```js
chrome.storage.local.set({ appUrl: 'https://your-deployed-app.example.com' })
```

## How it works

`popup.js` reads the active tab's URL via `chrome.tabs.query`, then opens
`<appUrl>/?jobUrl=<encoded url>`. The app reads that query param once on
mount (`src/App.tsx`), pre-fills the job URL field, and switches to the
editor view — the existing `/api/analyze-job-url` and `/api/tailor` routes
handle everything from there.
