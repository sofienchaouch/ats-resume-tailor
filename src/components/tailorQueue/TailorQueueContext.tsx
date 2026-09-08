import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AiConfig, HistoryEntry, ResumeData, TailorResponse } from '../../types';
import { apiFetch, ApiRequestError, isAbortError } from '../../utils/apiClient';
import {
  initialQueueState,
  isQueueActive,
  queueReducer,
  selectItem,
  selectNextRunnable,
  selectSucceeded,
  type QueueJobInput,
  type TailorQueueItem,
  type TailorQueueState,
} from '../../utils/tailorQueue';
import { buildHistoryEntry, nextHistoryId } from '../../utils/tailorHistoryEntries';
import {
  createLedger,
  recordSpend,
  reconcile,
  remainingCalls,
  windowResetAtMs,
  computeResumeDelayMs,
  isBudgetExempt,
  MAX_RATE_LIMIT_RETRIES,
  type RateLimitSnapshot,
  type SpendLedger,
} from '../../utils/rateBudget';

/** Per-device, survives reload so the budget estimate isn't reset to full. */
const LEDGER_KEY = 'ats_expensive_call_ledger';

function loadLedger(): SpendLedger {
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    if (!raw) return createLedger();
    const parsed = JSON.parse(raw);
    return {
      spends: Array.isArray(parsed?.spends) ? parsed.spends.filter((n: unknown) => typeof n === 'number') : [],
      serverRemaining: typeof parsed?.serverRemaining === 'number' ? parsed.serverRemaining : null,
      serverResetAtMs: typeof parsed?.serverResetAtMs === 'number' ? parsed.serverResetAtMs : null,
    };
  } catch {
    return createLedger();
  }
}

function saveLedger(ledger: SpendLedger): void {
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    /* private mode / quota — the estimate just won't persist */
  }
}

/**
 * App.tsx registers this every render (see `useRegisterTailorQueueConfig`) so
 * the runner always has current master resume / model / history. Kept in a ref,
 * never a dependency — the runner must not restart when the config identity
 * changes.
 */
export interface TailorRunConfig {
  masterResume: ResumeData;
  aiConfig: AiConfig | null;
  selectedModel: string;
  targetLanguage: 'en' | 'fr';
  optimizeForRelocation: boolean;
  existingHistory: HistoryEntry[];
  onRunSucceeded: (item: TailorQueueItem, entry: HistoryEntry) => void;
  onOpenRun: (item: TailorQueueItem) => void;
  /**
   * Fired once the queue goes idle, with the runs that succeeded since the last
   * drain. Used to fold the batch into the Application Tracker in one write.
   */
  onQueueDrained?: (succeeded: TailorQueueItem[]) => void;
}

export interface QueueBudget {
  /** Remaining expensive AI calls in the current window; Infinity when exempt. */
  remaining: number;
  resetAtMs: number | null;
  /** BYO-key users bypass the server limiter entirely. */
  exempt: boolean;
}

interface TailorQueueContextValue {
  state: TailorQueueState;
  budget: QueueBudget;
  enqueue: (jobs: QueueJobInput[], origin: 'quick' | 'batch') => void;
  retry: (jobId: string) => void;
  remove: (jobId: string) => void;
  clearFinished: () => void;
  resume: () => void;
  openRun: (jobId: string) => void;
  /** Record one expensive AI call that happened outside the queue (e.g. deep search). */
  recordExpensiveCall: () => void;
  /** Feed the server's rate-limit headers back in — pass to `apiFetch`'s `onRateLimitInfo`. */
  noteRateLimit: (snapshot: RateLimitSnapshot) => void;
}

const QueueContext = createContext<TailorQueueContextValue | null>(null);
const RegisterConfigContext = createContext<((cfg: TailorRunConfig) => void) | null>(null);

