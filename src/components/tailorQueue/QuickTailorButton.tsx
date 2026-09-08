import type { MouseEvent } from 'react';
import { ArrowRight, Loader2, RotateCw, X, Zap } from 'lucide-react';
import { useTailorQueue } from './TailorQueueContext';
import { selectItem, type QueueJobInput } from '../../utils/tailorQueue';

/**
 * Per-job-card control for the tailor queue. Idempotent: clicking it queues the
 * job and the user stays in the search view. Its label reflects the queue state
 * for this specific job.
 */
export function QuickTailorButton({ job, position }: { job: QueueJobInput; position?: number }) {
  const { state, enqueue, retry, remove, openRun } = useTailorQueue();
  const item = selectItem(state, job.id);
  const status = item?.status;

  const stop = (e: MouseEvent) => e.stopPropagation();

  if (!status) {
    return (
      <button
        type="button"
        onClick={(e) => { stop(e); enqueue([job], 'quick'); }}
        className="text-[10px] font-bold px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 flex items-center gap-1 cursor-pointer"
        title="Tailor your resume for this job (runs in the background)"
      >
        <Zap className="w-3 h-3" /> Quick Tailor
      </button>
    );
  }

  if (status === 'queued') {
    return (
      <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1">
        Queued{typeof position === 'number' ? ` · #${position}` : ''}
        <button
          type="button"
          onClick={(e) => { stop(e); remove(job.id); }}
          className="hover:text-rose-600 cursor-pointer"
          title="Remove from queue"
        >
          <X className="w-3 h-3" />
        </button>
      </span>
    );
  }

  if (status === 'running') {
    return (
      <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> Tailoring…
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span className="flex items-center gap-1" title={item?.error?.message}>
        <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 max-w-[160px] truncate">
          Failed: {item?.error?.message || 'error'}
        </span>
        <button
          type="button"
          onClick={(e) => { stop(e); retry(job.id); }}
          className="text-[10px] font-bold px-1.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 flex items-center gap-1 cursor-pointer"
        >
          <RotateCw className="w-3 h-3" /> Retry
        </button>
      </span>
    );
  }

  // done
  const before = item?.result?.atsScoreBefore;
  const after = item?.result?.atsScoreAfter;
  return (
    <span className="flex items-center gap-1">
      <span className="text-[10px] font-extrabold px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
        ATS {before ?? '–'} → {after ?? '–'}
      </span>
      <button
        type="button"
        onClick={(e) => { stop(e); openRun(job.id); }}
        className="text-[10px] font-bold px-1.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 cursor-pointer"
      >
        Open <ArrowRight className="w-3 h-3" />
      </button>
    </span>
  );
}
