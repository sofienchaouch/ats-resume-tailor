import { describe, it, expect } from "vitest";
import {
  countryCode,
  detectRelocation,
  matchesQuery,
  stripHtml,
  listSources,
  fetchFromSources,
} from "./jobSources";

describe("stripHtml", () => {
  it("removes tags, scripts, and common entities", () => {
    expect(stripHtml("<p>Hello&nbsp;<b>world</b></p><script>evil()</script>")).toBe("Hello world");
    expect(stripHtml("R&amp;D &lt;team&gt;")).toBe("R&D <team>");
  });
});

describe("countryCode", () => {
  it("maps city / country names to ISO codes", () => {
    expect(countryCode("Amsterdam, Netherlands")).toBe("nl");
    expect(countryCode("Berlin")).toBe("de");
    expect(countryCode("London, UK")).toBe("gb");
    expect(countryCode("San Francisco, USA")).toBe("us");
  });
  it("defaults to gb when unknown", () => {
    expect(countryCode("Atlantis")).toBe("gb");
    expect(countryCode(undefined)).toBe("gb");
  });
});

describe("detectRelocation", () => {
  it("flags visa/relocation language", () => {
    expect(detectRelocation("We offer visa sponsorship for the right candidate").relocationOffered).toBe(true);
    expect(detectRelocation("Generous relocation package included").relocationOffered).toBe(true);
    expect(detectRelocation("Must already have the right to work here").relocationOffered).toBe(false);
  });
});

describe("matchesQuery", () => {
  it("matches when any significant term is present, ignores short words", () => {
    expect(matchesQuery("Backend Engineer", "Senior Backend Engineer, Payments")).toBe(true);
    expect(matchesQuery("Backend Engineer", "Marketing Manager")).toBe(false);
    expect(matchesQuery("a to be", "anything")).toBe(true); // all terms too short => match all
  });
});

describe("listSources", () => {
  it("reports arbeitnow always available, keyed sources gated on env", () => {
    const s = listSources({} as NodeJS.ProcessEnv);
    const byId = Object.fromEntries(s.map((x) => [x.id, x.available]));
    expect(byId.arbeitnow).toBe(true);
    expect(byId.adzuna).toBe(false);
    expect(byId.jooble).toBe(false);

    const withKeys = listSources({ ADZUNA_APP_ID: "x", ADZUNA_APP_KEY: "y", JOOBLE_API_KEY: "z" } as NodeJS.ProcessEnv);
    const byId2 = Object.fromEntries(withKeys.map((x) => [x.id, x.available]));
    expect(byId2.adzuna).toBe(true);
    expect(byId2.jooble).toBe(true);
  });
});

describe("fetchFromSources (injected fetch, no network)", () => {
  const fakeArbeitnow = {
    data: [
      {
        title: "Senior Backend Engineer",
        company_name: "Acme",
        location: "Berlin",
        remote: false,
        url: "https://acme.example/jobs/be",
        tags: ["Go", "Kubernetes"],
        description: "<p>Build services. Visa sponsorship available.</p>",
        created_at: 1_780_000_000,
      },
      {
        title: "Marketing Lead",
        company_name: "Acme",
        location: "Berlin",
        remote: false,
        url: "https://acme.example/jobs/mkt",
        tags: [],
        description: "<p>Own the funnel.</p>",
        created_at: 1_780_000_100,
      },
    ],
  };

  const fetchImpl = (async (url: string) => {
    if (String(url).includes("arbeitnow")) {
      return new Response(JSON.stringify(fakeArbeitnow), { status: 200 });
    }
    return new Response("nope", { status: 500 });
  }) as unknown as typeof fetch;

  it("normalizes arbeitnow rows and filters by query", async () => {
    const res = await fetchFromSources(
      "Backend Engineer",
      { location: "Berlin", fetchImpl },
      {} as NodeJS.ProcessEnv,
      ["arbeitnow"],
    );
    expect(res.jobs).toHaveLength(1);
    const j = res.jobs[0];
    expect(j.title).toBe("Senior Backend Engineer");
    expect(j.company).toBe("Acme");
    expect(j.source).toBe("Arbeitnow");
    expect(j.relocationOffered).toBe(true);
    expect(j.postedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.perSource.arbeitnow).toBe(1);
    expect(res.errors).toEqual({});
  });

  it("captures adapter failures instead of throwing", async () => {
    const boom = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const res = await fetchFromSources("x", { fetchImpl: boom }, {} as NodeJS.ProcessEnv, ["arbeitnow"]);
    expect(res.jobs).toEqual([]);
    expect(res.errors.arbeitnow).toContain("network down");
  });
});
