import { describe, it, expect } from "vitest";
import { matchExperience } from "./ResumeDiffView";
import type { ResumeData } from "../types";

const base: ResumeData = {
  contact: { name: "Jane", title: "Engineer", email: "a@b.com", phone: "1", location: "X" },
  summary: "s",
  experience: [],
  skills: [],
  education: [],
};

describe("matchExperience", () => {
  it("matches entries by company name (case/whitespace insensitive)", () => {
    const master: ResumeData = { ...base, experience: [{ company: "  ACME  ", role: "Dev", location: "X", startDate: "1", endDate: "2", bullets: ["a"] }] };
    const tailored: ResumeData = { ...base, experience: [{ company: "Acme", role: "Senior Dev", location: "X", startDate: "1", endDate: "2", bullets: ["a"] }] };

    const matched = matchExperience(master, tailored);
    expect(matched).toHaveLength(1);
    expect(matched[0].master).not.toBeNull();
    expect(matched[0].tailored).not.toBeNull();
  });

  it("flags a company present only in the tailored resume as master: null", () => {
    const master: ResumeData = { ...base, experience: [] };
    const tailored: ResumeData = { ...base, experience: [{ company: "Google", role: "Eng", location: "X", startDate: "1", endDate: "2", bullets: [] }] };

    const matched = matchExperience(master, tailored);
    expect(matched).toHaveLength(1);
    expect(matched[0].master).toBeNull();
    expect(matched[0].tailored?.company).toBe("Google");
  });

  it("flags a company present only in the master resume as tailored: null", () => {
    const master: ResumeData = { ...base, experience: [{ company: "Acme", role: "Dev", location: "X", startDate: "1", endDate: "2", bullets: [] }] };
    const tailored: ResumeData = { ...base, experience: [] };

    const matched = matchExperience(master, tailored);
    expect(matched).toHaveLength(1);
    expect(matched[0].tailored).toBeNull();
    expect(matched[0].master?.company).toBe("Acme");
  });

  it("preserves the tailored resume's experience order first", () => {
    const master: ResumeData = {
      ...base,
      experience: [
        { company: "A", role: "r", location: "x", startDate: "1", endDate: "2", bullets: [] },
        { company: "B", role: "r", location: "x", startDate: "1", endDate: "2", bullets: [] },
      ],
    };
    const tailored: ResumeData = {
      ...base,
      experience: [
        { company: "B", role: "r", location: "x", startDate: "1", endDate: "2", bullets: [] },
        { company: "A", role: "r", location: "x", startDate: "1", endDate: "2", bullets: [] },
      ],
    };

    const matched = matchExperience(master, tailored);
    expect(matched.map((m) => m.company)).toEqual(["B", "A"]);
  });
});
