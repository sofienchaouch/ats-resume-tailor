/**
 * Stable identity for a job search result, used as the tailor-queue handle and
 * for batch-selection keys.
 *
 * The dedupe semantics deliberately MIRROR `server/jobRank.ts` (`norm` +
 * `urlKey`) — kept as a copy, not an import: `jobRank.ts` pulls in
 * `server/scoring.ts`, which would drag server-only code into the client
 * bundle. Keep the two in sync if either changes.
 */

/** Lowercase, strip punctuation, collapse whitespace — for fuzzy comparison. */
function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** host + pathname only, so tracking params / trailing slashes don't split dupes. */
function urlKey(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.host}${u.pathname}`.replace(/\/$/, '').toLowerCase();
  } catch {
    return norm(raw);
  }
}

/** FNV-1a over the description — last-resort key when there is no url/company/title. */
function hash36(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export interface JobKeyInput {
  url?: string;
  company?: string;
  title?: string;
  description?: string;
}

/**
 * Derivation order: url (host+path) → company::title → description hash.
 * Returns '' only when the job has none of those — callers fall back to index.
 */
export function jobKey(job: JobKeyInput): string {
  const url = (job.url || '').trim();
  // Only trust the URL branch for a real http(s) URL — a stray non-URL string
  // shouldn't outrank a usable company+title.
  if (/^https?:\/\//i.test(url)) {
    const uk = urlKey(url);
    if (uk) return `u:${uk}`;
  }
  const companyTitle = `${norm(job.company || '')}::${norm(job.title || '')}`;
  if (companyTitle !== '::') return `ct:${companyTitle}`;
  const desc = (job.description || '').trim();
  if (desc) return `d:${hash36(desc)}`;
  return '';
}

/**
 * Attaches a collision-free `id` to every job. Genuine duplicates (same derived
 * key) get `key`, `key#2`, `key#3`... so selection and the queue never conflate
 * two rows the user can see separately.
 */
export function attachJobIds<T extends JobKeyInput>(jobs: T[]): (T & { id: string })[] {
  const seen = new Map<string, number>();
  return jobs.map((job, index) => {
    const base = jobKey(job) || `job:${index}`;
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return { ...job, id: count === 1 ? base : `${base}#${count}` };
  });
}
