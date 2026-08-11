import { describe, it, expect } from "vitest";
import {
  tailorSchema,
  scoreResumeSchema,
  generatePdfSchema,
  parseEmailInterviewSchema,
  improveBulletSchema,
} from "./schemas";

const validResume = {
  contact: { name: "Jane Doe", title: "Engineer", email: "jane@example.com", phone: "555-1234", location: "Remote" },
  summary: "Engineer.",
  experience: [
    { company: "Acme", role: "Developer", location: "Remote", startDate: "2020", endDate: "2023", bullets: ["Wrote code"] },
  ],
  skills: [{ category: "Languages", items: ["JavaScript"] }],
  education: [{ institution: "State University", degree: "BS Computer Science", location: "US", graduationDate: "2020" }],
};

describe("scoreResumeSchema", () => {
  it("accepts a valid resume", () => {
    const result = scoreResumeSchema.safeParse({ masterResume: validResume });
    expect(result.success).toBe(true);
  });

  it("rejects a missing masterResume", () => {
    const result = scoreResumeSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a resume missing a required contact field", () => {
    const broken = { ...validResume, contact: { ...validResume.contact, email: undefined } };
    const result = scoreResumeSchema.safeParse({ masterResume: broken });
    expect(result.success).toBe(false);
  });

  it("rejects an oversized summary field", () => {
    const oversized = { ...validResume, summary: "x".repeat(25000) };
    const result = scoreResumeSchema.safeParse({ masterResume: oversized });
    expect(result.success).toBe(false);
  });

  it("strips unknown top-level fields without erroring on extras it doesn't recognize", () => {
    // Extra fields are allowed through (not .strict()); the point is required fields are still enforced.
    const result = scoreResumeSchema.safeParse({ masterResume: validResume, unexpectedField: "whatever" });
    expect(result.success).toBe(true);
  });
});

describe("tailorSchema", () => {
  it("requires either jobDescription or jobUrl", () => {
    const result = tailorSchema.safeParse({ masterResume: validResume });
    expect(result.success).toBe(false);
  });

  it("accepts a request with only jobDescription", () => {
    const result = tailorSchema.safeParse({ masterResume: validResume, jobDescription: "We need a backend engineer." });
    expect(result.success).toBe(true);
  });

  it("accepts a request with only jobUrl", () => {
    const result = tailorSchema.safeParse({ masterResume: validResume, jobUrl: "https://example.com/job/123" });
    expect(result.success).toBe(true);
  });

  it("rejects an oversized jobDescription", () => {
    const result = tailorSchema.safeParse({ masterResume: validResume, jobDescription: "x".repeat(25000) });
    expect(result.success).toBe(false);
  });
});

describe("generatePdfSchema", () => {
  it("requires non-empty htmlContent", () => {
    expect(generatePdfSchema.safeParse({ htmlContent: "" }).success).toBe(false);
    expect(generatePdfSchema.safeParse({}).success).toBe(false);
  });

  it("accepts valid htmlContent", () => {
    expect(generatePdfSchema.safeParse({ htmlContent: "<html></html>" }).success).toBe(true);
  });

  it("rejects htmlContent over the 2MB cap", () => {
    const result = generatePdfSchema.safeParse({ htmlContent: "x".repeat(2_000_001) });
    expect(result.success).toBe(false);
  });
});

describe("parseEmailInterviewSchema", () => {
  it("requires at least one of emailSnippet or emailBody", () => {
    expect(parseEmailInterviewSchema.safeParse({}).success).toBe(false);
  });

  it("accepts emailSnippet alone", () => {
    expect(parseEmailInterviewSchema.safeParse({ emailSnippet: "Interview scheduled" }).success).toBe(true);
  });

  it("accepts emailBody alone", () => {
    expect(parseEmailInterviewSchema.safeParse({ emailBody: "Full email text here" }).success).toBe(true);
  });
});

describe("improveBulletSchema", () => {
  it("rejects an empty bulletText", () => {
    expect(improveBulletSchema.safeParse({ bulletText: "" }).success).toBe(false);
  });

  it("accepts a normal bulletText", () => {
    expect(improveBulletSchema.safeParse({ bulletText: "Led a team of 5 engineers" }).success).toBe(true);
  });

  it("validates aiConfig.provider against the known enum", () => {
    const bad = improveBulletSchema.safeParse({ bulletText: "test", aiConfig: { provider: "not-a-real-provider" } });
    expect(bad.success).toBe(false);
    const good = improveBulletSchema.safeParse({ bulletText: "test", aiConfig: { provider: "openai" } });
    expect(good.success).toBe(true);
  });
});
