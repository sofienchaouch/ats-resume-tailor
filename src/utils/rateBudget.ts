/**
 * Client-side view of the server's expensive-AI rate limit, so the tailor queue
 * can warn before over-committing and back off gracefully on a 429 instead of
 * dropping jobs. Pure — no React, no storage, no `Date.now()` (time comes in).
 *
 * Constants MIRROR `server.ts` `expensiveAiLimiter`. The server's `RateLimit-*`
 * response headers are authoritative when present (see `reconcile`); the local
 * spend count is only the fallback.
 */

export const EXPENSIVE_CALL_LIMIT = 8;          // server.ts expensiveAiLimiter.limit
export const RATE_WINDOW_MS = 15 * 60 * 1000;   // server.ts expensiveAiLimiter.windowMs
export const RESUME_PADDING_MS = 2_000;
export const BASE_BACKOFF_MS = 30_000;
export const MAX_BACKOFF_MS = 5 * 60_000;
/** After this many consecutive 429s on one job, give up and fail it. */
export const MAX_RATE_LIMIT_RETRIES = 5;

export interface RateLimitSnapshot {
  limit: number | null;
  remaining: number | null;
  /** Absolute epoch-ms the window resets, derived from the delta-seconds header. */
  resetAtMs: number | null;
}

export interface SpendLedger {
  /** epoch-ms of each expensive call this device has made. */
  spends: number[];
  /** Latest server-reported remaining count, or null if never seen / stale. */
  serverRemaining: number | null;
  serverResetAtMs: number | null;
}

export function createLedger(): SpendLedger {
  return { spends: [], serverRemaining: null, serverResetAtMs: null };
}

/** Drops spends older than the window and a server snapshot whose window has passed. */
export function pruneLedger(ledger: SpendLedger, now: number): SpendLedger {
  const cutoff = now - RATE_WINDOW_MS;
  const spends = ledger.spends.filter((t) => t > cutoff);
  const serverStale = ledger.serverResetAtMs !== null && now >= ledger.serverResetAtMs;
  return {
    spends,
    serverRemaining: serverStale ? null : ledger.serverRemaining,
    serverResetAtMs: serverStale ? null : ledger.serverResetAtMs,
  };
}

/** Records one expensive call locally and decrements the server estimate if we have one. */
export function recordSpend(ledger: SpendLedger, now: number): SpendLedger {
  const pruned = pruneLedger(ledger, now);
  return {
    ...pruned,
    spends: [...pruned.spends, now],
    serverRemaining: pruned.serverRemaining !== null ? Math.max(0, pruned.serverRemaining - 1) : null,
  };
}

/** Folds an authoritative server snapshot into the ledger. A header-less snapshot is a no-op. */
export function reconcile(ledger: SpendLedger, snapshot: RateLimitSnapshot, now: number): SpendLedger {
  const pruned = pruneLedger(ledger, now);
  if (snapshot.remaining === null && snapshot.resetAtMs === null) return pruned;
  return {
    ...pruned,
    serverRemaining: snapshot.remaining ?? pruned.serverRemaining,
    serverResetAtMs: snapshot.resetAtMs ?? pruned.serverResetAtMs,
  };
}

export function remainingCalls(ledger: SpendLedger, now: number): number {
  const pruned = pruneLedger(ledger, now);
  if (pruned.serverRemaining !== null) return pruned.serverRemaining;
  return Math.max(0, EXPENSIVE_CALL_LIMIT - pruned.spends.length);
}

/** Best guess at when the budget refills, or null when nothing has been spent. */
export function windowResetAtMs(ledger: SpendLedger, now: number): number | null {
  const pruned = pruneLedger(ledger, now);
  if (pruned.serverResetAtMs !== null) return pruned.serverResetAtMs;
  if (pruned.spends.length === 0) return null;
  return Math.min(...pruned.spends) + RATE_WINDOW_MS;
}

export interface BudgetWarning {
  requested: number;
  remaining: number;
  /** How many of the requested jobs will have to wait for the window to refill. */
  willWait: number;
}

/** Advisory only — the caller still enqueues everything. */
export function budgetWarning(requested: number, remaining: number): BudgetWarning | null {
  if (!Number.isFinite(remaining) || requested <= remaining) return null;
  return { requested, remaining, willWait: requested - remaining };
}

/**
 * How long to pause the queue after a 429. Prefers the server's own reset time;
 * falls back to exponential backoff keyed on how many times THIS job has been
 * rate-limited in a row.
 */
export function computeResumeDelayMs(input: {
  rateLimitHits: number; // >= 1, counted after the current hit
  resetAtMs: number | null;
  now: number;
}): number {
  const { rateLimitHits, resetAtMs, now } = input;
  if (resetAtMs !== null && resetAtMs > now) {
    return resetAtMs - now + RESUME_PADDING_MS;
  }
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, rateLimitHits - 1), MAX_BACKOFF_MS);
}

/** Matches `hasOwnApiKey` in server.ts exactly — such users bypass the limiter entirely. */
export function isBudgetExempt(aiConfig: { apiKey?: string } | null | undefined): boolean {
  return Boolean(aiConfig?.apiKey && aiConfig.apiKey.trim() !== '');
}
