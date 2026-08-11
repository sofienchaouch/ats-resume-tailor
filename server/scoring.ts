import type { ResumeData, KeywordMatch, FormattingCheck } from "../src/types";

// Deterministic ATS scoring. No AI calls, no fabricated numbers — every
// score is a function of the actual resume/job-description text, so the
// same input always produces the same output and the "before -> after"
// delta reported to the user is real.

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "for", "to", "of",
  "in", "on", "at", "by", "with", "from", "as", "is", "are", "was", "were", "be",
  "been", "being", "this", "that", "these", "those", "it", "its", "you", "your",
  "we", "our", "they", "their", "will", "would", "should", "can", "could", "may",
  "might", "must", "shall", "have", "has", "had", "do", "does", "did", "not", "no",
  "so", "than", "too", "very", "just", "about", "into", "over", "under", "up",
  "down", "out", "all", "any", "each", "other", "some", "such", "only", "own",
  "same", "more", "most", "also", "job", "role", "work", "team", "company",
  "years", "year", "experience", "requirements", "responsibilities", "including",
  "etc", "who", "what", "when", "where", "why", "how", "which", "while", "per",
  "us", "including", "strong", "ability", "candidate", "candidates", "looking",
]);

// Short technical terms that shouldn't be dropped by a length-based min filter.
const SHORT_TERM_ALLOWLIST = new Set([
  "c", "r", "go", "ai", "ml", "ui", "ux", "qa", "aws", "gcp", "sql", "css",
  "api", "cli", "b2b", "b2c", "crm", "erp", "seo", "sem", "php",
]);

const TECHNICAL_TERMS = new Set([
  "javascript", "typescript", "python", "java", "react", "angular", "vue",
  "node", "nodejs", "express", "django", "flask", "spring", "docker",
  "kubernetes", "aws", "gcp", "azure", "sql", "postgresql", "mysql", "mongodb",
  "redis", "graphql", "rest", "git", "github", "gitlab", "ci/cd", "jenkins",
  "terraform", "linux", "html", "css", "sass", "webpack", "vite", "next.js",
  "nextjs", "firebase", "kafka", "rabbitmq", "elasticsearch", "spark", "hadoop",
  "tensorflow", "pytorch", "swift", "kotlin", "golang", "rust", "c++", "c#",
  ".net", "php", "laravel", "ruby", "rails", "microservices", "devops",
  "machine learning", "deep learning", "data science", "cloud computing",
]);

const SOFT_SKILL_TERMS = new Set([
  "communication", "leadership", "teamwork", "collaboration",
  "problem-solving", "problem solving", "adaptability", "creativity",
  "time management", "critical thinking", "attention to detail",
  "interpersonal", "negotiation", "mentoring", "presentation",
  "stakeholder management", "decision-making", "decision making",
]);

function normalize(text: string): string {
  return text.toLowerCase();
}

function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOccurrences(haystack: string, term: string): number {
  const pattern = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
  const matches = haystack.match(pattern);
  return matches ? matches.length : 0;
}

interface CandidateTerm {
  term: string;
  frequency: number;
}

