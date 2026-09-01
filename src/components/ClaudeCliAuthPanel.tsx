import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, LogIn, RefreshCw, Terminal } from 'lucide-react';

interface ClaudeCliStatus {
  installed: boolean;
  loggedIn: boolean;
  healthy: boolean;
  email?: string | null;
  subscriptionType?: string | null;
  authMethod?: string | null;
  reason?: string | null;
}

/**
 * Account panel for the claude-cli provider.
 *
 * The CLI owns its own OAuth flow, so signing in means handing the CLI a real
 * terminal and letting the developer finish in their browser. This panel only
 * reports state and starts that flow -- no Anthropic credential is ever typed
 * into, stored by, or passed through this app.
 */
export default function ClaudeCliAuthPanel() {
  const [status, setStatus] = useState<ClaudeCliStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [awaitingLogin, setAwaitingLogin] = useState(false);
  const [manualCommand, setManualCommand] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  // Deliberately does NOT flip `checking` on the way in: the mount effect must
  // not call setState synchronously in its body, and `checking` already starts
  // true. Callers that re-run it on demand set the flag themselves.
  // Pure fetch: returns the status or null, records only the error message.
  const fetchStatus = useCallback(async (): Promise<ClaudeCliStatus | null> => {
    try {
      const res = await fetch('/api/claude-cli/status');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Status check failed (${res.status})`);
      }
      return (await res.json()) as ClaudeCliStatus;
    } catch (e: any) {
      setError(e?.message || 'Could not reach the status endpoint.');
      return null;
    }
  }, []);

  const checkStatus = useCallback(async (): Promise<ClaudeCliStatus | null> => {
    const data = await fetchStatus();
    if (data) setStatus(data);
    setChecking(false);
    return data;
  }, [fetchStatus]);

  useEffect(() => {
    // Awaited before the first setState so the effect body itself stays
    // synchronous-state-free (react-hooks/set-state-in-effect).
    let cancelled = false;
    (async () => {
      const data = await fetchStatus();
      if (cancelled) return;
      if (data) setStatus(data);
      setChecking(false);
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [fetchStatus]);

  // While the login terminal is open, poll until the CLI reports a working
  // session. Give up after 5 minutes so this never polls forever.
  const startPolling = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    const startedAt = Date.now();
    pollRef.current = window.setInterval(async () => {
      if (Date.now() - startedAt > 5 * 60 * 1000) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
        setAwaitingLogin(false);
        return;
      }
      const data = await checkStatus();
      if (data?.healthy) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
        setAwaitingLogin(false);
      }
    }, 4000);
  }, [checkStatus]);

  const handleLogin = async () => {
    setError(null);
    setManualCommand(null);
    try {
      const res = await fetch('/api/claude-cli/login', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Could not start login (${res.status})`);
      setManualCommand(data.manualCommand || 'claude auth login');
      if (data.launched) {
        setAwaitingLogin(true);
        startPolling();
      } else {
        setError(data.error || 'Could not open a terminal window automatically.');
      }
    } catch (e: any) {
      setError(e?.message || 'Could not start the login flow.');
      setManualCommand('claude auth login');
    }
  };

  const healthy = status?.healthy === true;
  const notInstalled = status?.installed === false;
  // Until the first result lands we do not know whether a sign-in is needed,
  // so don't flash a "Sign in" button at someone who is already connected.
  const settled = status !== null;

  return (
    <div
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3 space-y-2.5"
      id="claude-cli-auth-panel"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-indigo-500" />
          Claude Code CLI account
        </span>
        <button
          type="button"
          onClick={() => { setChecking(true); setError(null); checkStatus(); }}
          disabled={checking}
          className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 disabled:opacity-50 cursor-pointer"
          aria-label="Recheck Claude Code CLI status"
        >
          <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
          Recheck
        </button>
      </div>

      <div className="text-[11px] leading-relaxed" aria-live="polite">
        {checking && !status && (
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-semibold">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking CLI session (runs a live test request, ~20s)...
          </span>
        )}

        {status && healthy && (
          <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Connected{status.email ? ` as ${status.email}` : ''}
            {status.subscriptionType ? ` (${status.subscriptionType})` : ''}
          </span>
        )}

        {status && !healthy && (
          <div className="space-y-1">
            <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              {notInstalled
                ? 'Claude Code CLI not found'
                : status.loggedIn
                ? 'Session expired — sign in again'
                : 'Not signed in'}
            </span>
            {status.reason && (
              <p className="text-slate-500 dark:text-slate-400 break-words">{status.reason}</p>
            )}
          </div>
        )}
      </div>

      {awaitingLogin && (
        <p className="text-[11px] text-indigo-700 dark:text-indigo-400 font-semibold flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Finish signing in in the terminal window that opened, then your browser.
        </p>
      )}

      {error && <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold break-words">{error}</p>}

      {settled && !healthy && !notInstalled && (
        <button
          type="button"
          onClick={handleLogin}
          disabled={awaitingLogin}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-[11px] font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <LogIn className="w-3.5 h-3.5" />
          {awaitingLogin ? 'Waiting for sign-in...' : 'Sign in to Claude Code CLI'}
        </button>
      )}

      {notInstalled && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Install it first, then click Recheck.
        </p>
      )}

      {manualCommand && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          Or run it yourself:{' '}
          <code className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-800 dark:text-slate-200">
            {manualCommand}
          </code>
        </p>
      )}
    </div>
  );
}
