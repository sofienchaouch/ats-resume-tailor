import { describe, it, expect } from "vitest";
import { estimateResumeLength } from "./pageEstimate";
import type { ResumeData } from "../types";

const base: ResumeData = {
  contact: { name: "Jane", title: "Engineer", email: "a@b.com", phone: "1", location: "X" },
  summary: "",
  experience: [],
  skills: [],
  education: [],
};

describe("estimateResumeLength", () => {
  it("flags a very short resume as compact", () => {
    const result = estimateResumeLength({ ...base, summary: "Short summary." });
    expect(result.status).toBe("compact");
    expect(result.estimatedPages).toBe(1);
  });

  it("flags a resume around 300-1000 words as ideal (1-2 pages)", () => {
    // 20 bullets * 16 words + a 40-word summary ≈ 360 words.
    const bullets = Array(20).fill("A reasonably detailed bullet point describing an achievement with some context and metrics included here.");
    const resume: ResumeData = {
      ...base,
      summary: Array(40).fill("word").join(" "),
      experience: [{ company: "Acme", role: "Engineer", location: "X", startDate: "1", endDate: "2", bullets }],
    };
    const result = estimateResumeLength(resume);
    expect(result.status).toBe("ideal");
    expect(result.estimatedPages).toBeLessThanOrEqual(2);
  });

  it("flags a very long resume (3+ pages worth of words) as long", () => {
    // 100 bullets * ~18 words ≈ 1800 words, well past the 2-page (1100 word) threshold.
    const bullets = Array(100).fill("A reasonably detailed bullet point describing an achievement with some context and metrics included here for length.");
    const resume: ResumeData = {
      ...base,
      experience: [{ company: "Acme", role: "Engineer", location: "X", startDate: "1", endDate: "2", bullets }],
    };
    const result = estimateResumeLength(resume);
    expect(result.status).toBe("long");
    expect(result.estimatedPages).toBeGreaterThanOrEqual(3);
  });

  it("never reports fewer than 1 estimated page", () => {
    const result = estimateResumeLength(base);
    expect(result.estimatedPages).toBe(1);
  });
});
