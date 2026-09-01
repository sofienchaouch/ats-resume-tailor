import { describe, it, expect } from "vitest";
import { dedupeJobs, rankJobs, trackedKeySet, markTracked, type NormalizedJob } from "./jobRank";
import type { ResumeData } from "../src/types";

function job(over: Partial<NormalizedJob>): NormalizedJob {
  return {
    title: "Engineer",
    company: "Acme",
    location: "Berlin",
    url: "https://example.com/a",
    description: "",
    source: "Test",
    relocationOffered: false,
    visaSupport: "",
    ...over,
  };
}

const resume: ResumeData = {
  contact: { name: "S", title: "Backend Engineer Java Spring Boot", email: "", phone: "", location: "" },
  summary: "Java Spring Boot PostgreSQL Docker Kubernetes microservices REST APIs",
  experience: [
    {
      role: "SWE",
      company: "X",
      location: "L",
      startDate: "2020",
      endDate: "2024",
      bullets: ["Built Spring Boot REST APIs with PostgreSQL and Docker"],
    },
  ],
  skills: [{ category: "Backend", items: ["Java", "Spring Boot", "PostgreSQL", "Docker", "Kubernetes"] }],
  education: [],
};

describe("dedupeJobs", () => {
  it("merges by same URL host+path ignoring query/hash", () => {
    const out = dedupeJobs([
      job({ url: "https://x.io/jobs/1?utm=a", source: "S1" }),
      job({ url: "https://x.io/jobs/1#apply", source: "S2" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toContain("S1");
    expect(out[0].source).toContain("S2");
  });

  it("merges by company+title when URLs differ", () => {
    const out = dedupeJobs([
      job({ company: "Adyen", title: "Java Engineer", url: "https://a.com/1" }),
      job({ company: "adyen", title: "java  engineer", url: "https://b.com/2" }),
    ]);
    expect(out).toHaveLength(1);
  });

  it("keeps the longer description and any relocation flag on merge", () => {
    const out = dedupeJobs([
      job({ url: "https://x.io/1", description: "short", relocationOffered: false }),
      job({
        url: "https://x.io/1",
        description: "a much longer description body",
        relocationOffered: true,
        visaSupport: "visa sponsor",
      }),
    ]);
    expect(out[0].description).toBe("a much longer description body");
    expect(out[0].relocationOffered).toBe(true);
    expect(out[0].visaSupport).toBe("visa sponsor");
  });
});

describe("rankJobs", () => {
  const jd = (t: string, d: string) => job({ title: t, description: d });

  it("ranks a matching Java role above an unrelated one", () => {
    const out = rankJobs(
      [
        jd("Marketing Manager", "Lead campaigns, brand strategy, social media, content calendar, SEO and copywriting."),
        jd("Senior Java Engineer", "Build Spring Boot microservices in Java with PostgreSQL, Docker and Kubernetes. REST APIs, CI/CD."),
      ],
      resume,
    );
    expect(out[0].title).toBe("Senior Java Engineer");
    expect(out[0].fitScore!).toBeGreaterThan(out[1].fitScore!);
  });

  it("leaves fitScore undefined and sorts last when no description", () => {
    const out = rankJobs(
      [jd("Java Engineer", "Java Spring Boot PostgreSQL Docker Kubernetes microservices"), job({ description: "" })],
      resume,
    );
    expect(out[0].fitScore).toBeTypeOf("number");
    expect(out[1].fitScore).toBeUndefined();
  });

  it("no resume => all fitScore undefined, order preserved", () => {
    const out = rankJobs([jd("A", "aaa ".repeat(20)), jd("B", "bbb ".repeat(20))]);
    expect(out.map((j) => j.fitScore)).toEqual([undefined, undefined]);
    expect(out.map((j) => j.title)).toEqual(["A", "B"]);
  });
});

describe("tracker cross-check", () => {
  it("flags jobs whose company+title match a tracked pair", () => {
    const set = trackedKeySet(["Adyen::Java Engineer", "Spotify::Backend Developer"]);
    const out = markTracked(
      [job({ company: "adyen", title: "java engineer" }), job({ company: "Booking", title: "SRE" })],
      set,
    );
    expect(out[0].alreadyTracked).toBe(true);
    expect(out[1].alreadyTracked).toBe(false);
  });

  it("empty tracker => no jobs flagged", () => {
    const out = markTracked([job({})], trackedKeySet([]));
    expect(out[0].alreadyTracked).toBeUndefined();
  });
});
