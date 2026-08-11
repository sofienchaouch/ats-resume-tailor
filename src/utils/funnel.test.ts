import { describe, it, expect } from "vitest";
import { computeFunnelByVersion } from "./funnel";
import type { JobApplication } from "../components/ApplicationTracker";

function app(overrides: Partial<JobApplication>): JobApplication {
  return {
    id: overrides.id || "app_1",
    company: "Acme",
    title: "Engineer",
    location: "Remote",
    status: "saved",
    dateAdded: "2026-01-01",
    dateUpdated: "2026-01-01",
    ...overrides,
  };
}

describe("computeFunnelByVersion", () => {
  it("groups applications by resumeId", () => {
    const apps = [app({ id: "1", resumeId: "ver_a" }), app({ id: "2", resumeId: "ver_b" })];
    const result = computeFunnelByVersion(apps, { ver_a: "Backend", ver_b: "Data" });
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.resumeName).sort()).toEqual(["Backend", "Data"]);
  });

  it("buckets applications with no resumeId as 'Unassigned'", () => {
    const result = computeFunnelByVersion([app({ resumeId: undefined })], {});
    expect(result[0].resumeId).toBe("unknown");
    expect(result[0].resumeName).toBe("Unassigned");
  });

  it("counts cumulatively: an offer counts toward every earlier stage too", () => {
    const apps = [app({ id: "1", resumeId: "ver_a", status: "offer" })];
    const result = computeFunnelByVersion(apps, { ver_a: "Backend" });
    const stages = Object.fromEntries(result[0].stages.map((s) => [s.stage, s.count]));
    expect(stages.saved).toBe(1);
    expect(stages.applied).toBe(1);
    expect(stages.interviewing).toBe(1);
    expect(stages.offer).toBe(1);
  });

  it("excludes archived applications from the funnel but reports their count separately", () => {
    const apps = [
      app({ id: "1", resumeId: "ver_a", status: "applied" }),
      app({ id: "2", resumeId: "ver_a", status: "archived" }),
    ];
    const result = computeFunnelByVersion(apps, { ver_a: "Backend" });
    expect(result[0].total).toBe(2);
    expect(result[0].archivedCount).toBe(1);
    const applied = result[0].stages.find((s) => s.stage === "applied");
    expect(applied?.count).toBe(1);
  });

  it("computes responseRate as interviewing-or-later over applied-or-later", () => {
    const apps = [
      app({ id: "1", resumeId: "ver_a", status: "applied" }),
      app({ id: "2", resumeId: "ver_a", status: "applied" }),
      app({ id: "3", resumeId: "ver_a", status: "interviewing" }),
      app({ id: "4", resumeId: "ver_a", status: "offer" }),
    ];
    const result = computeFunnelByVersion(apps, { ver_a: "Backend" });
    // 4 applied-or-later, 2 interviewing-or-later -> 50%
    expect(result[0].responseRate).toBe(50);
  });

  it("returns 0% response rate when there are no applied-or-later applications", () => {
    const result = computeFunnelByVersion([app({ resumeId: "ver_a", status: "saved" })], { ver_a: "Backend" });
    expect(result[0].responseRate).toBe(0);
  });

  it("sorts versions by total application count, descending", () => {
    const apps = [
      app({ id: "1", resumeId: "ver_small" }),
      app({ id: "2", resumeId: "ver_big" }),
      app({ id: "3", resumeId: "ver_big" }),
    ];
    const result = computeFunnelByVersion(apps, { ver_small: "Small", ver_big: "Big" });
    expect(result[0].resumeName).toBe("Big");
    expect(result[1].resumeName).toBe("Small");
  });

  it("falls back to 'Untitled Resume' for a known resumeId with no name mapping", () => {
    const result = computeFunnelByVersion([app({ resumeId: "ver_x" })], {});
    expect(result[0].resumeName).toBe("Untitled Resume");
  });
});
