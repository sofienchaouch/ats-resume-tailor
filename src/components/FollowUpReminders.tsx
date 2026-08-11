import { Bell, Copy, Mail } from 'lucide-react';
import { JobApplication } from './ApplicationTracker';
import { getStaleApplications, getDaysSinceUpdate, buildFollowUpDraft } from '../utils/followUp';
import { useToast } from './Toast';

interface FollowUpRemindersProps {
  applications: JobApplication[];
  senderName?: string;
}

export default function FollowUpReminders({ applications, senderName }: FollowUpRemindersProps) {
  const { showToast } = useToast();
  const staleApps = getStaleApplications(applications);

  if (staleApps.length === 0) {
    return null;
  }

  const handleCopyDraft = (app: JobApplication) => {
    const draft = buildFollowUpDraft(app, senderName);
    navigator.clipboard.writeText(draft);
    showToast(`Follow-up draft for ${app.company} copied to clipboard.`, 'success');
  };

  const handleEmailDraft = (app: JobApplication) => {
    const draft = buildFollowUpDraft(app, senderName);
    const [subjectLine, ...bodyLines] = draft.split('\n');
    const subject = subjectLine.replace(/^Subject:\s*/, '');
    const body = bodyLines.join('\n').trim();
    const mailto = `mailto:${app.contactEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 space-y-3" id="follow-up-reminders">
      <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
        <Bell className="w-4 h-4" />
        {staleApps.length} application{staleApps.length !== 1 ? 's' : ''} could use a follow-up
      </h3>
      <div className="space-y-2">
        {staleApps.map((app) => (
          <div key={app.id} className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/40 rounded-xl p-3">
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                {app.title} at {app.company}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                Applied {getDaysSinceUpdate(app)} days ago, no response yet
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-none">
              <button
                onClick={() => handleCopyDraft(app)}
                className="flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                title="Copy a drafted follow-up email to clipboard"
              >
                <Copy className="w-3 h-3" />
                Copy Draft
              </button>
              <button
                onClick={() => handleEmailDraft(app)}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-900/50 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                title="Open in your email client"
              >
                <Mail className="w-3 h-3" />
                Email
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
