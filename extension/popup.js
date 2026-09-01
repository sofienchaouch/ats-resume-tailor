// Default target — change this (or set chrome.storage.local.appUrl) once
// ATS Resume Tailor is deployed somewhere other than local dev.
const DEFAULT_APP_URL = 'http://localhost:3000';

const btn = document.getElementById('captureBtn');
const status = document.getElementById('status');
const targetEl = document.getElementById('target');
const settingsLink = document.getElementById('settingsLink');

// Show which app URL captures will open in, and offer a shortcut to change it.
chrome.storage.local.get('appUrl').then((stored) => {
  targetEl.textContent = (stored.appUrl || DEFAULT_APP_URL).replace(/^https?:\/\//, '');
});

settingsLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

btn.addEventListener('click', async () => {
  btn.disabled = true;
  status.textContent = 'Capturing...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      throw new Error('Could not read the current tab URL.');
    }

    const stored = await chrome.storage.local.get('appUrl');
    const appUrl = stored.appUrl || DEFAULT_APP_URL;

    const target = `${appUrl.replace(/\/+$/, '')}/?jobUrl=${encodeURIComponent(tab.url)}`;
    await chrome.tabs.create({ url: target });
    status.textContent = 'Opened in ATS Resume Tailor.';
  } catch (err) {
    status.textContent = err instanceof Error ? err.message : 'Capture failed.';
    btn.disabled = false;
  }
});
