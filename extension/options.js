// Reads/writes chrome.storage.local.appUrl — the same key popup.js uses to
// decide where captured job postings open.
const DEFAULT_APP_URL = 'http://localhost:3000';

const input = document.getElementById('appUrl');
const saveBtn = document.getElementById('saveBtn');
const status = document.getElementById('status');

async function load() {
  const stored = await chrome.storage.local.get('appUrl');
  input.value = stored.appUrl || DEFAULT_APP_URL;
}

function normalize(raw) {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  // Reject anything that isn't a valid http(s) origin.
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return trimmed;
  } catch {
    return null;
  }
}

saveBtn.addEventListener('click', async () => {
  const value = normalize(input.value);
  if (value === null) {
    status.style.color = '#dc2626';
    status.textContent = 'Enter a valid http:// or https:// URL.';
    return;
  }
  const toStore = value || DEFAULT_APP_URL;
  await chrome.storage.local.set({ appUrl: toStore });
  input.value = toStore;
  status.style.color = '#16a34a';
  status.textContent = 'Saved.';
  setTimeout(() => { status.textContent = ''; }, 2000);
});

load();
