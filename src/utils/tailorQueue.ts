import type { TailorResponse } from '../types';

/**
 * The tailor queue: a single, sequential, one-at-a-time pipeline that both the
 * per-job "Quick Tailor" button and the multi-select "Tailor Selected" action
 * feed into. This module is the pure state machine — no React, no `Date.now()`,
 * no network. The runner (src/components/tailorQueue/TailorQueueContext.tsx)
 * supplies time and side effects.
 */

export type QueueItemStatus = 'queued' | 'running' | 'done' | 'failed';

/** A snapshot of the job — the queue never dereferences `searchResults`. */
export interface QueueJobInput {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
}

export interface QueueItemError {
  message: string;
  code: string;
}

export interface TailorQueueItem {
  jobId: string;
  job: QueueJobInput;
  status: QueueItemStatus;
  origin: 'quick' | 'batch';
  enqueuedAt: number;
  /** Total /api/tailor sends for this item (incremented on `start`). */
  attempts: number;
  /** Consecutive 429s for this item. */
  rateLimitHits: number;
  result?: TailorResponse;
  historyId?: string;
  error?: QueueItemError;
}

export interface TailorQueueState {
  /** Insertion order == run order. */
  items: TailorQueueItem[];
  runningJobId: string | null;
  /** Non-null => the queue is paused until this epoch-ms (429 backoff). */
  pausedUntilMs: number | null;
  pauseReason: 'rate-limited' | null;
}

export type QueueAction =
  | { type: 'enqueue'; jobs: QueueJobInput[]; origin: 'quick' | 'batch'; now: number }
  | { type: 'start'; jobId: string }
  | { type: 'succeed'; jobId: string; result: TailorResponse; historyId: string }
  | { type: 'fail'; jobId: string; error: QueueItemError }
  | { type: 'rateLimited'; jobId: string; resumeAtMs: number }
  | { type: 'resume' }
  | { type: 'retry'; jobId: string; now: number }
  | { type: 'remove'; jobId: string }
  | { type: 'clearFinished' };

export const initialQueueState: TailorQueueState = {
  items: [],
  runningJobId: null,
  pausedUntilMs: null,
  pauseReason: null,
};

const FINISHED_STATUSES: QueueItemStatus[] = ['done', 'failed'];

function freshItem(job: QueueJobInput, origin: 'quick' | 'batch', now: number): TailorQueueItem {
  return { jobId: job.id, job, status: 'queued', origin, enqueuedAt: now, attempts: 0, rateLimitHits: 0 };
}

export function queueReducer(state: TailorQueueState, action: QueueAction): TailorQueueState {
  switch (action.type) {
    case 'enqueue': {
      let items = state.items;
      for (const job of action.jobs) {
        const existing = items.find((it) => it.jobId === job.id);
        // Already pending — leave it where it is in the run order.
        if (existing && (existing.status === 'queued' || existing.status === 'running')) continue;
        const next = freshItem(job, action.origin, action.now);
        items = existing
          ? items.map((it) => (it.jobId === job.id ? next : it))
          : [...items, next];
      }
      return items === state.items ? state : { ...state, items };
    }

    case 'start': {
      // Concurrency-1 is enforced HERE, not in the effect.
      if (state.runningJobId !== null) return state;
      const target = state.items.find((it) => it.jobId === action.jobId && it.status === 'queued');
      if (!target) return state;
      return {
        ...state,
        runningJobId: action.jobId,
        items: state.items.map((it) =>
          it.jobId === action.jobId ? { ...it, status: 'running', attempts: it.attempts + 1 } : it
        ),
      };
    }

    case 'succeed': {
      return {
        ...state,
        runningJobId: state.runningJobId === action.jobId ? null : state.runningJobId,
        items: state.items.map((it) =>
          it.jobId === action.jobId
            ? { ...it, status: 'done', result: action.result, historyId: action.historyId, error: undefined }
            : it
        ),
      };
    }

    case 'fail': {
      return {
        ...state,
        runningJobId: state.runningJobId === action.jobId ? null : state.runningJobId,
        items: state.items.map((it) =>
          it.jobId === action.jobId ? { ...it, status: 'failed', error: action.error } : it
        ),
      };
    }

    case 'rateLimited': {
      // Back to `queued`, never `failed` — a rate-limited job is not a lost job.
      return {
        ...state,
        runningJobId: state.runningJobId === action.jobId ? null : state.runningJobId,
        pausedUntilMs: action.resumeAtMs,
        pauseReason: 'rate-limited',
        items: state.items.map((it) =>
          it.jobId === action.jobId
            ? { ...it, status: 'queued', rateLimitHits: it.rateLimitHits + 1 }
            : it
        ),
      };
    }

    case 'resume':
      return state.pausedUntilMs === null && state.pauseReason === null
        ? state
        : { ...state, pausedUntilMs: null, pauseReason: null };

    case 'retry': {
      const target = state.items.find((it) => it.jobId === action.jobId);
      if (!target || (target.status !== 'failed' && target.status !== 'done')) return state;
      return {
        ...state,
        items: state.items.map((it) =>
          it.jobId === action.jobId
            ? { ...it, status: 'queued', error: undefined, enqueuedAt: action.now }
            : it
        ),
      };
    }

    case 'remove': {
      return {
        ...state,
        runningJobId: state.runningJobId === action.jobId ? null : state.runningJobId,
        items: state.items.filter((it) => it.jobId !== action.jobId),
      };
    }

    case 'clearFinished':
      return { ...state, items: state.items.filter((it) => !FINISHED_STATUSES.includes(it.status)) };

    default:
      return state;
  }
}

// --- selectors -------------------------------------------------------------

export function selectNextRunnable(state: TailorQueueState, now: number): TailorQueueItem | null {
  if (state.runningJobId !== null) return null;
  if (state.pausedUntilMs !== null && now < state.pausedUntilMs) return null;
  return state.items.find((it) => it.status === 'queued') ?? null;
}

export interface QueueSummary {
  queued: number;
  running: number;
  done: number;
  failed: number;
  total: number;
}

export function selectQueueSummary(state: TailorQueueState): QueueSummary {
  const summary: QueueSummary = { queued: 0, running: 0, done: 0, failed: 0, total: state.items.length };
  for (const it of state.items) summary[it.status] += 1;
  return summary;
}

export function selectItem(state: TailorQueueState, jobId: string): TailorQueueItem | undefined {
  return state.items.find((it) => it.jobId === jobId);
}

export function selectSucceeded(state: TailorQueueState): TailorQueueItem[] {
  return state.items.filter((it) => it.status === 'done');
}

export function isQueueActive(state: TailorQueueState): boolean {
  return state.runningJobId !== null || state.items.some((it) => it.status === 'queued');
}
