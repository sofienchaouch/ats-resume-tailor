import type { JobApplication } from '../components/ApplicationTracker';

// Cumulative funnel stages. 'archived' is excluded from the funnel itself
// (we don't track history, so we don't know how far an archived application
// got before closing — counting it at any stage would overclaim data we
// don't have) but its count is still surfaced separately per version.
const FUNNEL_STAGES: JobApplication['status'][] = ['saved', 'applied', 'interviewing', 'offer'];

export interface FunnelStageCount {
  stage: JobApplication['status'];
  count: number;
}

export interface VersionFunnel {
  resumeId: string;
  resumeName: string;
  total: number;
  archivedCount: number;
  stages: FunnelStageCount[];
  /** Share of applications (excluding archived) that got at least an interview. */
  responseRate: number;
}

/**
 * Groups applications by resumeId and computes a cumulative funnel per
 * version: an application currently at 'offer' counts toward saved, applied,
 * interviewing, and offer, since reaching a later stage implies passing
 * through the earlier ones.
 */
export function computeFunnelByVersion(
  applications: JobApplication[],
  versionNames: Record<string, string>
): VersionFunnel[] {
  const grouped = new Map<string, JobApplication[]>();
  for (const app of applications) {
    const key = app.resumeId || 'unknown';
    const list = grouped.get(key) || [];
    list.push(app);
    grouped.set(key, list);
  }

  const funnels: VersionFunnel[] = [];
  for (const [resumeId, apps] of grouped.entries()) {
    const active = apps.filter((a) => a.status !== 'archived');
    const archivedCount = apps.length - active.length;

    const stages: FunnelStageCount[] = FUNNEL_STAGES.map((stage) => {
      const stageIndex = FUNNEL_STAGES.indexOf(stage);
      const count = active.filter((a) => FUNNEL_STAGES.indexOf(a.status) >= stageIndex).length;
      return { stage, count };
    });

    const appliedOrLater = stages.find((s) => s.stage === 'applied')?.count || 0;
    const interviewingOrLater = stages.find((s) => s.stage === 'interviewing')?.count || 0;
    const responseRate = appliedOrLater > 0 ? Math.round((interviewingOrLater / appliedOrLater) * 100) : 0;

    funnels.push({
      resumeId,
      resumeName: versionNames[resumeId] || (resumeId === 'unknown' ? 'Unassigned' : 'Untitled Resume'),
      total: apps.length,
      archivedCount,
      stages,
      responseRate,
    });
  }

  return funnels.sort((a, b) => b.total - a.total);
}
