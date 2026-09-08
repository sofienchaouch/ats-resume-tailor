import { describe, it, expect } from 'vitest';
import {
  queueReducer,
  initialQueueState,
  selectNextRunnable,
  selectQueueSummary,
  selectSucceeded,
  isQueueActive,
  type TailorQueueState,
  type QueueJobInput,
} from './tailorQueue';
import type { TailorResponse } from '../types';

const job = (id: string): QueueJobInput => ({
  id,
  title: `Title ${id}`,
  company: `Company ${id}`,
  location: 'Remote',
  url: `https://x.com/${id}`,
  description: `desc ${id}`,
});

const RESULT = { atsScoreBefore: 40, atsScoreAfter: 80, tailoredResume: { contact: { title: 'Dev' } } } as unknown as TailorResponse;

function enqueue(state: TailorQueueState, ids: string[], now = 1): TailorQueueState {
  return queueReducer(state, { type: 'enqueue', jobs: ids.map(job), origin: 'quick', now });
}

describe('queueReducer — enqueue', () => {
  it('preserves insertion order', () => {
    const s = enqueue(initialQueueState, ['a', 'b', 'c']);
    expect(s.items.map((i) => i.jobId)).toEqual(['a', 'b', 'c']);
  });

  it('skips an id that is already queued', () => {
    let s = enqueue(initialQueueState, ['a']);
    s = enqueue(s, ['a']);
    expect(s.items).toHaveLength(1);
  });

  it('replaces a done/failed id with a fresh queued item', () => {
    let s = enqueue(initialQueueState, ['a']);
    s = queueReducer(s, { type: 'start', jobId: 'a' });
    s = queueReducer(s, { type: 'fail', jobId: 'a', error: { message: 'x', code: 'X' } });
    s = enqueue(s, ['a'], 99);
    expect(s.items).toHaveLength(1);
    expect(s.items[0].status).toBe('queued');
    expect(s.items[0].error).toBeUndefined();
    expect(s.items[0].enqueuedAt).toBe(99);
  });
});

describe('queueReducer — run lifecycle', () => {
  it('start is ignored while another job is running (concurrency-1)', () => {
    let s = enqueue(initialQueueState, ['a', 'b']);
    s = queueReducer(s, { type: 'start', jobId: 'a' });
    const before = s;
    s = queueReducer(s, { type: 'start', jobId: 'b' });
    expect(s).toBe(before);
    expect(s.runningJobId).toBe('a');
  });

  it('start increments attempts and sets running', () => {
    let s = enqueue(initialQueueState, ['a']);
    s = queueReducer(s, { type: 'start', jobId: 'a' });
    expect(s.items[0].status).toBe('running');
    expect(s.items[0].attempts).toBe(1);
    expect(s.runningJobId).toBe('a');
  });

  it('succeed stores result + historyId and clears running', () => {
    let s = enqueue(initialQueueState, ['a']);
    s = queueReducer(s, { type: 'start', jobId: 'a' });
    s = queueReducer(s, { type: 'succeed', jobId: 'a', result: RESULT, historyId: 'h1' });
    expect(s.items[0].status).toBe('done');
    expect(s.items[0].historyId).toBe('h1');
    expect(s.runningJobId).toBeNull();
  });

  it('fail stores the error and clears running', () => {
    let s = enqueue(initialQueueState, ['a']);
    s = queueReducer(s, { type: 'start', jobId: 'a' });
    s = queueReducer(s, { type: 'fail', jobId: 'a', error: { message: 'boom', code: 'NET' } });
    expect(s.items[0].status).toBe('failed');
    expect(s.items[0].error).toEqual({ message: 'boom', code: 'NET' });
    expect(s.runningJobId).toBeNull();
  });
});

