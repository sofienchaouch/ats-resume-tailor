import { Loader2, Zap } from 'lucide-react';
import { useTailorQueue } from './TailorQueueContext';
import { selectQueueSummary } from '../../utils/tailorQueue';

/**
 * Header chip so an in-flight queue stays visible from any view (the results
 * tray only lives in the search view). Clicking it returns to search.
 */
export function TailorQueueNavChip({ onOpen }: { onOpen: () => void }) {
  const { state } = useTailorQueue();
  const summary = selectQueueSummary(state);
  const active = summary.queued + summary.running;
  if (active === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900 cursor-pointer"
      title="Tailoring in progress — go to search"
    >
      {summary.running > 0 ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
      {summary.done}/{summary.total}
    </button>
  );
}
