import { useState } from 'react';
import { FileText, Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { ResumeVersionMeta } from '../db';

interface ResumeVersionSwitcherProps {
  versions: ResumeVersionMeta[];
  activeResumeId: string;
  isSwitching: boolean;
  onSwitch: (resumeId: string) => void;
  onCreate: (name: string) => void;
  onRename: (resumeId: string, name: string) => void;
  onDelete: (resumeId: string) => void;
}

export default function ResumeVersionSwitcher({
  versions,
  activeResumeId,
  isSwitching,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
}: ResumeVersionSwitcherProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // The primary version is always present even before the versions list has
  // loaded (or if it has no explicit entry yet), so the switcher never looks empty.
  const displayVersions =
    versions.length > 0 ? versions : [{ id: activeResumeId, name: 'Master Resume', updatedAt: 0 }];

  const submitCreate = () => {
    const trimmed = newName.trim();
    if (trimmed) {
      onCreate(trimmed);
    }
    setNewName('');
    setIsCreating(false);
  };

  const submitRename = (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      onRename(id, trimmed);
    }
    setRenamingId(null);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3" id="resume-version-switcher">
      <div className="flex flex-wrap items-center gap-2">
        {displayVersions.map((version) => {
          const isActive = version.id === activeResumeId;
          const isRenaming = renamingId === version.id;

          if (isRenaming) {
            return (
              <div key={version.id} className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitRename(version.id);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className="text-xs font-bold bg-transparent border-b border-indigo-300 outline-none w-28 text-slate-900 dark:text-slate-100"
                />
                <button onClick={() => submitRename(version.id)} className="text-emerald-600 hover:text-emerald-700 cursor-pointer" title="Save name">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setRenamingId(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer" title="Cancel">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          }

          return (
            <div
              key={version.id}
              className={`group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400'
                  : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-400 hover:border-slate-200 dark:hover:border-slate-700'
              }`}
            >
              <button
                onClick={() => onSwitch(version.id)}
                disabled={isSwitching || isActive}
                className="flex items-center gap-1.5 cursor-pointer disabled:cursor-default"
                title={isActive ? 'Currently active resume version' : `Switch to "${version.name}"`}
              >
                <FileText className="w-3.5 h-3.5" />
                {version.name}
                {isActive && isSwitching && <Loader2 className="w-3 h-3 animate-spin" />}
              </button>
              <button
                onClick={() => {
                  setRenamingId(version.id);
                  setRenameValue(version.name);
                }}
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 cursor-pointer transition-opacity"
                title="Rename version"
              >
                <Pencil className="w-3 h-3" />
              </button>
              {version.id !== 'primary' && (
                <button
                  onClick={() => {
                    if (confirm(`Delete resume version "${version.name}"? This can't be undone.`)) {
                      onDelete(version.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 cursor-pointer transition-opacity"
                  title="Delete version"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {isCreating ? (
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Backend, Data..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCreate();
                if (e.key === 'Escape') setIsCreating(false);
              }}
              className="text-xs font-bold bg-transparent border-b border-indigo-300 outline-none w-32 text-slate-900 dark:text-slate-100 placeholder:font-normal placeholder:text-slate-400"
            />
            <button onClick={submitCreate} className="text-emerald-600 hover:text-emerald-700 cursor-pointer" title="Create version">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer" title="Cancel">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-300 cursor-pointer transition-all"
            title="Create a new resume version, seeded from the current one"
          >
            <Plus className="w-3.5 h-3.5" />
            New Version
          </button>
        )}
      </div>
    </div>
  );
}
