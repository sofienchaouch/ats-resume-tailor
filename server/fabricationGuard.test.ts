import { describe, it, expect } from "vitest";
import { detectFabrications } from "./fabricationGuard";
import type { ResumeData } from "../src/types";

const master: ResumeData = {
  contact: { name: "Jane Doe", title: "Engineer", email: "jane@example.com", phone: "555-1234", location: "Remote" },
  summary: "Engineer.",
  experience: [
    { company: "Acme Corp", role: "Developer", location: "Remote", startDate: "2021", endDate: "2024", bullets: ["Wrote code"] },
  ],
  skills: [{ category: "Languages", items: ["JavaScript"] }],
  education: [{ institution: "State University", degree: "BS Computer Science", location: "US", graduationDate: "2021" }],
  certifications: [{ name: "AWS Certified Developer", issuer: "AWS", date: "2022" }],
  projects: [{ name: "Internal Dashboard", description: "A dashboard" }],
};

describe("detectFabrications", () => {
  it("returns no flags for an unmodified resume", () => {
    expect(detectFabrications(master, master)).toEqual([]);
  });

  it("allows reworded job titles and bullets (no false positive)", () => {
    const reworded: ResumeData = {
      ...master,
      contact: { ...master.contact, title: "Senior Software Engineer" },
      experience: [
        {
          company: "Acme Corp",
          role: "Senior Software Engineer",
          location: "Remote",
          startDate: "2021",
          endDate: "2024",
          bullets: ["Led backend rewrite improving latency by 30%"],
        },
      ],
    };
    expect(detectFabrications(master, reworded)).toEqual([]);
  });

  it("is case/whitespace insensitive when matching a legitimate company", () => {
    const reworded: ResumeData = {
      ...master,
      experience: [{ ...master.experience[0], company: "  ACME CORP  " }],
    };
    expect(detectFabrications(master, reworded)).toEqual([]);
  });

  it("flags an invented employer not present in the master resume", () => {
    const fabricated: ResumeData = {
      ...master,
      experience: [
        ...master.experience,
        { company: "Google", role: "Staff Engineer", location: "Remote", startDate: "2015", endDate: "2018", bullets: ["Invented"] },
      ],
    };
    const flags = detectFabrications(master, fabricated);
    expect(flags).toContainEqual(
      expect.objectContaining({ category: "company", value: "Google" })
    );
  });

  it("flags an inflated date range for a real employer", () => {
    const fabricated: ResumeData = {
      ...master,
      experience: [{ ...master.experience[0], startDate: "2018" }],
    };
    const flags = detectFabrications(master, fabricated);
    expect(flags).toContainEqual(expect.objectContaining({ category: "dates" }));
  });

  it("flags an invented degree/institution", () => {
    const fabricated: ResumeData = {
      ...master,
      education: [{ institution: "MIT", degree: "PhD Computer Science", location: "US", graduationDate: "2015" }],
    };
    const flags = detectFabrications(master, fabricated);
    expect(flags).toContainEqual(expect.objectContaining({ category: "education" }));
  });

  it("flags an invented certification", () => {
    const fabricated: ResumeData = {
      ...master,
      certifications: [{ name: "Google Cloud Architect", issuer: "Google", date: "2023" }],
    };
    const flags = detectFabrications(master, fabricated);
    expect(flags).toContainEqual(expect.objectContaining({ category: "certification", value: "Google Cloud Architect" }));
  });

  it("flags an invented project", () => {
    const fabricated: ResumeData = {
      ...master,
      projects: [{ name: "Fabricated AI Platform", description: "made up" }],
    };
    const flags = detectFabrications(master, fabricated);
    expect(flags).toContainEqual(expect.objectContaining({ category: "project", value: "Fabricated AI Platform" }));
  });

  it("catches multiple simultaneous fabrications", () => {
    const fabricated: ResumeData = {
      ...master,
      experience: [
        { ...master.experience[0], startDate: "2018" },
        { company: "Google", role: "Staff Engineer", location: "Remote", startDate: "2015", endDate: "2018", bullets: [] },
      ],
      education: [{ institution: "MIT", degree: "PhD Computer Science", location: "US", graduationDate: "2015" }],
      certifications: [{ name: "Google Cloud Architect", issuer: "Google", date: "2023" }],
      projects: [{ name: "Fabricated AI Platform", description: "made up" }],
    };
    const flags = detectFabrications(master, fabricated);
    const categories = flags.map((f) => f.category).sort();
    expect(categories).toEqual(["certification", "company", "dates", "education", "project"]);
  });
});
