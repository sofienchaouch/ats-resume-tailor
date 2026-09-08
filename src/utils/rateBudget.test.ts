import { describe, it, expect } from 'vitest';
import {
  createLedger,
  recordSpend,
  pruneLedger,
  reconcile,
  remainingCalls,
  windowResetAtMs,
  budgetWarning,
  computeResumeDelayMs,
  isBudgetExempt,
  EXPENSIVE_CALL_LIMIT,
  RATE_WINDOW_MS,
  BASE_BACKOFF_MS,
  MAX_BACKOFF_MS,
} from './rateBudget';

const T0 = 1_000_000_000_000;

describe('spend counting', () => {
  it('remainingCalls counts only spends inside the window', () => {
    let l = createLedger();
    l = recordSpend(l, T0);
    l = recordSpend(l, T0 + 1000);
    expect(remainingCalls(l, T0 + 2000)).toBe(EXPENSIVE_CALL_LIMIT - 2);
    // 16 minutes later the first two have aged out
    expect(remainingCalls(l, T0 + RATE_WINDOW_MS + 1000)).toBe(EXPENSIVE_CALL_LIMIT);
  });

  it('pruneLedger drops a spend exactly one window old', () => {
    let l = createLedger();
    l = recordSpend(l, T0);
    expect(pruneLedger(l, T0 + RATE_WINDOW_MS + 1).spends).toHaveLength(0);
  });

  it('windowResetAtMs is the oldest live spend plus one window', () => {
    let l = createLedger();
    l = recordSpend(l, T0);
    l = recordSpend(l, T0 + 5000);
    expect(windowResetAtMs(l, T0 + 6000)).toBe(T0 + RATE_WINDOW_MS);
  });

  it('windowResetAtMs is null with no spends', () => {
    expect(windowResetAtMs(createLedger(), T0)).toBeNull();
  });
});

describe('server reconciliation', () => {
  it('a server remaining count overrides the local estimate, both directions', () => {
    let l = createLedger();
    l = recordSpend(l, T0); // local estimate: 7 left
    l = reconcile(l, { limit: 8, remaining: 2, resetAtMs: T0 + 60_000 }, T0);
    expect(remainingCalls(l, T0)).toBe(2);
    l = reconcile(l, { limit: 8, remaining: 6, resetAtMs: T0 + 60_000 }, T0);
    expect(remainingCalls(l, T0)).toBe(6);
  });

  it('a header-less snapshot leaves the local estimate intact', () => {
    let l = recordSpend(createLedger(), T0);
    l = reconcile(l, { limit: null, remaining: null, resetAtMs: null }, T0);
    expect(remainingCalls(l, T0)).toBe(EXPENSIVE_CALL_LIMIT - 1);
  });

  it('a stale server snapshot is dropped once its reset time passes', () => {
    let l = reconcile(createLedger(), { limit: 8, remaining: 0, resetAtMs: T0 + 10_000 }, T0);
    expect(remainingCalls(l, T0 + 5000)).toBe(0);
    expect(remainingCalls(l, T0 + 20_000)).toBe(EXPENSIVE_CALL_LIMIT);
  });

  it('recordSpend also decrements a known server estimate', () => {
    let l = reconcile(createLedger(), { limit: 8, remaining: 3, resetAtMs: T0 + 60_000 }, T0);
    l = recordSpend(l, T0 + 1000);
    expect(remainingCalls(l, T0 + 1000)).toBe(2);
  });
});

describe('budgetWarning', () => {
  it('flags an over-selection', () => {
    expect(budgetWarning(8, 3)).toEqual({ requested: 8, remaining: 3, willWait: 5 });
  });
  it('is null within budget', () => {
    expect(budgetWarning(2, 3)).toBeNull();
  });
  it('is null for an exempt (infinite) budget', () => {
    expect(budgetWarning(50, Infinity)).toBeNull();
  });
});

describe('computeResumeDelayMs', () => {
  it('prefers the server reset time plus padding when it is in the future', () => {
    expect(computeResumeDelayMs({ rateLimitHits: 1, resetAtMs: T0 + 40_000, now: T0 })).toBe(42_000);
  });

  it('falls back to exponential backoff, capped', () => {
    const d = (hits: number) => computeResumeDelayMs({ rateLimitHits: hits, resetAtMs: null, now: T0 });
    expect(d(1)).toBe(BASE_BACKOFF_MS);
    expect(d(2)).toBe(BASE_BACKOFF_MS * 2);
    expect(d(3)).toBe(BASE_BACKOFF_MS * 4);
    expect(d(10)).toBe(MAX_BACKOFF_MS);
  });

  it('ignores a server reset time already in the past', () => {
    expect(computeResumeDelayMs({ rateLimitHits: 1, resetAtMs: T0 - 5000, now: T0 })).toBe(BASE_BACKOFF_MS);
  });
});

describe('isBudgetExempt', () => {
  it('matches server hasOwnApiKey semantics', () => {
    expect(isBudgetExempt({ apiKey: 'sk-123' })).toBe(true);
    expect(isBudgetExempt({ apiKey: '   ' })).toBe(false);
    expect(isBudgetExempt({ apiKey: '' })).toBe(false);
    expect(isBudgetExempt({})).toBe(false);
    expect(isBudgetExempt(null)).toBe(false);
    expect(isBudgetExempt(undefined)).toBe(false);
  });
});
