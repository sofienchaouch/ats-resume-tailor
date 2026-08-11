import { BarChart3, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { JobApplication } from './ApplicationTracker';
import { computeFunnelByVersion } from '../utils/funnel';

interface FunnelAnalyticsProps {
  applications: JobApplication[];
  versionNames: Record<string, string>;
}

const STAGE_LABELS: Record<JobApplication['status'], string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  archived: 'Archived',
};

export default function FunnelAnalytics({ applications, versionNames }: FunnelAnalyticsProps) {
  const funnels = computeFunnelByVersion(applications, versionNames);

  if (applications.length === 0) {
    return null;
  }

  const chartData = funnels[0]?.stages.map((s) => ({ stage: STAGE_LABELS[s.stage] })) || [];
  for (const funnel of funnels) {
    funnel.stages.forEach((s, i) => {
      (chartData[i] as any)[funnel.resumeName] = s.count;
    });
  }

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4" id="funnel-analytics">
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
        <BarChart3 className="w-4.5 h-4.5 text-indigo-500" />
        Application Funnel {funnels.length > 1 ? 'by Resume Version' : ''}
      </h3>

      {funnels.length > 1 && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {funnels.map((f, i) => (
                <Bar key={f.resumeId} dataKey={f.resumeName} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {funnels.map((funnel) => (
          <div key={funnel.resumeId} className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{funnel.resumeName}</span>
              <span className="text-[10px] font-bold text-slate-400">{funnel.total} total</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              {funnel.stages.map((s) => (
                <div key={s.stage} className="flex-1 text-center">
                  <div className="font-bold text-slate-800 dark:text-slate-200">{s.count}</div>
                  <div className="text-slate-400">{STAGE_LABELS[s.stage]}</div>
                </div>
              ))}
            </div>
            {funnel.stages.some((s) => s.count > 0 && s.stage === 'applied') && (
              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 pt-1 border-t border-slate-100 dark:border-slate-800">
                <TrendingUp className="w-3 h-3" />
                {funnel.responseRate}% response rate
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
