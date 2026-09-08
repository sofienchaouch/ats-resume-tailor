import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, Loader2, RotateCw } from 'lucide-react';
import { useTailorQueue } from './TailorQueueContext';
import { selectQueueSummary } from '../../utils/tailorQueue';

/**
 * Collapsible panel under the queue bar in the search view. Lists every run in
 * the current queue with its ATS delta and per-row actions. Reads the queue, not
 * `searchResults`, so it survives Clear Results.
 */
export function TailorResultsTray() {
  const { state, retry, openRun, clearFinished } = useTailorQueue();
  const summary = selectQueueSummary(state);
  const [open, setOpen] = useState(false);
  const autoExpanded = useRef(false);

  // Auto-expand the first time a run finishes.
  useEffect(() => {
    if (!autoExpanded.current && summary.done > 0) {
      autoExpanded.current = true;
      setOpen(true);
    }
  }, [summary.done]);

  if (state.items.length === 0) return null;

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900/60 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
      >
        <span className="flex items-center gap-1.5">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          Tailoring results ({summary.done}/{summary.total})
        </span>
        {(summary.done > 0 || summary.failed > 0) && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); clearFinished(); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); clearFinished(); } }}
            className="text-[10px] font-semibold text-slate-500 hover:text-slate-700"
          >
            Clear finished
          </span>
        )}
      </button>

      {open && (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[220px] overflow-y-auto">
          {state.items.map((item) => {
            const before = item.result?.atsScoreBefore;
            const after = item.result?.atsScoreAfter;
            return (
              <li key={item.jobId} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                    {item.job.title || 'Tailored resume'}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {item.job.company || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />}
                  {item.status === 'queued' && <span className="text-[10px] text-slate-400">queued</span>}
                  {item.status === 'done' && (
                    <>
                      <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                        {before ?? '–'} → {after ?? '–'}
                      </span>
                      <button
                        type="button"
                        onClick={() => openRun(item.jobId)}
                        className="text-[10px] font-bold px-1.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 cursor-pointer"
                      >
                        Open <ArrowRight className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  {item.status === 'failed' && (
                    <>
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 max-w-[120px] truncate" title={item.error?.message}>
                        {item.error?.message || 'failed'}
                      </span>
                      <button
                        type="button"
                        onClick={() => retry(item.jobId)}
                        className="text-[10px] font-bold px-1.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCw className="w-3 h-3" /> Retry
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
