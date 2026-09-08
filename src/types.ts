export interface ContactInfo {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  website?: string;
}

export interface WorkExperience {
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface Education {
  institution: string;
  degree: string;
  location: string;
  graduationDate: string;
  gpa?: string;
}

export interface SkillCategory {
  category: string;
  items: string[];
}

export interface Certification {
  name: string;
  issuer: string;
  date: string;
}

export interface Project {
  name: string;
  description: string;
  technologies?: string[];
  link?: string;
}

export interface ResumeData {
  contact: ContactInfo;
  summary: string;
  experience: WorkExperience[];
  skills: SkillCategory[];
  education: Education[];
  certifications?: Certification[];
  projects?: Project[];
  languages?: string[];
}

export interface KeywordMatch {
  term: string;
  category: 'technical' | 'soft' | 'domain' | 'industry';
  frequencyInJob: number;
  matchesInMaster: number;
  matchesInTailored: number;
  importance: 'high' | 'medium' | 'low';
}

export interface FormattingCheck {
  checkName: string;
  status: 'pass' | 'warning' | 'fail';
  description: string;
}

export interface ReadabilityAnalysis {
  styleClarityScore: number;
  readabilityLevel: string;
  wordCount: number;
  sentenceComplexity: 'simple' | 'balanced' | 'complex';
  improvements: string[];
  strongPoints: string[];
  clicheCount: number;
  passiveVoiceInstances: string[];
}

export interface FabricationFlag {
  category: 'company' | 'dates' | 'education' | 'certification' | 'project';
  value: string;
  detail: string;
}

export interface TailorResponse {
  tailoredResume: ResumeData;
  atsScoreBefore: number;
  atsScoreAfter: number;
  keywords: KeywordMatch[];
  formattingChecks: FormattingCheck[];
  optimizationSummary: string;
  readabilityAnalysis?: ReadabilityAnalysis;
  fabricationFlags?: FabricationFlag[];
}

export interface CoverLetterData {
  subject: string;
  recipientCompany: string;
  recipientName: string;
  salutation: string;
  introduction: string;
  bodyParagraphs: string[];
  conclusion: string;
  signOff: string;
  senderName: string;
}

/**
 * One saved tailoring run. Persisted per-entry to users/{uid}/history/{id} for
 * signed-in users, and to the `ats_tailored_history` array in localDb for
 * guests. `coverLetter` is attached lazily: it only exists once the user has
 * generated one for this run.
 */
export interface HistoryEntry {
  id: string;
  timestamp: string;
  title: string;
  targetCompany?: string;
  targetTitle?: string;
  result: TailorResponse;
  coverLetter?: CoverLetterData;
}

/**
 * One job posting in the Deep Search results list. Mirrors the
 * /api/jobs-deep-search response the client renders, plus a client-assigned
 * stable `id` (see src/utils/jobKey.ts) used as the tailor-queue handle.
 */
export interface JobSearchResult {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  source: string;
  relocationOffered?: boolean;
  visaSupport?: string;
  fitScore?: number;
  verified?: boolean;
  alreadyTracked?: boolean;
  salary?: string;
  postedAt?: string;
}

export type AiProviderId = 'gemini' | 'openai' | 'custom' | 'openrouter' | 'claude-cli';

/**
 * Coarse task buckets the user can pin to a specific provider in AI Settings.
 * Web-grounded tasks (job search, URL fetch) are always Gemini and ignore this.
 */
export type AiTaskBucket = 'resumeWriting' | 'coverLetter' | 'interviewPrep' | 'analysis' | 'parsing';

export interface AiConfig {
  provider: AiProviderId;
  apiKey: string;
  model: string;
  customEndpoint?: string;
  /** Optional per-task provider pins. Absent/‘default’ => use `provider`. */
  taskOverrides?: Partial<Record<AiTaskBucket, AiProviderId>>;
}

