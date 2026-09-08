import { useEffect, useState } from 'react';
import { Download, Loader2, Sparkles } from 'lucide-react';
import { useTailorQueue } from './TailorQueueContext';
import { selectQueueSummary, type QueueJobInput } from '../../utils/tailorQueue';
import { budgetWarning } from '../../utils/rateBudget';
import { buildBatchZipPlan } from '../../utils/exportBatch';
import { buildResumeDocxBlob, downloadBlob } from '../../utils/resumeDocx';
import { buildZip } from '../../utils/zipStore';
import { batchZipFileName } from '../../utils/resumeFileName';

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTime(epochMs: number): string {
  try {
    return new Date(epochMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * The bar above the search results list. Merges the old "batch tailoring"
 * selection bar with live queue progress, budget, and rate-limit backoff state.
 */
export function TailorQueueBar({
  selectedJobs,
  onCleared,
}: {
  /** Jobs currently checkbox-selected in the results list. */
  selectedJobs: QueueJobInput[];
  /** Called after a batch enqueue so the list can clear its checkboxes. */
  onCleared: () => void;
}) {
  const { state, budget, enqueue, clearFinished, resume } = useTailorQueue();
  const summary = selectQueueSummary(state);
  const active = summary.queued + summary.running;
  const paused = state.pausedUntilMs !== null;
  const [zipping, setZipping] = useState(false);

  const downloadAllDocx = async () => {
    const plan = buildBatchZipPlan(state.items);
    if (plan.length === 0) return;
    setZipping(true);
    try {
      const entries = [];
      for (const file of plan) {
        const blob = await buildResumeDocxBlob(file.resume);
        entries.push({ name: file.fileName, data: new Uint8Array(await blob.arrayBuffer()) });
      }
      const zip = buildZip(entries);
      downloadBlob(new Blob([zip], { type: 'application/zip' }), batchZipFileName(new Date()));
    } catch (err) {
      console.error('Bulk DOCX export failed', err);
    } finally {
      setZipping(false);
    }
  };

  // 1Hz clock, only while a countdown is on screen.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!paused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [paused]);

  if (selectedJobs.length === 0 && summary.total === 0) return null;

  const runBatch = () => {
    if (selectedJobs.length === 0) return;
    enqueue(selectedJobs, 'batch');
    onCleared();
  };

  const warn = budgetWarning(selectedJobs.length, budget.remaining);
  const pauseRemainingMs = paused ? state.pausedUntilMs! - now : 0;

  return (
    <div className="flex flex-col gap-1.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
            {active > 0
              ? `Tailoring — ${summary.running} running, ${summary.queued} queued`
              : `${selectedJobs.length} job${selectedJobs.length !== 1 ? 's' : ''} selected`}
            {summary.done > 0 ? ` · ${summary.done} done` : ''}
            {summary.failed > 0 ? ` · ${summary.failed} failed` : ''}
          </span>
          {!budget.exempt && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {budget.remaining} AI call{budget.remaining === 1 ? '' : 's'} left
              {budget.resetAtMs ? ` · resets ${formatTime(budget.resetAtMs)}` : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {summary.done > 0 && (
            <button
              type="button"
              onClick={downloadAllDocx}
              disabled={zipping}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 flex items-center gap-1 cursor-pointer"
            >
              {zipping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              All DOCX (.zip)
            </button>
          )}
          {(summary.done > 0 || summary.failed > 0) && (
            <button
              type="button"
              onClick={clearFinished}
              className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Clear finished
            </button>
          )}
          <button
            type="button"
            onClick={runBatch}
            disabled={selectedJobs.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
          >
            {active > 0 ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Tailor Selected
          </button>
        </div>
      </div>

      {paused && (
        <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
          <span>Rate limited — resuming in {formatClock(pauseRemainingMs)}</span>
          <button type="button" onClick={resume} className="hover:underline cursor-pointer">
            Resume now
          </button>
        </div>
      )}

      {!paused && warn && selectedJobs.length > 0 && (
        <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
          {warn.willWait} of these {warn.requested} will wait for the rate-limit window to refill.
        </span>
      )}
    </div>
  );
}
