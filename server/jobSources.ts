import type { NormalizedJob } from "./jobRank";

/**
 * Job-board source adapters.
 *
 * Hard rule for this whole module: adapters return ONLY what a real API gave
 * back. No adapter ever synthesizes a listing, a URL, or a company. AI in the
 * route may rewrite the *query*, never invent a *result*. (This module exists
 * because an earlier version let an ungrounded model fabricate postings.)
 */

export interface SourceOpts {
  /** location string as the user typed it, e.g. "Amsterdam, Netherlands" */
  location?: string;
  /** ATS board slugs like "greenhouse:adyen", "lever:spotify", "ashby:ramp" */
  watchlist?: string[];
  remoteOnly?: boolean;
  /** injectable for tests */
  fetchImpl?: typeof fetch;
  /** per-request cap applied by each adapter before returning */
  limit?: number;
}

export interface SourceAdapter {
  id: string;
  /** human label for the UI availability list */
  label: string;
  /** does this adapter have what it needs (keys / a watchlist) to run? */
  available(env: NodeJS.ProcessEnv, opts: SourceOpts): boolean;
  fetch(query: string, opts: SourceOpts, env: NodeJS.ProcessEnv): Promise<NormalizedJob[]>;
}

const UA = "ats-resume-tailor/1.0 (+job-search)";
const DEFAULT_TIMEOUT = 8000;

