import type { ResumeData } from '../types';

// ~550 words is a reasonable rule-of-thumb for one printed resume page at
// standard font size/margins. This is intentionally a rough estimate, not a
// pixel-accurate layout measurement — it's meant to catch "this is clearly
// running to 3 pages" before export, not to be exact.
const WORDS_PER_PAGE = 550;

function resumeWordCount(resume: ResumeData): number {
  const parts: string[] = [resume.summary || ''];
  for (const exp of resume.experience || []) {
    parts.push(exp.company, exp.role, ...(exp.bullets || []));
  }
  for (const skill of resume.skills || []) {
    parts.push(...(skill.items || []));
  }
  for (const edu of resume.education || []) {
    parts.push(edu.institution, edu.degree);
  }
  for (const proj of resume.projects || []) {
    parts.push(proj.name, proj.description);
  }
  return parts.filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length;
}

export interface PageEstimate {
  wordCount: number;
  estimatedPages: number;
  status: 'compact' | 'ideal' | 'long';
  message: string;
}

export function estimateResumeLength(resume: ResumeData): PageEstimate {
  const wordCount = resumeWordCount(resume);
  const estimatedPages = Math.max(1, Math.ceil(wordCount / WORDS_PER_PAGE));

  let status: PageEstimate['status'];
  let message: string;
  if (wordCount < 250) {
    status = 'compact';
    message = 'Fits comfortably on one page — consider adding more detail if you have relevant experience to show.';
  } else if (estimatedPages <= 2) {
    status = 'ideal';
    message = estimatedPages === 1 ? 'Fits on one page.' : 'Fits within two pages.';
  } else {
    status = 'long';
    message = `Estimated ${estimatedPages} pages — most ATS reviewers expect one page (early career) or two (10+ years experience). Consider trimming.`;
  }

  return { wordCount, estimatedPages, status, message };
}