export function TailorQueueProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(queueReducer, initialQueueState);
  const [ledger, setLedger] = useState<SpendLedger>(loadLedger);
  const [exempt, setExempt] = useState(false);
  const [budget, setBudget] = useState<QueueBudget>({ remaining: Infinity, resetAtMs: null, exempt: false });

  const configRef = useRef<TailorRunConfig | null>(null);
  const stateRef = useRef(state);
  // Latest ledger, readable synchronously from inside the async runner.
  const ledgerRef = useRef(ledger);
  // Guards the drain effect against React StrictMode's double invocation — two
  // synchronous effect runs must not fire two /api/tailor calls for one job.
  const inFlightRef = useRef<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
    ledgerRef.current = ledger;
  });

  const registerConfig = useCallback((cfg: TailorRunConfig) => {
    configRef.current = cfg;
    setExempt(isBudgetExempt(cfg.aiConfig));
  }, []);

  // Recompute the visible budget when the ledger changes, and on a slow tick so
  // aged-out spends refill it without a user action. Kept out of render.
  useEffect(() => {
    const recompute = () => {
      const now = Date.now();
      setBudget({
        exempt,
        remaining: exempt ? Infinity : remainingCalls(ledger, now),
        resetAtMs: windowResetAtMs(ledger, now),
      });
    };
    recompute();
    const id = setInterval(recompute, 30_000);
    return () => clearInterval(id);
  }, [ledger, exempt]);

  const updateLedger = useCallback((fn: (l: SpendLedger) => SpendLedger) => {
    const next = fn(ledgerRef.current);
    ledgerRef.current = next; // keep the runner's synchronous read current
    saveLedger(next);
    setLedger(next);
  }, []);

  // Drain loop: pick the next runnable job, run it, repeat. One at a time.
  useEffect(() => {
    const next = selectNextRunnable(state, Date.now());
    if (!next) return;
    if (inFlightRef.current) return;
    const cfg = configRef.current;
    if (!cfg) return;

    inFlightRef.current = next.jobId;
    const controller = new AbortController();
    dispatch({ type: 'start', jobId: next.jobId });

    void (async () => {
      try {
        const data = await apiFetch<TailorResponse>(
          '/api/tailor',
          {
            masterResume: cfg.masterResume,
            jobDescription: next.job.description || '',
            jobUrl: next.job.url || '',
            language: cfg.targetLanguage,
            optimizeForRelocation: cfg.optimizeForRelocation,
            model: cfg.selectedModel,
            aiConfig: cfg.aiConfig,
          },
          {
            apiKey: cfg.aiConfig?.apiKey,
            signal: controller.signal,
            onRateLimitInfo: (snap) => updateLedger((l) => reconcile(l, snap, Date.now())),
          }
        );
        updateLedger((l) => recordSpend(l, Date.now()));
        const id = nextHistoryId(cfg.existingHistory, Date.now());
        const entry = buildHistoryEntry(next.job, data, id, new Date());
        dispatch({ type: 'succeed', jobId: next.jobId, result: data, historyId: id });
        cfg.onRunSucceeded({ ...next, status: 'done', result: data, historyId: id }, entry);
      } catch (err) {
        if (isAbortError(err)) return;
        const e = err as ApiRequestError;
        if (e?.statusCode === 429 || e?.code === 'RATE_LIMITED') {
          const hits = next.rateLimitHits + 1;
          if (hits >= MAX_RATE_LIMIT_RETRIES) {
            dispatch({
              type: 'fail',
              jobId: next.jobId,
              error: { message: 'Rate limited too many times — try again later.', code: 'RATE_LIMITED' },
            });
          } else {
            const now = Date.now();
            const delay = computeResumeDelayMs({
              rateLimitHits: hits,
              resetAtMs: ledgerRef.current.serverResetAtMs,
              now,
            });
            dispatch({ type: 'rateLimited', jobId: next.jobId, resumeAtMs: now + delay });
          }
        } else {
          dispatch({
            type: 'fail',
            jobId: next.jobId,
            error: { message: e?.message || 'Tailoring failed.', code: e?.code || 'UNKNOWN_ERROR' },
          });
        }
      } finally {
        inFlightRef.current = null;
      }
    })();
    // No cleanup abort: the effect re-runs on every state change (including our
    // own `start` dispatch), and tearing down the request each time would kill
    // the run we just launched. A `remove` is handled by the reducer ignoring a
    // late succeed/fail for a dropped id.
  }, [state, updateLedger]);

  // Auto-resume after a rate-limit pause. A timer covers the common case; the
  // focus/visibility listener covers a backgrounded tab whose timers were
  // throttled past the resume moment.
  useEffect(() => {
    if (state.pausedUntilMs === null) return;
    const fireIfDue = () => {
      if (stateRef.current.pausedUntilMs !== null && Date.now() >= stateRef.current.pausedUntilMs) {
        dispatch({ type: 'resume' });
      }
    };
    const timer = setTimeout(() => dispatch({ type: 'resume' }), Math.max(0, state.pausedUntilMs - Date.now()));
    window.addEventListener('focus', fireIfDue);
    document.addEventListener('visibilitychange', fireIfDue);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', fireIfDue);
      document.removeEventListener('visibilitychange', fireIfDue);
    };
  }, [state.pausedUntilMs]);

  // Fire onQueueDrained when the queue transitions active -> idle, passing only
  // the runs that succeeded since the previous drain (so re-enqueueing doesn't
  // re-report already-tracked jobs).
  const wasActiveRef = useRef(false);
  const reportedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const active = isQueueActive(state);
    if (wasActiveRef.current && !active) {
      const fresh = selectSucceeded(state).filter((it) => !reportedRef.current.has(it.jobId));
      if (fresh.length > 0) {
        fresh.forEach((it) => reportedRef.current.add(it.jobId));
        configRef.current?.onQueueDrained?.(fresh);
      }
    }
    wasActiveRef.current = active;
  }, [state]);

  // Warn before a reload/close would drop an in-progress queue.
  useEffect(() => {
    if (!isQueueActive(state)) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state]);

  const value = useMemo<TailorQueueContextValue>(() => {
    return {
      state,
      budget,
      enqueue: (jobs, origin) => dispatch({ type: 'enqueue', jobs, origin, now: Date.now() }),
      retry: (jobId) => dispatch({ type: 'retry', jobId, now: Date.now() }),
      remove: (jobId) => dispatch({ type: 'remove', jobId }),
      clearFinished: () => dispatch({ type: 'clearFinished' }),
      resume: () => dispatch({ type: 'resume' }),
      openRun: (jobId) => {
        const item = selectItem(stateRef.current, jobId);
        if (item) configRef.current?.onOpenRun(item);
      },
      recordExpensiveCall: () => updateLedger((l) => recordSpend(l, Date.now())),
      noteRateLimit: (snap) => updateLedger((l) => reconcile(l, snap, Date.now())),
    };
  }, [state, budget, updateLedger]);

  return (
    <RegisterConfigContext.Provider value={registerConfig}>
      <QueueContext.Provider value={value}>{children}</QueueContext.Provider>
    </RegisterConfigContext.Provider>
  );
}

export function useTailorQueue(): TailorQueueContextValue {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useTailorQueue must be used within <TailorQueueProvider>');
  return ctx;
}

/** App.tsx calls this once; it keeps the runner's config ref current every render. */
export function useRegisterTailorQueueConfig(cfg: TailorRunConfig): void {
  const register = useContext(RegisterConfigContext);
  useEffect(() => {
    register?.(cfg);
  });
}
