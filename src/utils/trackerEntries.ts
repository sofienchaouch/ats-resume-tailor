/**
 * Pure find-or-insert for the Application Tracker array. Both `handleSyncToTracker`
 * and the tailor queue's drain handler in App.tsx go through this instead of
 * hand-rolling the same case-insensitive company+title match. Backend-agnostic:
 * the caller loads/saves the array (Firestore for signed-in, localStorage for
 * guests) — this only transforms it.
 */

export interface TrackerApplication {
  id: string;
  company: string;
  title: string;
  location?: string;
  status?: string;
  jobUrl?: string;
  dateAdded?: string;
  dateUpdated?: string;
  resumeId?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface TrackerUpsertInput {
  company: string;
  title: string;
  jobUrl?: string;
  location?: string;
}

export interface TrackerUpsertOptions {
  /** 'YYYY-MM-DD'. */
  today: string;
  /** Attached to inserted/updated rows for signed-in users; left off for guests. */
  resumeId?: string;
  /** Status for a freshly-inserted row. Existing rows keep their own status. */
  insertStatus?: string;
  /** Builds the note line appended on each upsert. */
  noteFor: (input: TrackerUpsertInput) => string;
  /** Fresh id for an inserted row. */
  newId: () => string;
}

/** Case- and whitespace-insensitive match on company + title. -1 if absent. */
export function findApplicationIndex(apps: TrackerApplication[], company: string, title: string): number {
  const c = company.trim().toLowerCase();
  const t = title.trim().toLowerCase();
  return apps.findIndex(
    (a) =>
      String(a?.company ?? '').trim().toLowerCase() === c &&
      String(a?.title ?? '').trim().toLowerCase() === t
  );
}

function appendNote(existing: string | undefined, note: string): string {
  return existing ? `${existing}\n${note}` : note;
}

/**
 * Applies every input to `apps` in one pass — one row per company+title, never
 * duplicated. Never demotes an existing row's status (a job already
 * `interviewing` stays `interviewing`). Returns a new array; does not mutate.
 */
export function upsertApplications(
  apps: TrackerApplication[],
  inputs: TrackerUpsertInput[],
  opts: TrackerUpsertOptions
): TrackerApplication[] {
  let next = [...apps];
  for (const input of inputs) {
    const company = input.company.trim() || 'Unknown Company';
    const title = input.title.trim() || 'Unknown Role';
    const note = opts.noteFor(input);
    const idx = findApplicationIndex(next, company, title);

    if (idx >= 0) {
      const current = next[idx];
      next = next.map((a, i) =>
        i === idx
          ? {
              ...current,
              status: current.status || opts.insertStatus || 'saved',
              jobUrl: input.jobUrl || current.jobUrl,
              location: current.location || input.location,
              dateUpdated: opts.today,
              resumeId: opts.resumeId ?? current.resumeId,
              notes: appendNote(current.notes, note),
            }
          : a
      );
    } else {
      next = [
        {
          id: opts.newId(),
          company,
          title,
          location: input.location || 'Remote/Unknown',
          status: opts.insertStatus || 'saved',
          jobUrl: input.jobUrl,
          dateAdded: opts.today,
          dateUpdated: opts.today,
          resumeId: opts.resumeId,
          notes: note,
        },
        ...next,
      ];
    }
  }
  return next;
}
