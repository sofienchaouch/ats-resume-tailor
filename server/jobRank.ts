import type { ResumeData } from "../src/types";
import { buildKeywordMatches, keywordCoverageScore, resumeToSearchableText } from "./scoring";

/**
 * A job posting after normalization by any source adapter. Field names mirror
 * the /api/jobs-deep-search response the client already renders, plus the
 * enrichment fields the v2 pipeline adds.
 */
export interface NormalizedJob {
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  source: string;
  relocationOffered: boolean;
  visaSupport: string;
  postedAt?: string;
  salary?: string;
  /** 0–100 keyword-overlap score against the master resume; set by rankJobs. */
  fitScore?: number;
  /** URL responded to a HEAD/GET check; set by the route. */
  verified?: boolean;
  /** company+title already present in the user's application tracker. */
  alreadyTracked?: boolean;
}

/** Lowercase, strip punctuation, collapse whitespace — for fuzzy key comparison. */
function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** host + pathname only, so tracking params / trailing slashes don't split dupes. */
function urlKey(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.host}${u.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return norm(raw);
  }
}

/**
 * Collapse duplicates that came from different sources. Two jobs are the same
 * when their URLs point to the same host+path, OR their company AND title match
 * after normalization. The first occurrence wins but inherits a truthy
 * relocationOffered / non-empty visaSupport / longer description from any dupe.
 */
export function dedupeJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const byUrl = new Map<string, NormalizedJob>();
  const byCompanyTitle = new Map<string, NormalizedJob>();
  const out: NormalizedJob[] = [];

  for (const job of jobs) {
    const uk = job.url ? urlKey(job.url) : "";
    const ctk = `${norm(job.company)}::${norm(job.title)}`;
    const existing =
      (uk && byUrl.get(uk)) || (norm(job.company) && norm(job.title) ? byCompanyTitle.get(ctk) : undefined);

    if (existing) {
      existing.relocationOffered = existing.relocationOffered || job.relocationOffered;
      if (!existing.visaSupport && job.visaSupport) existing.visaSupport = job.visaSupport;
      if ((job.description || "").length > (existing.description || "").length) {
        existing.description = job.description;
      }
      if (!existing.salary && job.salary) existing.salary = job.salary;
      if (!existing.postedAt && job.postedAt) existing.postedAt = job.postedAt;
      if (!existing.source.includes(job.source)) existing.source = `${existing.source}, ${job.source}`;
      continue;
    }

    out.push(job);
    if (uk) byUrl.set(uk, job);
    if (norm(job.company) && norm(job.title)) byCompanyTitle.set(ctk, job);
  }
  return out;
}

/**
 * Score each job's description against the master resume using the same
 * deterministic keyword engine the ATS dashboard uses, then sort best-fit
 * first. Jobs with no usable description keep fitScore undefined and sort last.
 */
export function rankJobs(jobs: NormalizedJob[], masterResume?: ResumeData): NormalizedJob[] {
  const resumeText = masterResume ? resumeToSearchableText(masterResume).toLowerCase() : "";
  const resumeTerms = masterResume
    ? new Set(
        [
          ...(masterResume.contact?.title || "").toLowerCase().split(/[^a-z0-9+#.]+/),
          ...masterResume.skills.flatMap((c) => c.items.map((i) => i.toLowerCase())),
        ].filter((t) => t && t.length > 1),
      )
    : new Set<string>();

  const scored = jobs.map((job) => {
    if (!masterResume || !job.description || job.description.trim().length < 40) {
      return { ...job, fitScore: undefined };
    }
    // (a) how many of the job's demanded keywords the resume covers
    const keywords = buildKeywordMatches(job.description, masterResume, masterResume);
    const coverage = keywordCoverageScore(keywords, "matchesInMaster");
    // (b) how many of the resume's own skills/title words the job asks for
    const jobText = `${job.title} ${job.description}`.toLowerCase();
    let hit = 0;
    for (const t of resumeTerms) if (jobText.includes(t)) hit++;
    const skillMatch = resumeTerms.size ? Math.round((hit / resumeTerms.size) * 100) : coverage;
    // (c) title alignment — a strong signal boards give reliably
    const titleWords = job.title.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 2);
    const titleHit = titleWords.filter((w) => resumeText.includes(w)).length;
    const titleMatch = titleWords.length ? Math.round((titleHit / titleWords.length) * 100) : 0;

    const fitScore = Math.round(coverage * 0.35 + skillMatch * 0.4 + titleMatch * 0.25);
    return { ...job, fitScore };
  });

  return scored.sort((a, b) => {
    if (a.fitScore == null && b.fitScore == null) return 0;
    if (a.fitScore == null) return 1;
    if (b.fitScore == null) return -1;
    return b.fitScore - a.fitScore;
  });
}

/** "company::title" keys for the tracker cross-check. */
export function trackedKeySet(pairs: string[] | undefined): Set<string> {
  const set = new Set<string>();
  for (const p of pairs || []) {
    const [company, title] = String(p).split("::");
    if (company && title) set.add(`${norm(company)}::${norm(title)}`);
  }
  return set;
}

export function markTracked(jobs: NormalizedJob[], tracked: Set<string>): NormalizedJob[] {
  if (tracked.size === 0) return jobs;
  return jobs.map((job) => ({
    ...job,
    alreadyTracked: tracked.has(`${norm(job.company)}::${norm(job.title)}`),
  }));
}