function stripHtml(html: string): string {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getJson(url: string, opts: SourceOpts, init?: RequestInit): Promise<any> {
  const f = opts.fetchImpl || fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT);
  try {
    const res = await f(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json", ...(init?.headers || {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** naive query-term match against a job's text, used by feeds with no server-side search */
function matchesQuery(query: string, ...fields: string[]): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) return true;
  const hay = fields.join(" ").toLowerCase();
  // any significant term present (OR) — deliberately loose, ranking sorts it out
  return terms.some((t) => hay.includes(t));
}

const VISA_HINT =
  /visa sponsor|visa support|sponsorship available|relocation (package|assistance|support|bonus|allowance)|we sponsor|work permit/i;

function detectRelocation(text: string): { relocationOffered: boolean; visaSupport: string } {
  const m = String(text || "").match(VISA_HINT);
  return m ? { relocationOffered: true, visaSupport: m[0] } : { relocationOffered: false, visaSupport: "" };
}

function countryCode(location?: string): string {
  const l = (location || "").toLowerCase();
  const map: Array<[RegExp, string]> = [
    [/netherland|amsterdam|rotterdam|utrecht|the hague|eindhoven/, "nl"],
    [/german|berlin|munich|münchen|hamburg|frankfurt|cologne|köln/, "de"],
    [/france|paris|lyon|toulouse|bordeaux/, "fr"],
    [/spain|madrid|barcelona|valencia/, "es"],
    [/united kingdom|england|london|manchester|\buk\b|scotland/, "gb"],
    [/united states|\busa\b|new york|san francisco|\bus\b|remote us/, "us"],
    [/canada|toronto|vancouver|montreal/, "ca"],
    [/ireland|dublin/, "ie"],
    [/austria|vienna|wien/, "at"],
    [/poland|warsaw|krakow|kraków/, "pl"],
  ];
  for (const [re, code] of map) if (re.test(l)) return code;
  return "gb";
}

// --- Adapters ------------------------------------------------------------------

/** Arbeitnow: keyless static feed of ~175 recent (mostly EU) postings. Filter client-side. */
const arbeitnow: SourceAdapter = {
  id: "arbeitnow",
  label: "Arbeitnow (EU, no key)",
  available: () => true,
  async fetch(query, opts) {
    const data = await getJson("https://www.arbeitnow.com/api/job-board-api", opts);
    const rows: any[] = Array.isArray(data?.data) ? data.data : [];
    const loc = (opts.location || "").toLowerCase().split(/[,/]/)[0]?.trim();
    return rows
      .filter((r) => matchesQuery(query, r.title, (r.tags || []).join(" ")))
      .filter((r) => !opts.remoteOnly || r.remote === true)
      .filter((r) => !loc || r.remote === true || String(r.location || "").toLowerCase().includes(loc))
      .slice(0, opts.limit || 25)
      .map((r): NormalizedJob => {
        const desc = stripHtml(r.description).slice(0, 1200);
        const reloc = detectRelocation(desc + " " + (r.tags || []).join(" "));
        return {
          title: r.title || "",
          company: r.company_name || "",
          location: r.location || (r.remote ? "Remote" : ""),
          url: r.url || "",
          description: desc,
          source: "Arbeitnow",
          postedAt: r.created_at ? new Date(r.created_at * 1000).toISOString() : undefined,
          ...reloc,
        };
      });
  },
};

/** Adzuna: needs a free app id + key. Country inferred from the location string. */
const adzuna: SourceAdapter = {
  id: "adzuna",
  label: "Adzuna",
  available: (env) => Boolean(env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY),
  async fetch(query, opts, env) {
    const cc = countryCode(opts.location);
    const params = new URLSearchParams({
      app_id: String(env.ADZUNA_APP_ID),
      app_key: String(env.ADZUNA_APP_KEY),
      what: query,
      results_per_page: String(Math.min(opts.limit || 25, 50)),
      "content-type": "application/json",
    });
    const loc = (opts.location || "").split(/[,/]/)[0]?.trim();
    if (loc) params.set("where", loc);
    const data = await getJson(`https://api.adzuna.com/v1/api/jobs/${cc}/search/1?${params}`, opts);
    const rows: any[] = Array.isArray(data?.results) ? data.results : [];
    return rows.map((r): NormalizedJob => {
      const desc = stripHtml(r.description || "").slice(0, 1200);
      const reloc = detectRelocation(desc);
      const salary =
        r.salary_min && r.salary_max
          ? `${Math.round(r.salary_min)}–${Math.round(r.salary_max)} ${r.salary_is_predicted ? "(est.)" : ""}`.trim()
          : undefined;
      return {
        title: r.title ? stripHtml(r.title) : "",
        company: r.company?.display_name || "",
        location: r.location?.display_name || loc || "",
        url: r.redirect_url || "",
        description: desc,
        source: "Adzuna",
        postedAt: r.created || undefined,
        salary,
        ...reloc,
      };
    });
  },
};

/** Jooble: free key, POSTed in the URL path. */
const jooble: SourceAdapter = {
  id: "jooble",
  label: "Jooble",
  available: (env) => Boolean(env.JOOBLE_API_KEY),
  async fetch(query, opts, env) {
    const body = JSON.stringify({
      keywords: query,
      location: (opts.location || "").split(/[,/]/)[0]?.trim() || "",
    });
    const data = await getJson(`https://jooble.org/api/${env.JOOBLE_API_KEY}`, opts, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const rows: any[] = Array.isArray(data?.jobs) ? data.jobs : [];
    return rows.slice(0, opts.limit || 25).map((r): NormalizedJob => {
      const desc = stripHtml(r.snippet || "").slice(0, 1200);
      const reloc = detectRelocation(desc);
      return {
        title: r.title || "",
        company: r.company || "",
        location: r.location || "",
        url: r.link || "",
        description: desc,
        source: r.source ? `Jooble/${r.source}` : "Jooble",
        postedAt: r.updated || undefined,
        salary: r.salary || undefined,
        ...reloc,
      };
    });
  },
};

/** Public ATS board APIs, driven by the user's watchlist. No keys. */
async function fetchGreenhouse(slug: string, query: string, opts: SourceOpts): Promise<NormalizedJob[]> {
  const data = await getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`, opts);
  const rows: any[] = Array.isArray(data?.jobs) ? data.jobs : [];
  return rows
    .filter((r) => matchesQuery(query, r.title))
    .slice(0, opts.limit || 15)
    .map((r): NormalizedJob => {
      const desc = stripHtml(r.content || "").slice(0, 1500);
      const reloc = detectRelocation(desc);
      return {
        title: r.title || "",
        company: r.company_name || slug,
        location: r.location?.name || "",
        url: r.absolute_url || "",
        description: desc,
        source: `Greenhouse/${slug}`,
        postedAt: r.updated_at || r.first_published || undefined,
        ...reloc,
      };
    });
}

async function fetchLever(slug: string, query: string, opts: SourceOpts): Promise<NormalizedJob[]> {
  const rows: any[] = await getJson(`https://api.lever.co/v0/postings/${slug}?mode=json`, opts);
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => matchesQuery(query, r.text))
    .slice(0, opts.limit || 15)
    .map((r): NormalizedJob => {
      const desc = stripHtml(r.descriptionPlain || r.description || "").slice(0, 1500);
      const reloc = detectRelocation(desc);
      return {
        title: r.text || "",
        company: slug,
        location: r.categories?.location || "",
        url: r.hostedUrl || r.applyUrl || "",
        description: desc,
        source: `Lever/${slug}`,
        postedAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
        ...reloc,
      };
    });
}

async function fetchAshby(slug: string, query: string, opts: SourceOpts): Promise<NormalizedJob[]> {
  const data = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, opts);
  const rows: any[] = Array.isArray(data?.jobs) ? data.jobs : [];
  return rows
    .filter((r) => matchesQuery(query, r.title))
    .slice(0, opts.limit || 15)
    .map((r): NormalizedJob => {
      const desc = stripHtml(r.descriptionHtml || r.descriptionPlain || "").slice(0, 1500);
      const reloc = detectRelocation(desc);
      return {
        title: r.title || "",
        company: slug,
        location: r.location || (r.isRemote ? "Remote" : ""),
        url: r.jobUrl || r.applyUrl || "",
        description: desc,
        source: `Ashby/${slug}`,
        postedAt: r.publishedAt || undefined,
        ...reloc,
      };
    });
}

