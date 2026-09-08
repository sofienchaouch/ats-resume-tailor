import { describe, it, expect } from 'vitest';
import { buildBatchZipPlan } from './exportBatch';
import type { TailorQueueItem } from './tailorQueue';
import type { TailorResponse } from '../types';

const result = (name: string, title: string): TailorResponse =>
  ({ tailoredResume: { contact: { name, title } } } as unknown as TailorResponse);

const item = (over: Partial<TailorQueueItem>): TailorQueueItem =>
  ({
    jobId: 'j',
    job: { id: 'j', title: 'Dev', company: 'Acme', location: '', url: '', description: '' },
    status: 'done',
    origin: 'quick',
    enqueuedAt: 0,
    attempts: 1,
    rateLimitHits: 0,
    result: result('Ada Lovelace', 'Engineer'),
    ...over,
  }) as TailorQueueItem;

describe('buildBatchZipPlan', () => {
  it('includes only done items with a tailored resume', () => {
    const plan = buildBatchZipPlan([
      item({ jobId: 'a' }),
      item({ jobId: 'b', status: 'failed', result: undefined }),
      item({ jobId: 'c', status: 'queued', result: undefined }),
    ]);
    expect(plan.map((p) => p.jobId)).toEqual(['a']);
    expect(plan[0].fileName).toBe('Ada Lovelace - resume Dev Acme.docx');
  });

  it('disambiguates two runs for the same role + company', () => {
    const plan = buildBatchZipPlan([
      item({ jobId: 'a', job: { id: 'a', title: 'Dev', company: 'Acme', location: '', url: '', description: '' } }),
      item({ jobId: 'b', job: { id: 'b', title: 'Dev', company: 'Acme', location: '', url: '', description: '' } }),
    ]);
    expect(plan.map((p) => p.fileName)).toEqual([
      'Ada Lovelace - resume Dev Acme.docx',
      'Ada Lovelace - resume Dev Acme (2).docx',
    ]);
  });

  it('returns an empty plan when nothing succeeded', () => {
    expect(buildBatchZipPlan([item({ status: 'failed', result: undefined })])).toEqual([]);
  });

  it('falls back to the resume title when the job title is blank', () => {
    const plan = buildBatchZipPlan([
      item({ job: { id: 'j', title: '', company: 'Acme', location: '', url: '', description: '' } }),
    ]);
    expect(plan[0].fileName).toBe('Ada Lovelace - resume Engineer Acme.docx');
  });
});
