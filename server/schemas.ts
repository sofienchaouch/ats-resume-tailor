import { z } from "zod";

const MAX_SHORT = 500;
const MAX_TEXT = 20000;

const contactInfoSchema = z.object({
  name: z.string().max(MAX_SHORT),
  title: z.string().max(MAX_SHORT),
  email: z.string().max(MAX_SHORT),
  phone: z.string().max(MAX_SHORT),
  location: z.string().max(MAX_SHORT),
  linkedin: z.string().max(MAX_SHORT).optional(),
  website: z.string().max(MAX_SHORT).optional(),
});

const workExperienceSchema = z.object({
  company: z.string().max(MAX_SHORT),
  role: z.string().max(MAX_SHORT),
  location: z.string().max(MAX_SHORT),
  startDate: z.string().max(100),
  endDate: z.string().max(100),
  bullets: z.array(z.string().max(MAX_TEXT)).max(50),
});

const educationSchema = z.object({
  institution: z.string().max(MAX_SHORT),
  degree: z.string().max(MAX_SHORT),
  location: z.string().max(MAX_SHORT),
  graduationDate: z.string().max(100),
  gpa: z.string().max(50).optional(),
});

const skillCategorySchema = z.object({
  category: z.string().max(MAX_SHORT),
  items: z.array(z.string().max(MAX_SHORT)).max(200),
});

const certificationSchema = z.object({
  name: z.string().max(MAX_SHORT),
  issuer: z.string().max(MAX_SHORT),
  date: z.string().max(100),
});

const projectSchema = z.object({
  name: z.string().max(MAX_SHORT),
  description: z.string().max(MAX_TEXT),
  technologies: z.array(z.string().max(MAX_SHORT)).max(100).optional(),
  link: z.string().max(MAX_SHORT).optional(),
});

// Mirrors src/types.ts ResumeData. Kept permissive on unknown extra keys
// (no .strict()) so client-side additions don't hard-break the API.
const resumeDataSchema = z.object({
  contact: contactInfoSchema,
  summary: z.string().max(MAX_TEXT),
  experience: z.array(workExperienceSchema).max(100),
  skills: z.array(skillCategorySchema).max(100),
  education: z.array(educationSchema).max(50),
  certifications: z.array(certificationSchema).max(100).optional(),
  projects: z.array(projectSchema).max(100).optional(),
  languages: z.array(z.string().max(MAX_SHORT)).max(50).optional(),
});

const aiConfigSchema = z
  .object({
    provider: z.enum(["gemini", "openai", "custom", "openrouter"]).optional(),
    apiKey: z.string().max(500).optional(),
    model: z.string().max(200).optional(),
    customEndpoint: z.string().max(500).optional(),
  })
  .optional();

const modelField = z.string().max(200).optional();
const jobDescriptionField = z.string().max(MAX_TEXT).optional();

export const analyzeJobUrlSchema = z.object({
  jobUrl: z.string().min(1).max(2000),
  masterResume: resumeDataSchema,
  model: modelField,
  aiConfig: aiConfigSchema,
});

export const scoreResumeSchema = z.object({
  masterResume: resumeDataSchema,
  model: modelField,
  aiConfig: aiConfigSchema,
});

export const translateResumeSchema = z.object({
  masterResume: resumeDataSchema,
  targetLanguage: z.string().min(1).max(50),
  model: modelField,
  aiConfig: aiConfigSchema,
});

export const tailorSchema = z
  .object({
    masterResume: resumeDataSchema,
    jobDescription: jobDescriptionField,
    jobUrl: z.string().max(2000).optional(),
    language: z.string().max(50).optional(),
    optimizeForRelocation: z.boolean().optional(),
    model: modelField,
    aiConfig: aiConfigSchema,
  })
  .refine((data) => Boolean(data.jobDescription || data.jobUrl), {
    message: "Job description or Job URL is required",
  });

export const coverLetterSchema = z.object({
  tailoredResume: resumeDataSchema,
  jobDescription: jobDescriptionField,
  language: z.string().max(50).optional(),
  model: modelField,
  aiConfig: aiConfigSchema,
});

export const parseResumeSchema = z.object({
  base64Data: z.string().min(1),
  fileType: z.string().max(20).optional(),
  model: modelField,
  aiConfig: aiConfigSchema,
});

export const jobsDeepSearchSchema = z.object({
  query: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
  masterResume: resumeDataSchema.optional(),
  useResume: z.boolean().optional(),
  supportsRelocation: z.boolean().optional(),
  jobType: z.string().max(100).optional(),
  salaryExpectation: z.string().max(200).optional(),
  remoteStatus: z.string().max(100).optional(),
  model: modelField,
  aiConfig: aiConfigSchema,
});

export const improveBulletSchema = z.object({
  bulletText: z.string().min(1).max(MAX_TEXT),
  jobDescription: jobDescriptionField,
  model: modelField,
  aiConfig: aiConfigSchema,
});

export const generatePdfSchema = z.object({
  htmlContent: z.string().min(1).max(2_000_000),
});

export const interviewPrepSchema = z.object({
  resumeData: resumeDataSchema,
  jobDescription: jobDescriptionField,
  model: modelField,
  aiConfig: aiConfigSchema,
});

export const interviewFeedbackSchema = z.object({
  question: z.string().min(1).max(MAX_TEXT),
  userAnswer: z.string().max(MAX_TEXT).optional(),
  jobDescription: jobDescriptionField,
  model: modelField,
  aiConfig: aiConfigSchema,
});

export const networkingSuggestionsSchema = z.object({
  tailoredResume: resumeDataSchema,
  jobDescription: jobDescriptionField,
  model: modelField,
  aiConfig: aiConfigSchema,
});

const coverLetterDataSchema = z.object({
  subject: z.string().max(MAX_SHORT),
  recipientCompany: z.string().max(MAX_SHORT),
  recipientName: z.string().max(MAX_SHORT),
  salutation: z.string().max(MAX_SHORT),
  introduction: z.string().max(MAX_TEXT),
  bodyParagraphs: z.array(z.string().max(MAX_TEXT)).max(20),
  conclusion: z.string().max(MAX_TEXT),
  signOff: z.string().max(MAX_SHORT),
  senderName: z.string().max(MAX_SHORT),
});

export const translateCoverLetterSchema = z.object({
  coverLetter: coverLetterDataSchema,
  targetLanguage: z.string().min(1).max(50),
  model: modelField,
  aiConfig: aiConfigSchema,
});

export const parseEmailInterviewSchema = z
  .object({
    emailSnippet: z.string().max(MAX_TEXT).optional(),
    emailBody: z.string().max(MAX_TEXT).optional(),
    model: modelField,
    aiConfig: aiConfigSchema,
  })
  .refine((data) => Boolean(data.emailBody || data.emailSnippet), {
    message: "Email body or snippet is required",
  });
