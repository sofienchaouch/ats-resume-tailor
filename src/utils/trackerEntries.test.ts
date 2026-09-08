import { describe, it, expect } from 'vitest';
import { findApplicationIndex, upsertApplications, type TrackerApplication } from './trackerEntries';

const opts = (over: Partial<Parameters<typeof upsertApplications>[2]> = {}) => ({
  today: '2026-09-07',
  noteFor: () => '[Queue] tailored',
  newId: () => 'app_new',
  ...over,
});

describe('findApplicationIndex', () => {
  it('matches case- and whitespace-insensitively', () => {
    const apps: TrackerApplication[] = [
      { id: '1', company: '  Acme, Inc ', title: 'Backend Engineer' },
      { id: '2', company: 'Other', title: 'Dev' },
    ];
    expect(findApplicationIndex(apps, 'acme, inc', 'BACKEND ENGINEER')).toBe(0);
    expect(findApplicationIndex(apps, 'nobody', 'x')).toBe(-1);
  });
});

describe('upsertApplications', () => {
  it('inserts a new row at the front with the given status and dates', () => {
    const out = upsertApplications([], [{ company: 'Acme', title: 'Dev', jobUrl: 'https://x/1' }], opts({ insertStatus: 'saved' }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: 'app_new',
      company: 'Acme',
      title: 'Dev',
      status: 'saved',
      jobUrl: 'https://x/1',
      dateAdded: '2026-09-07',
      dateUpdated: '2026-09-07',
      notes: '[Queue] tailored',
    });
  });

  it('updates an existing row in place, appending the note, without demoting status', () => {
    const apps: TrackerApplication[] = [{ id: '1', company: 'Acme', title: 'Dev', status: 'interviewing', notes: 'old' }];
    const out = upsertApplications(apps, [{ company: 'acme', title: 'dev' }], opts());
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('interviewing');
    expect(out[0].notes).toBe('old\n[Queue] tailored');
    expect(out[0].dateUpdated).toBe('2026-09-07');
  });

  it('collapses two inputs for the same company+title into one row', () => {
    const out = upsertApplications(
      [],
      [
        { company: 'Acme', title: 'Dev' },
        { company: 'Acme', title: 'Dev' },
      ],
      opts()
    );
    expect(out).toHaveLength(1);
  });

  it('sets resumeId only when provided', () => {
    const guest = upsertApplications([], [{ company: 'A', title: 'B' }], opts());
    expect(guest[0].resumeId).toBeUndefined();
    const signedIn = upsertApplications([], [{ company: 'A', title: 'B' }], opts({ resumeId: 'primary' }));
    expect(signedIn[0].resumeId).toBe('primary');
  });

  it('does not mutate the input array', () => {
    const apps: TrackerApplication[] = [{ id: '1', company: 'A', title: 'B' }];
    const snapshot = JSON.parse(JSON.stringify(apps));
    upsertApplications(apps, [{ company: 'C', title: 'D' }], opts());
    expect(apps).toEqual(snapshot);
  });
});
