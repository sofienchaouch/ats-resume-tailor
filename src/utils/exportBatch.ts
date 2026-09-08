import type { ResumeData } from '../types';
import type { TailorQueueItem } from './tailorQueue';
import { buildResumeFileBase, uniqueFileNames } from './resumeFileName';

export interface BatchZipFile {
  jobId: string;
  fileName: string; // includes ".docx"
  resume: ResumeData;
}

/**
 * Which queue runs go in the bulk zip and under what name. Only `done` items
 * with a tailored resume; names follow the `{name} - resume {role} {company}`
 * convention, disambiguated so two runs for the same role+company don't collide.
 */
export function buildBatchZipPlan(items: TailorQueueItem[]): BatchZipFile[] {
  const done = items.filter((it) => it.status === 'done' && it.result?.tailoredResume);
  const bases = uniqueFileNames(
    done.map((it) =>
      buildResumeFileBase({
        name: it.result!.tailoredResume.contact.name,
        role: it.job.title || it.result!.tailoredResume.contact.title,
        company: it.job.company,
      })
    )
  );
  return done.map((it, i) => ({
    jobId: it.jobId,
    fileName: `${bases[i]}.docx`,
    resume: it.result!.tailoredResume,
  }));
}
