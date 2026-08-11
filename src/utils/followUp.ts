import type { JobApplication } from '../components/ApplicationTracker';

const STALE_THRESHOLD_DAYS = 7;

function daysSince(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return 0;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

/**
 * Applications sitting in 'applied' with no status change in
 * STALE_THRESHOLD_DAYS+ days — a real signal worth a follow-up, since a
 * status change (interviewing/offer/archived) means something already
 * happened and a nudge would be noise.
 */
export function getStaleApplications(applications: JobApplication[], thresholdDays = STALE_THRESHOLD_DAYS): JobApplication[] {
  return applications
    .filter((app) => app.status === 'applied' && daysSince(app.dateUpdated) >= thresholdDays)
    .sort((a, b) => daysSince(b.dateUpdated) - daysSince(a.dateUpdated));
}

export function getDaysSinceUpdate(app: JobApplication): number {
  return daysSince(app.dateUpdated);
}

/** Canned, editable follow-up draft — not AI-generated, just a solid professional default. */
export function buildFollowUpDraft(app: JobApplication, senderName = ''): string {
  const days = daysSince(app.dateUpdated);
  return `Subject: Following up on my application for ${app.title}

Dear Hiring Team,

I hope you're doing well. I wanted to follow up on my application for the ${app.title} position at ${app.company}, submitted ${days} day${days === 1 ? '' : 's'} ago. I remain very interested in the opportunity and would welcome the chance to discuss how my background could contribute to your team.

Please let me know if there's any additional information I can provide. I look forward to hearing from you.

Best regards,
${senderName || '[Your Name]'}`;
}
