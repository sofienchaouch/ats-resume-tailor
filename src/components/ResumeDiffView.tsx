import { AlertTriangle, ArrowRight } from 'lucide-react';
import { ResumeData, FabricationFlag, WorkExperience } from '../types';

interface ResumeDiffViewProps {
  masterResume: ResumeData;
  tailoredResume: ResumeData;
  fabricationFlags?: FabricationFlag[];
}

function normalize(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase();
}

interface MatchedExperience {
  company: string;
  master: WorkExperience | null;
  tailored: WorkExperience | null;
}

export function matchExperience(master: ResumeData, tailored: ResumeData): MatchedExperience[] {
  const masterByCompany = new Map<string, WorkExperience>();
  for (const exp of master.experience || []) {
    masterByCompany.set(normalize(exp.company), exp);
  }

  const matched: MatchedExperience[] = [];
  const seen = new Set<string>();

  for (const exp of tailored.experience || []) {
    const key = normalize(exp.company);
    seen.add(key);
    matched.push({ company: exp.company, master: masterByCompany.get(key) || null, tailored: exp });
  }
  // Entries dropped entirely from the tailored resume (rare, but worth surfacing).
  for (const exp of master.experience || []) {
    const key = normalize(exp.company);
    if (!seen.has(key)) {
      matched.push({ company: exp.company, master: exp, tailored: null });
    }
  }
  return matched;
}

function BulletDiff({ master, tailored }: { master: WorkExperience | null; tailored: WorkExperience | null }) {
  const masterBullets = master?.bullets || [];
  const tailoredBullets = tailored?.bullets || [];
  const rowCount = Math.max(masterBullets.length, tailoredBullets.length);

  return (
    <ul className="space-y-1.5">
      {Array.from({ length: rowCount }).map((_, i) => {
        const before = masterBullets[i];
        const after = tailoredBullets[i];
        const changed = before !== after;
        if (!changed) {
          return (
            <li key={i} className="text-xs text-slate-600 dark:text-slate-400 pl-3 border-l-2 border-transparent">
              {after ?? before}
            </li>
          );
        }
        return (
          <li key={i} className="text-xs pl-3 border-l-2 border-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-r py-1 pr-2 space-y-1">
            {before !== undefined && (
              <div className="text-slate-400 dark:text-slate-500 line-through decoration-slate-300">{before}</div>
            )}
            {after !== undefined && (
              <div className="text-slate-900 dark:text-slate-100 font-medium">{after}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const FABRICATION_LABEL: Record<FabricationFlag['category'], string> = {
  company: 'Employer',
  dates: 'Employment dates',
  education: 'Education',
  certification: 'Certification',
  project: 'Project',
};

export default function ResumeDiffView({ masterResume, tailoredResume, fabricationFlags = [] }: ResumeDiffViewProps) {
  const matchedExperience = matchExperience(masterResume, tailoredResume);
  const summaryChanged = (masterResume.summary || '') !== (tailoredResume.summary || '');
  const titleChanged = (masterResume.contact?.title || '') !== (tailoredResume.contact?.title || '');

  return (
    <div className="space-y-5">
      {fabricationFlags.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-xs">
            <AlertTriangle className="w-4 h-4" />
            AI added content not found in your master resume — verify or remove
          </div>
          <ul className="space-y-1">
            {fabricationFlags.map((flag, i) => (
              <li key={i} className="text-xs text-red-700 dark:text-red-300">
                <span className="font-semibold">{FABRICATION_LABEL[flag.category]}:</span> {flag.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      {titleChanged && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Title</h4>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 line-through">{masterResume.contact?.title || '(none)'}</span>
            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="font-medium text-slate-900 dark:text-slate-100">{tailoredResume.contact?.title}</span>
          </div>
        </div>
      )}

      {summaryChanged && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Summary</h4>
          <div className="text-xs text-slate-400 line-through">{masterResume.summary || '(none)'}</div>
          <div className="text-xs text-slate-900 dark:text-slate-100 font-medium">{tailoredResume.summary}</div>
        </div>
      )}

      {matchedExperience.map((entry, i) => (
        <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {entry.company}
            {!entry.master && (
              <span className="ml-2 text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full uppercase">
                Not in master resume
              </span>
            )}
            {!entry.tailored && (
              <span className="ml-2 text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full uppercase">
                Removed from tailored version
              </span>
            )}
          </h4>
          <BulletDiff master={entry.master} tailored={entry.tailored} />
        </div>
      ))}

      {!titleChanged && !summaryChanged && matchedExperience.every((e) => (e.master?.bullets || []).every((b, idx) => b === (e.tailored?.bullets || [])[idx])) && (
        <p className="text-xs text-slate-400 text-center py-6">No changes detected between the master and tailored resume.</p>
      )}
    </div>
  );
}
