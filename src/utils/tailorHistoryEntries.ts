import type { HistoryEntry, TailorResponse } from '../types';
import type { QueueJobInput } from './tailorQueue';

/**
 * Pure helpers for turning a completed tailor-queue run into a `HistoryEntry`
 * and folding it into the history list. Kept out of App.tsx so the id/title/merge
 * logic is unit-testable (there is no jsdom in this project's test setup).
 */

/** Matches the title formula in App.tsx `handleTailor`. */
export function buildHistoryTitle(
  job: Pick<QueueJobInput, 'title' | 'company' | 'url'>,
  result: TailorResponse
): string {
  const role = job.title || result.tailoredResume.contact.title;
  const company = job.company || (job.url ? 'Job URL' : 'Target Job');
  return `${role} at ${company}`;
}

export function buildHistoryEntry(
  job: QueueJobInput,
  result: TailorResponse,
  id: string,
  now: Date
): HistoryEntry {
  return {
    id,
    timestamp: now.toLocaleString(),
    title: buildHistoryTitle(job, result),
    targetCompany: job.company || '',
    targetTitle: job.title || '',
    result,
  };
}

/**
 * A history id that does not collide with any entry already in `existing`.
 * Base is `String(now)`; ties get `_1`, `_2`... so a batch completing several
 * runs inside one millisecond still gets distinct ids (the old
 * `Date.now() + '_' + i` scheme could collide across two batches).
 */
export function nextHistoryId(existing: HistoryEntry[], now: number): string {
  const used = new Set(existing.map((e) => e.id));
  let candidate = String(now);
  let suffix = 0;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${now}_${suffix}`;
  }
  return candidate;
}

/**
 * Folds `incoming` entries into `prev`, newest-first, de-duplicated by id, and
 * capped at `limit`. The result is the FULL list to hand to `persistHistory` —
 * `syncSubcollection` deletes any Firestore doc missing from the array it gets.
 */
export function mergeHistory(prev: HistoryEntry[], incoming: HistoryEntry[], limit: number): HistoryEntry[] {
  const incomingIds = new Set(incoming.map((e) => e.id));
  const kept = prev.filter((e) => !incomingIds.has(e.id));
  return [...incoming, ...kept].slice(0, limit);
}