const watchlistAdapter: SourceAdapter = {
  id: "watchlist",
  label: "Company watchlist (ATS boards)",
  available: (_env, opts) => Boolean(opts.watchlist && opts.watchlist.length > 0),
  async fetch(query, opts) {
    const slugs = (opts.watchlist || []).slice(0, 20);
    const jobs = await Promise.allSettled(
      slugs.map((entry) => {
        const [ats, slug] = entry.split(":").map((s) => s.trim());
        if (!slug) return Promise.resolve<NormalizedJob[]>([]);
        if (ats === "greenhouse") return fetchGreenhouse(slug, query, opts);
        if (ats === "lever") return fetchLever(slug, query, opts);
        if (ats === "ashby") return fetchAshby(slug, query, opts);
        return Promise.resolve<NormalizedJob[]>([]);
      }),
    );
    return jobs.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  },
};

export const ALL_ADAPTERS: SourceAdapter[] = [arbeitnow, adzuna, jooble, watchlistAdapter];

/** UI-facing availability list, e.g. for GET /api/job-sources. */
export function listSources(env: NodeJS.ProcessEnv): Array<{ id: string; label: string; available: boolean }> {
  return ALL_ADAPTERS.map((a) => ({
    id: a.id,
    label: a.label,
    available: a.available(env, {}),
  }));
}

export interface FetchResult {
  jobs: NormalizedJob[];
  perSource: Record<string, number>;
  errors: Record<string, string>;
}

/**
 * Run every available adapter (optionally filtered to `only`) for one query and
 * merge. Adapter failures are captured, never thrown — partial results beat none.
 */
export async function fetchFromSources(
  query: string,
  opts: SourceOpts,
  env: NodeJS.ProcessEnv,
  only?: string[],
): Promise<FetchResult> {
  const active = ALL_ADAPTERS.filter((a) => (!only || only.includes(a.id)) && a.available(env, opts));
  const settled = await Promise.allSettled(active.map((a) => a.fetch(query, opts, env)));

  const jobs: NormalizedJob[] = [];
  const perSource: Record<string, number> = {};
  const errors: Record<string, string> = {};

  settled.forEach((r, i) => {
    const id = active[i].id;
    if (r.status === "fulfilled") {
      perSource[id] = r.value.length;
      jobs.push(...r.value);
    } else {
      errors[id] = r.reason instanceof Error ? r.reason.message : String(r.reason);
      perSource[id] = 0;
    }
  });

  return { jobs, perSource, errors };
}

export { stripHtml, countryCode, detectRelocation, matchesQuery };
