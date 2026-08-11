import { describe, it, expect } from "vitest";
import { computeTailorScoring, computeFormattingChecks, buildKeywordMatches } from "./scoring";
import type { ResumeData } from "../src/types";

const jobDescription = `
We are hiring a Senior Backend Engineer. Requirements:
- 5+ years experience with Python and Django
- Strong experience with PostgreSQL and Redis
- Experience with Docker and Kubernetes in production
- Familiarity with AWS and CI/CD pipelines
- Excellent communication and leadership skills
- Experience with microservices architecture
`;

const weakResume: ResumeData = {
  contact: { name: "Jane Doe", title: "Engineer", email: "jane@example.com", phone: "555-1234", location: "Remote" },
  summary: "Engineer.",
  experience: [
    { company: "Acme", role: "Developer", location: "Remote", startDate: "2020", endDate: "2023", bullets: ["Wrote code"] },
  ],
  skills: [{ category: "Languages", items: ["JavaScript"] }],
  education: [{ institution: "State University", degree: "BS Computer Science", location: "US", graduationDate: "2020" }],
};

const strongResume: ResumeData = {
  contact: { name: "Jane Doe", title: "Senior Backend Engineer", email: "jane@example.com", phone: "555-1234", location: "Remote" },
  summary:
    "Senior Backend Engineer with 5+ years building Python and Django services, deep experience with PostgreSQL, Redis, Docker, and Kubernetes on AWS, with strong communication and leadership across microservices teams.",
  experience: [
    {
      company: "Acme",
      role: "Senior Backend Engineer",
      location: "Remote",
      startDate: "2020",
      endDate: "2023",
      bullets: [
        "Led migration of 12 microservices to Kubernetes on AWS, reducing deploy time by 40%",
        "Built CI/CD pipelines with Docker cutting release cycle from days to hours",
        "Optimized PostgreSQL and Redis caching layer, improving p95 latency by 35%",
        "Mentored 4 engineers and led cross-team communication with product leadership",
      ],
    },
  ],
  skills: [
    { category: "Backend", items: ["Python", "Django", "PostgreSQL", "Redis"] },
    { category: "Infrastructure", items: ["Docker", "Kubernetes", "AWS", "CI/CD"] },
  ],
  education: [{ institution: "State University", degree: "BS Computer Science", location: "US", graduationDate: "2020" }],
};

describe("computeTailorScoring", () => {
  it("scores an identical before/after resume the same (no free improvement)", () => {
    const result = computeTailorScoring(weakResume, weakResume, jobDescription);
    expect(result.atsScoreBefore).toBe(result.atsScoreAfter);
  });

  it("scores a genuinely improved resume higher than the weak one, without being pinned near 100", () => {
    const result = computeTailorScoring(weakResume, strongResume, jobDescription);
    expect(result.atsScoreAfter).toBeGreaterThan(result.atsScoreBefore);
    expect(result.atsScoreAfter).toBeLessThan(95);
    expect(result.atsScoreAfter - result.atsScoreBefore).toBeGreaterThan(20);
  });

  it("keeps scores within 0-100", () => {
    const result = computeTailorScoring(weakResume, strongResume, jobDescription);
    expect(result.atsScoreBefore).toBeGreaterThanOrEqual(0);
    expect(result.atsScoreBefore).toBeLessThanOrEqual(100);
    expect(result.atsScoreAfter).toBeGreaterThanOrEqual(0);
    expect(result.atsScoreAfter).toBeLessThanOrEqual(100);
  });

  it("handles an empty job description without throwing", () => {
    const result = computeTailorScoring(weakResume, strongResume, "");
    expect(result.keywords).toEqual([]);
    expect(result.atsScoreBefore).toBeGreaterThanOrEqual(0);
    expect(result.atsScoreAfter).toBeGreaterThanOrEqual(0);
  });

  it("only returns formatting checks for the tailored resume", () => {
    const result = computeTailorScoring(weakResume, strongResume, jobDescription);
    expect(result.formattingChecks).toEqual(computeFormattingChecks(strongResume));
  });
});

describe("buildKeywordMatches", () => {
  it("extracts known technical terms even at low frequency", () => {
    const matches = buildKeywordMatches(jobDescription, weakResume, strongResume);
    const terms = matches.map((m) => m.term);
    expect(terms).toContain("kubernetes");
    expect(terms).toContain("docker");
    expect(terms).toContain("postgresql");
  });

  it("counts matches correctly in master vs tailored resume", () => {
    const matches = buildKeywordMatches(jobDescription, weakResume, strongResume);
    const kubernetes = matches.find((m) => m.term === "kubernetes");
    expect(kubernetes).toBeDefined();
    expect(kubernetes!.matchesInMaster).toBe(0);
    expect(kubernetes!.matchesInTailored).toBeGreaterThan(0);
  });

  it("classifies importance by JD frequency", () => {
    const matches = buildKeywordMatches(jobDescription, weakResume, strongResume);
    for (const m of matches) {
      if (m.frequencyInJob >= 3) expect(m.importance).toBe("high");
      else if (m.frequencyInJob === 2) expect(m.importance).toBe("medium");
      else expect(m.importance).toBe("low");
    }
  });

  it("returns no keywords for an empty job description", () => {
    expect(buildKeywordMatches("", weakResume, strongResume)).toEqual([]);
  });
});

describe("computeFormattingChecks", () => {
  it("fails contact completeness when required fields are missing", () => {
    const incomplete: ResumeData = {
      ...weakResume,
      contact: { name: "Jane", title: "Engineer", email: "", phone: "", location: "" },
    };
    const checks = computeFormattingChecks(incomplete);
    const contactCheck = checks.find((c) => c.checkName === "Contact information completeness");
    expect(contactCheck?.status).toBe("fail");
  });

  it("passes contact completeness when all required fields are present", () => {
    const checks = computeFormattingChecks(strongResume);
    const contactCheck = checks.find((c) => c.checkName === "Contact information completeness");
    expect(contactCheck?.status).toBe("pass");
  });

  it("flags quantified achievements as fail when no bullet has a number", () => {
    const checks = computeFormattingChecks(weakResume);
    const quantCheck = checks.find((c) => c.checkName === "Quantified achievements");
    expect(quantCheck?.status).toBe("fail");
  });

  it("passes quantified achievements when most bullets have metrics", () => {
    const checks = computeFormattingChecks(strongResume);
    const quantCheck = checks.find((c) => c.checkName === "Quantified achievements");
    expect(quantCheck?.status).toBe("pass");
  });

  it("warns on bullet coverage when an experience entry has zero bullets", () => {
    const noBullets: ResumeData = {
      ...weakResume,
      experience: [{ company: "Acme", role: "Dev", location: "Remote", startDate: "2020", endDate: "2023", bullets: [] }],
    };
    const checks = computeFormattingChecks(noBullets);
    const bulletCheck = checks.find((c) => c.checkName === "Bullet point coverage");
    expect(bulletCheck?.status).toBe("warning");
  });

  it("warns on missing dates", () => {
    const noDates: ResumeData = {
      ...weakResume,
      experience: [{ company: "Acme", role: "Dev", location: "Remote", startDate: "", endDate: "", bullets: ["Did stuff"] }],
    };
    const checks = computeFormattingChecks(noDates);
    const dateCheck = checks.find((c) => c.checkName === "Date formatting");
    expect(dateCheck?.status).toBe("warning");
  });
});
