import { describe, it, expect } from "vitest";
import { getStaleApplications, buildFollowUpDraft } from "./followUp";
import type { JobApplication } from "../components/ApplicationTracker";

function app(overrides: Partial<JobApplication>): JobApplication {
  return {
    id: "1",
    company: "Acme",
    title: "Engineer",
    location: "Remote",
    status: "applied",
    dateAdded: "2026-01-01",
    dateUpdated: "2026-01-01",
    ...overrides,
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

describe("getStaleApplications", () => {
  it("includes an 'applied' application untouched for 7+ days", () => {
    const apps = [app({ dateUpdated: daysAgo(10) })];
    expect(getStaleApplications(apps)).toHaveLength(1);
  });

  it("excludes an 'applied' application updated recently", () => {
    const apps = [app({ dateUpdated: daysAgo(2) })];
    expect(getStaleApplications(apps)).toHaveLength(0);
  });

  it("excludes applications not in 'applied' status, regardless of age", () => {
    const apps = [
      app({ id: "1", status: "interviewing", dateUpdated: daysAgo(30) }),
      app({ id: "2", status: "offer", dateUpdated: daysAgo(30) }),
      app({ id: "3", status: "archived", dateUpdated: daysAgo(30) }),
      app({ id: "4", status: "saved", dateUpdated: daysAgo(30) }),
    ];
    expect(getStaleApplications(apps)).toHaveLength(0);
  });

  it("sorts stalest-first", () => {
    const apps = [app({ id: "recent", dateUpdated: daysAgo(8) }), app({ id: "stale", dateUpdated: daysAgo(20) })];
    const result = getStaleApplications(apps);
    expect(result[0].id).toBe("stale");
  });

  it("respects a custom threshold", () => {
    const apps = [app({ dateUpdated: daysAgo(5) })];
    expect(getStaleApplications(apps, 3)).toHaveLength(1);
    expect(getStaleApplications(apps, 10)).toHaveLength(0);
  });
});

describe("buildFollowUpDraft", () => {
  it("includes the company and title", () => {
    const draft = buildFollowUpDraft(app({ company: "Acme Corp", title: "Senior Engineer", dateUpdated: daysAgo(9) }));
    expect(draft).toContain("Acme Corp");
    expect(draft).toContain("Senior Engineer");
  });

  it("uses a placeholder when no sender name is given", () => {
    const draft = buildFollowUpDraft(app({ dateUpdated: daysAgo(9) }));
    expect(draft).toContain("[Your Name]");
  });

  it("uses the provided sender name when given", () => {
    const draft = buildFollowUpDraft(app({ dateUpdated: daysAgo(9) }), "Jane Doe");
    expect(draft).toContain("Jane Doe");
    expect(draft).not.toContain("[Your Name]");
  });
});
