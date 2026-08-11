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

export interface TailorResponse {
  tailoredResume: ResumeData;
  atsScoreBefore: number;
  atsScoreAfter: number;
  keywords: KeywordMatch[];
  formattingChecks: FormattingCheck[];
  optimizationSummary: string;
  readabilityAnalysis?: ReadabilityAnalysis;
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

export interface AiConfig {
  provider: 'gemini' | 'openai' | 'custom' | 'openrouter';
  apiKey: string;
  model: string;
  customEndpoint?: string;
}

