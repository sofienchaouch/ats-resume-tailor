import { useState, useEffect } from 'react';
import { Trophy, Plus, Copy, Trash2, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { saveAchievementBank, getAchievementBank } from '../db';
import { localDb } from '../utils/localDb';
import { useToast } from './Toast';

export interface AchievementEntry {
  id: string;
  text: string;
  category: string;
  savedAt: string;
}

const DEFAULT_CATEGORIES = ['Leadership', 'Technical', 'Process Improvement', 'Revenue Impact', 'Other'];

export default function AchievementBank() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [entries, setEntries] = useState<AchievementEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      getAchievementBank(user.uid).then((saved) => {
        if (saved) setEntries(saved as AchievementEntry[]);
      }).catch((e) => console.error('Failed to load achievement bank', e));
    } else {
      localDb.getItem<AchievementEntry[]>('ats_achievement_bank', []).then(setEntries);
    }
  }, [user]);

  const persist = (updated: AchievementEntry[]) => {
    setEntries(updated);
    if (user) {
      saveAchievementBank(user.uid, updated);
    } else {
      localDb.setItem('ats_achievement_bank', updated);
    }
  };

  const handleAdd = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    const entry: AchievementEntry = {
      id: 'ach_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      text: trimmed,
      category: newCategory,
      savedAt: new Date().toISOString(),
    };
    persist([entry, ...entries]);
    setNewText('');
    showToast('Added to your Achievement Bank.', 'success');
  };

  const handleDelete = (id: string) => {
    persist(entries.filter((e) => e.id !== id));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied — paste it into any bullet field.', 'success');
  };

  const categories = Array.from(new Set(entries.map((e) => e.category)));
  const visibleEntries = activeFilter ? entries.filter((e) => e.category === activeFilter) : entries;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden" id="achievement-bank">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        id="btn-toggle-achievement-bank"
      >
        <span className="flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-amber-500" />
          Achievement Bank {entries.length > 0 ? `(${entries.length})` : ''}
        </span>
        <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-3">
              <p className="text-[11px] text-slate-400">
                Save reusable, quantified bullet points here once — copy them into any resume version's experience bullets instead of rewriting from scratch each time.
              </p>

              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[200px]">
                  <input
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder="e.g. Led migration of 12 microservices to Kubernetes, cutting deploy time 40%"
                    className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2 py-2"
                >
                  {DEFAULT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  onClick={handleAdd}
                  disabled={!newText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Save
                </button>
              </div>

              {categories.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setActiveFilter(null)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-full cursor-pointer ${!activeFilter ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}
                  >
                    All
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c}
                      onClick={() => setActiveFilter(c)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-full cursor-pointer ${activeFilter === c ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {visibleEntries.length === 0 && (
                  <p className="text-[11px] text-slate-400 text-center py-3">No saved achievements yet.</p>
                )}
                {visibleEntries.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-2 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5">
                    <div className="min-w-0">
                      <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wide">{entry.category}</span>
                      <p className="text-xs text-slate-700 dark:text-slate-300">{entry.text}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-none">
                      <button onClick={() => handleCopy(entry.text)} className="text-slate-400 hover:text-indigo-600 cursor-pointer" title="Copy">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(entry.id)} className="text-slate-300 hover:text-red-500 cursor-pointer" title="Delete">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