/** Extracts candidate keyword phrases (1-3 words) from a job description by frequency. */
function extractCandidateTerms(jobDescription: string, maxTerms = 20): CandidateTerm[] {
  const text = normalize(jobDescription).replace(/[^a-z0-9+#./\s-]/g, " ");
  const rawTokens = text.split(/\s+/).filter(Boolean);

  const isMeaningful = (word: string) =>
    word.length > 0 &&
    !STOPWORDS.has(word) &&
    (word.length >= 3 || SHORT_TERM_ALLOWLIST.has(word));

  const counts = new Map<string, number>();

  const bumpCount = (term: string) => {
    counts.set(term, (counts.get(term) || 0) + 1);
  };

  for (let i = 0; i < rawTokens.length; i++) {
    const w1 = rawTokens[i];
    if (isMeaningful(w1)) {
      bumpCount(w1);
    }
    const w2 = rawTokens[i + 1];
    if (w1 && w2 && isMeaningful(w1) && isMeaningful(w2)) {
      bumpCount(`${w1} ${w2}`);
    }
    const w3 = rawTokens[i + 2];
    if (w1 && w2 && w3 && isMeaningful(w1) && isMeaningful(w2) && isMeaningful(w3)) {
      bumpCount(`${w1} ${w2} ${w3}`);
    }
  }

  // Known technical/soft-skill terms get a frequency floor so they surface
  // even if they only appear once in the JD (a single "Kubernetes" mention
  // in a requirements list is still a hard requirement).
  for (const known of TECHNICAL_TERMS) {
    if (counts.has(known) && counts.get(known)! < 2) {
      counts.set(known, 2);
    } else if (!counts.has(known) && new RegExp(`\\b${escapeRegex(known)}\\b`, "i").test(text)) {
      counts.set(known, 2);
    }
  }
  for (const known of SOFT_SKILL_TERMS) {
    if (!counts.has(known) && new RegExp(`\\b${escapeRegex(known)}\\b`, "i").test(text)) {
      counts.set(known, 1);
    }
  }

  return Array.from(counts.entries())
    .map(([term, frequency]) => ({ term, frequency }))
    .sort((a, b) => b.frequency - a.frequency || b.term.length - a.term.length)
    .slice(0, maxTerms);
}

function classifyCategory(term: string): KeywordMatch["category"] {
  if (TECHNICAL_TERMS.has(term)) return "technical";
  if (SOFT_SKILL_TERMS.has(term)) return "soft";
  return "domain";
}

function classifyImportance(frequency: number): KeywordMatch["importance"] {
  if (frequency >= 3) return "high";
  if (frequency === 2) return "medium";
  return "low";
}

function resumeToSearchableText(resume: ResumeData): string {
  const parts: string[] = [
    resume.contact?.title || "",
    resume.summary || "",
  ];
  for (const exp of resume.experience || []) {
    parts.push(exp.company, exp.role, ...(exp.bullets || []));
  }
  for (const skill of resume.skills || []) {
    parts.push(skill.category, ...(skill.items || []));
  }
  for (const edu of resume.education || []) {
    parts.push(edu.institution, edu.degree);
  }
  for (const cert of resume.certifications || []) {
    parts.push(cert.name, cert.issuer);
  }
  for (const proj of resume.projects || []) {
    parts.push(proj.name, proj.description, ...(proj.technologies || []));
  }
  parts.push(...(resume.languages || []));
  return normalize(parts.filter(Boolean).join(" \n "));
}

export function buildKeywordMatches(
  jobDescription: string,
  masterResume: ResumeData,
  tailoredResume: ResumeData
): KeywordMatch[] {
  const candidates = extractCandidateTerms(jobDescription);
  const masterText = resumeToSearchableText(masterResume);
  const tailoredText = resumeToSearchableText(tailoredResume);

  return candidates.map(({ term, frequency }) => ({
    term,
    category: classifyCategory(term),
    frequencyInJob: frequency,
    matchesInMaster: countOccurrences(masterText, term),
    matchesInTailored: countOccurrences(tailoredText, term),
    importance: classifyImportance(frequency),
  }));
}

const IMPORTANCE_WEIGHT: Record<KeywordMatch["importance"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function keywordCoverageScore(keywords: KeywordMatch[], field: "matchesInMaster" | "matchesInTailored"): number {
  if (keywords.length === 0) return 100;
  let earned = 0;
  let possible = 0;
  for (const kw of keywords) {
    const weight = IMPORTANCE_WEIGHT[kw.importance];
    possible += weight;
    if (kw[field] > 0) {
      earned += weight;
    }
  }
  return possible === 0 ? 100 : Math.round((earned / possible) * 100);
}

export function computeFormattingChecks(resume: ResumeData): FormattingCheck[] {
  const checks: FormattingCheck[] = [];

  const hasContact = Boolean(
    resume.contact?.name && resume.contact?.email && resume.contact?.phone && resume.contact?.location
  );
  checks.push({
    checkName: "Contact information completeness",
    status: hasContact ? "pass" : "fail",
    description: hasContact
      ? "Name, email, phone, and location are all present."
      : "Missing one or more of: name, email, phone, location.",
  });

  const summaryLen = (resume.summary || "").trim().length;
  checks.push({
    checkName: "Professional summary",
    status: summaryLen >= 80 ? "pass" : summaryLen > 0 ? "warning" : "fail",
    description:
      summaryLen >= 80
        ? "Summary has enough content to carry keywords."
        : summaryLen > 0
        ? "Summary is present but short; ATS parsers weigh it less."
        : "No professional summary found.",
  });

  const allBullets = (resume.experience || []).flatMap((exp) => exp.bullets || []);
  const quantified = allBullets.filter((b) => /\d/.test(b)).length;
  const quantifiedRatio = allBullets.length > 0 ? quantified / allBullets.length : 0;
  checks.push({
    checkName: "Quantified achievements",
    status: quantifiedRatio >= 0.3 ? "pass" : quantifiedRatio > 0 ? "warning" : "fail",
    description: `${quantified}/${allBullets.length || 0} experience bullets include a number or metric.`,
  });

  const emptyBulletEntries = (resume.experience || []).filter((exp) => !exp.bullets || exp.bullets.length === 0).length;
  checks.push({
    checkName: "Bullet point coverage",
    status: emptyBulletEntries === 0 ? "pass" : "warning",
    description:
      emptyBulletEntries === 0
        ? "Every work experience entry has at least one bullet."
        : `${emptyBulletEntries} work experience entr${emptyBulletEntries === 1 ? "y has" : "ies have"} no bullets.`,
  });

  const hasCoreSections = (resume.experience?.length || 0) > 0 && (resume.education?.length || 0) > 0 && (resume.skills?.length || 0) > 0;
  checks.push({
    checkName: "Core section completeness",
    status: hasCoreSections ? "pass" : "warning",
    description: hasCoreSections
      ? "Experience, education, and skills sections are all present."
      : "One or more of experience/education/skills sections is empty.",
  });

  const wordCount = resumeToSearchableText(resume).split(/\s+/).filter(Boolean).length;
  checks.push({
    checkName: "Resume length",
    status: wordCount >= 250 && wordCount <= 1200 ? "pass" : "warning",
    description: `Approximately ${wordCount} words (typical ATS-friendly range is 250-1200).`,
  });

  const missingDates = (resume.experience || []).filter((exp) => !exp.startDate || !exp.endDate).length;
  checks.push({
    checkName: "Date formatting",
    status: missingDates === 0 ? "pass" : "warning",
    description:
      missingDates === 0
        ? "All experience entries have start and end dates."
        : `${missingDates} experience entr${missingDates === 1 ? "y is" : "ies are"} missing a start or end date.`,
  });

  return checks;
}

function formattingPassRate(checks: FormattingCheck[]): number {
  if (checks.length === 0) return 100;
  const points = checks.reduce((sum, c) => sum + (c.status === "pass" ? 1 : c.status === "warning" ? 0.5 : 0), 0);
  return Math.round((points / checks.length) * 100);
}

function completenessScore(resume: ResumeData): number {
  let score = 0;
  if ((resume.experience?.length || 0) > 0) score += 25;
  if ((resume.education?.length || 0) > 0) score += 25;
  if ((resume.skills?.length || 0) > 0) score += 25;
  if ((resume.summary || "").trim().length > 0) score += 25;
  return score;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export interface TailorScoring {
  atsScoreBefore: number;
  atsScoreAfter: number;
  keywords: KeywordMatch[];
  formattingChecks: FormattingCheck[];
}

/**
 * Scores the master and tailored resumes against the same job description
 * with the exact same weighting (keyword coverage 55%, formatting 25%,
 * section completeness 20%), so the reported delta reflects a real change:
 * an unmodified resume scores identically before and after, and only
 * genuine keyword/formatting/completeness improvements move the number.
 * Only the tailored resume's formatting checks are returned in the
 * response (it's the artifact that actually gets submitted), but the
 * master resume's own checks are computed the same way for its score.
 */
export function computeTailorScoring(
  masterResume: ResumeData,
  tailoredResume: ResumeData,
  jobDescription: string
): TailorScoring {
  const keywords = buildKeywordMatches(jobDescription, masterResume, tailoredResume);

  const masterFormattingChecks = computeFormattingChecks(masterResume);
  const atsScoreBefore = scoreAgainstChecks(
    keywordCoverageScore(keywords, "matchesInMaster"),
    masterFormattingChecks,
    completenessScore(masterResume)
  );

  const formattingChecks = computeFormattingChecks(tailoredResume);
  const atsScoreAfter = scoreAgainstChecks(
    keywordCoverageScore(keywords, "matchesInTailored"),
    formattingChecks,
    completenessScore(tailoredResume)
  );

  return { atsScoreBefore, atsScoreAfter, keywords, formattingChecks };
}

function scoreAgainstChecks(keywordScore: number, checks: FormattingCheck[], completeness: number): number {
  const formatting = formattingPassRate(checks);
  return clamp(Math.round(keywordScore * 0.55 + formatting * 0.25 + completeness * 0.2), 0, 100);
}
