/**
 * Exported-resume file naming, shared by the single-resume export in
 * ResumePreview and the tailor queue's bulk zip. Pure.
 */

const ILLEGAL = /[\\/?%*:|"<>]/g;

export interface ResumeFileNameParts {
  /** Candidate name; falls back to "resume". */
  name?: string;
  /** Role / job title. */
  role?: string;
  /** Target company. */
  company?: string;
}

/** `"{name} - resume {role} {company}"`, empty segments dropped, filesystem-safe. */
export function buildResumeFileBase({ name, role, company }: ResumeFileNameParts): string {
  const cleanName = (name || 'resume').trim();
  return [cleanName, '- resume', (role || '').trim(), (company || '').trim()]
    .filter(Boolean)
    .join(' ')
    .replace(ILLEGAL, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Disambiguates a list of file base names in order: repeats get " (2)", " (3)"...
 * (callers append the extension afterwards).
 */
export function uniqueFileNames(bases: string[]): string[] {
  const seen = new Map<string, number>();
  return bases.map((base) => {
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

/** `resumes-YYYY-MM-DD.zip` for a batch download. */
export function batchZipFileName(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `resumes-${y}-${m}-${d}.zip`;
}