describe('queueReducer — rate limiting', () => {
  it('rateLimited returns the item to queued (not failed) and pauses the queue', () => {
    let s = enqueue(initialQueueState, ['a']);
    s = queueReducer(s, { type: 'start', jobId: 'a' });
    s = queueReducer(s, { type: 'rateLimited', jobId: 'a', resumeAtMs: 5000 });
    expect(s.items[0].status).toBe('queued');
    expect(s.items[0].rateLimitHits).toBe(1);
    expect(s.pausedUntilMs).toBe(5000);
    expect(s.runningJobId).toBeNull();
  });

  it('selectNextRunnable yields nothing while paused, then the same item after resume', () => {
    let s = enqueue(initialQueueState, ['a']);
    s = queueReducer(s, { type: 'start', jobId: 'a' });
    s = queueReducer(s, { type: 'rateLimited', jobId: 'a', resumeAtMs: 5000 });
    expect(selectNextRunnable(s, 4000)).toBeNull();
    expect(selectNextRunnable(s, 6000)?.jobId).toBe('a'); // past the window
    s = queueReducer(s, { type: 'resume' });
    expect(s.pausedUntilMs).toBeNull();
    expect(selectNextRunnable(s, 1)?.jobId).toBe('a');
  });
});

describe('queueReducer — retry / remove / clearFinished', () => {
  it('retry on a failed item returns it to queued, preserving attempts, clearing error', () => {
    let s = enqueue(initialQueueState, ['a']);
    s = queueReducer(s, { type: 'start', jobId: 'a' });
    s = queueReducer(s, { type: 'fail', jobId: 'a', error: { message: 'x', code: 'X' } });
    s = queueReducer(s, { type: 'retry', jobId: 'a', now: 50 });
    expect(s.items[0].status).toBe('queued');
    expect(s.items[0].attempts).toBe(1);
    expect(s.items[0].error).toBeUndefined();
  });

  it('remove of the running item makes a later succeed for that id a no-op', () => {
    let s = enqueue(initialQueueState, ['a', 'b']);
    s = queueReducer(s, { type: 'start', jobId: 'a' });
    s = queueReducer(s, { type: 'remove', jobId: 'a' });
    expect(s.runningJobId).toBeNull();
    expect(s.items.map((i) => i.jobId)).toEqual(['b']);
    const before = s.items;
    s = queueReducer(s, { type: 'succeed', jobId: 'a', result: RESULT, historyId: 'h' });
    expect(s.items).toEqual(before);
  });

  it('clearFinished keeps queued/running and drops done/failed', () => {
    let s = enqueue(initialQueueState, ['a', 'b', 'c']);
    s = queueReducer(s, { type: 'start', jobId: 'a' });
    s = queueReducer(s, { type: 'succeed', jobId: 'a', result: RESULT, historyId: 'h' });
    s = queueReducer(s, { type: 'start', jobId: 'b' });
    s = queueReducer(s, { type: 'fail', jobId: 'b', error: { message: 'x', code: 'X' } });
    s = queueReducer(s, { type: 'clearFinished' });
    expect(s.items.map((i) => i.jobId)).toEqual(['c']);
  });
});

describe('selectors + purity', () => {
  it('selectQueueSummary counts a mixed-state queue', () => {
    let s = enqueue(initialQueueState, ['a', 'b', 'c', 'd']);
    s = queueReducer(s, { type: 'start', jobId: 'a' });
    s = queueReducer(s, { type: 'succeed', jobId: 'a', result: RESULT, historyId: 'h' });
    s = queueReducer(s, { type: 'start', jobId: 'b' });
    expect(selectQueueSummary(s)).toEqual({ queued: 2, running: 1, done: 1, failed: 0, total: 4 });
    expect(selectSucceeded(s).map((i) => i.jobId)).toEqual(['a']);
    expect(isQueueActive(s)).toBe(true);
  });

  it('does not mutate the input state', () => {
    const s = enqueue(initialQueueState, ['a']);
    const snapshot = JSON.parse(JSON.stringify(s));
    queueReducer(s, { type: 'start', jobId: 'a' });
    expect(s).toEqual(snapshot);
  });
});
