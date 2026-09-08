import { describe, it, expect } from 'vitest';
import { buildHistoryEntry, buildHistoryTitle, nextHistoryId, mergeHistory } from './tailorHistoryEntries';
import type { HistoryEntry, TailorResponse } from '../types';
import type { QueueJobInput } from './tailorQueue';

const result = (title = 'Staff Engineer'): TailorResponse =>
  ({ atsScoreBefore: 40, atsScoreAfter: 88, tailoredResume: { contact: { title } } } as unknown as TailorResponse);

const job = (over: Partial<QueueJobInput> = {}): QueueJobInput => ({
  id: 'j1', title: 'Backend Engineer', company: 'Acme', location: 'Remote',
  url: 'https://x.com/j1', description: 'desc', ...over,
});

const entry = (id: string): HistoryEntry =>
  ({ id, timestamp: 't', title: 't', result: result() } as HistoryEntry);

describe('buildHistoryTitle', () => {
  it('uses the job title and company when present', () => {
    expect(buildHistoryTitle(job(), result())).toBe('Backend Engineer at Acme');
  });

  it('falls back to the resume title when the job title is blank', () => {
    expect(buildHistoryTitle(job({ title: '' }), result('Staff Engineer'))).toBe('Staff Engineer at Acme');
  });

  it('falls back to "Job URL" / "Target Job" when the company is blank', () => {
    expect(buildHistoryTitle(job({ company: '', url: 'https://x.com/j1' }), result())).toBe('Backend Engineer at Job URL');
    expect(buildHistoryTitle(job({ company: '', url: '' }), result())).toBe('Backend Engineer at Target Job');
  });
});

describe('buildHistoryEntry', () => {
  it('carries company/title metadata and the result', () => {
    const e = buildHistoryEntry(job(), result(), 'h1', new Date(0));
    expect(e).toMatchObject({ id: 'h1', targetCompany: 'Acme', targetTitle: 'Backend Engineer' });
    expect(e.result.atsScoreAfter).toBe(88);
  });
});

describe('nextHistoryId', () => {
  it('gives distinct ids for 8 runs at the same instant', () => {
    const existing: HistoryEntry[] = [];
    const ids = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const id = nextHistoryId(existing, 1000);
      ids.add(id);
      existing.push(entry(id));
    }
    expect(ids.size).toBe(8);
  });

  it('never collides with an id already present', () => {
    const id = nextHistoryId([entry('1000'), entry('1000_1')], 1000);
    expect(id).toBe('1000_2');
  });
});

describe('mergeHistory', () => {
  it('puts new entries first and caps at the limit', () => {
    const prev = [entry('a'), entry('b'), entry('c')];
    const merged = mergeHistory(prev, [entry('new')], 3);
    expect(merged.map((e) => e.id)).toEqual(['new', 'a', 'b']);
  });

  it('does not duplicate an id already present', () => {
    const merged = mergeHistory([entry('a'), entry('b')], [entry('a')], 10);
    expect(merged.map((e) => e.id)).toEqual(['a', 'b']);
  });
});
