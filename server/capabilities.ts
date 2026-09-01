/**
 * What each AI provider can actually do.
 *
 * Routes used to gate on literal string compares (`provider !== 'gemini'`),
 * which is fragile in two directions: a new provider silently inherits
 * whatever the comparison happened to imply, and a route that forgets the
 * compare degrades silently instead of failing. `/api/jobs-deep-search` was
 * exactly that second case -- it passed `tools: [{googleSearch:{}}]`, the
 * non-Gemini adapters ignore `config.tools` entirely, and the route went on to
 * structure the model's ungrounded guesses into job listings with invented
 * URLs. Naming the capability makes that impossible to forget.
 */

export type ProviderId = "gemini" | "openai" | "custom" | "openrouter" | "claude-cli";

export interface ProviderCapabilities {
  /** Can ground answers in a live web search (Gemini's googleSearch tool). */
  webGrounding: boolean;
  /** Can accept raw non-image bytes (e.g. a PDF) as model input. */
  multimodal: boolean;
  /**
   * Enforces a response schema at the API level. False means the schema is
   * only *requested* in the prompt, so output still needs repair/validation.
   */
  structuredOutput: boolean;
}

const CAPABILITIES: Record<ProviderId, ProviderCapabilities> = {
  // Native googleSearch tool, inlineData PDF input, and responseSchema.
  gemini: { webGrounding: true, multimodal: true, structuredOutput: true },
  // callOpenAICompatible maps image mime types to image_url, but any other
  // mime (PDF) is replaced with a placeholder string and the bytes dropped.
  // response_format json_object constrains shape but not the schema itself.
  openai: { webGrounding: false, multimodal: false, structuredOutput: false },
  openrouter: { webGrounding: false, multimodal: false, structuredOutput: false },
  custom: { webGrounding: false, multimodal: false, structuredOutput: false },
  // Spawned with --tools "" precisely so it cannot browse; schema is injected
  // into the prompt as text. webGrounding can be turned on out-of-band -- see
  // providerCapabilities() -- when ENABLE_CLAUDE_CLI_WEB_SEARCH lets the search
  // phase run the CLI's WebSearch tool.
  "claude-cli": { webGrounding: false, multimodal: false, structuredOutput: false },
};

/**
 * Unknown/absent providers resolve to Gemini, matching the router's default.
 * Returns a copy: callers must not be able to widen another provider's
 * capabilities by mutating the shared record.
 */
export function providerCapabilities(
  provider?: string,
  env: NodeJS.ProcessEnv = process.env,
): ProviderCapabilities {
  const known = provider && provider in CAPABILITIES ? (provider as ProviderId) : "gemini";
  const caps = { ...CAPABILITIES[known] };
  // Opt-in: the claude-cli search phase can use the CLI's own WebSearch tool.
  if (known === "claude-cli" && env.ENABLE_CLAUDE_CLI_WEB_SEARCH === "true") {
    caps.webGrounding = true;
  }
  return caps;
}

// --- Cross-provider routing helpers ---------------------------------------
// These decide which provider(s) a request can run on. Kept here (not in
// server.ts) so they are unit-testable without booting the Express app.

export type TaskBucket = "resumeWriting" | "coverLetter" | "interviewPrep" | "analysis" | "parsing";

export interface RouterRequestShape {
  contents?: unknown;
  config?: { tools?: unknown } & Record<string, unknown>;
  aiConfig?: {
    provider?: string;
    apiKey?: string;
    taskOverrides?: Partial<Record<string, string>>;
    /** Coarse task category, set by the server request middleware from req.path. */
    taskBucket?: string;
  };
}

/** Is the built-in server Gemini key real (present, not the .env.example placeholder)? */
export function hasServerGeminiKey(env: NodeJS.ProcessEnv = process.env): boolean {
  const k = (env.GEMINI_API_KEY || "").trim();
  return k.length > 0 && !/^(your_api_key|my_gemini_api_key)$/i.test(k);
}

export function normalizeKey(raw?: string): string | undefined {
  const k = raw ? String(raw).trim() : "";
  if (!k || /^(null|undefined|your_api_key|my_gemini_api_key)$/i.test(k)) return undefined;
  return k;
}

/**
 * What a call needs from its provider, inferred from the request shape:
 * a `googleSearch` entry in `config.tools`, or a non-image `inlineData` blob
 * anywhere in `contents`.
 */
export function requiredCapabilities(req: RouterRequestShape): { webGrounding: boolean; multimodal: boolean } {
  const tools = req.config?.tools;
  const webGrounding =
    Array.isArray(tools) && tools.some((t) => t && typeof t === "object" && "googleSearch" in (t as object));

  let multimodal = false;
  const walk = (node: unknown) => {
    if (!node || multimodal) return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node === "object") {
      const inline = (node as any).inlineData;
      if (inline?.mimeType && !String(inline.mimeType).startsWith("image/")) {
        multimodal = true;
        return;
      }
      Object.values(node as object).forEach(walk);
    }
  };
  walk(req.contents);
  return { webGrounding, multimodal };
}

const KNOWN_PROVIDERS: ProviderId[] = ["gemini", "openai", "custom", "openrouter", "claude-cli"];

/**
 * Ordered {provider, key} attempts for a request. [0] is the user's selection
 * (a keyless third-party provider collapses to Gemini, as before); the rest are
 * automatic redundancy — whichever of Gemini / claude-cli is available and not
 * already the head. Providers that can't satisfy the call's required
 * capabilities are dropped so a fallback never silently degrades a feature.
 */
export function buildProviderChain(
  req: RouterRequestShape,
  env: NodeJS.ProcessEnv = process.env,
): Array<{ provider: ProviderId; key: string | undefined }> {
  const need = requiredCapabilities(req);
  const selectedRaw = req.aiConfig?.provider || "gemini";
  const selected = (KNOWN_PROVIDERS.includes(selectedRaw as ProviderId) ? selectedRaw : "gemini") as ProviderId;
  const selectedKey = normalizeKey(req.aiConfig?.apiKey);

  // A per-task pin (AI Settings > Advanced) wins over the global selection,
  // but only when its provider is actually usable for this call: it must have a
  // key if it needs one, and must satisfy the required capabilities. Otherwise
  // fall through to the normal selection so an override can never make things
  // worse than not setting one.
  const bucket = req.aiConfig?.taskBucket;
  const pinned = bucket ? req.aiConfig?.taskOverrides?.[bucket] : undefined;
  const pinnedOk =
    pinned &&
    KNOWN_PROVIDERS.includes(pinned as ProviderId) &&
    (!need.webGrounding || providerCapabilities(pinned, env).webGrounding) &&
    (!need.multimodal || providerCapabilities(pinned, env).multimodal) &&
    (pinned === "claude-cli"
      ? env.ENABLE_CLAUDE_CLI_PROVIDER === "true"
      : pinned === "gemini"
      ? selectedKey || hasServerGeminiKey(env)
      : Boolean(selectedKey)); // openai/custom/openrouter need the one stored key

  const effectiveSelected = (pinnedOk ? pinned : selected) as ProviderId;
  const effectiveKey = effectiveSelected === selected ? selectedKey : undefined;

  const head: ProviderId =
    effectiveSelected !== "gemini" && effectiveSelected !== "claude-cli" && !effectiveKey
      ? "gemini"
      : effectiveSelected;

  const candidates: Array<{ provider: ProviderId; key: string | undefined }> = [
    { provider: head, key: head === effectiveSelected ? effectiveKey : undefined },
  ];
  if (head !== "gemini" && (selectedKey || hasServerGeminiKey(env))) {
    candidates.push({ provider: "gemini", key: undefined });
  }
  if (head !== "claude-cli" && env.ENABLE_CLAUDE_CLI_PROVIDER === "true") {
    candidates.push({ provider: "claude-cli", key: undefined });
  }

  return candidates.filter(({ provider }) => {
    const caps = providerCapabilities(provider, env);
    if (need.webGrounding && !caps.webGrounding) return false;
    if (need.multimodal && !caps.multimodal) return false;
    return true;
  });
}

/** True for failures where trying a different provider might actually help. */
export function isProviderLevelFailure(err: any): boolean {
  const msg = `${err?.message || ""} ${err?.status || ""} ${err?.code || ""}`.toLowerCase();
  return [
    "api key", "api_key_invalid", "unauthor", "quota", "billing", "exhausted",
    "rate limit", "429", "oauth", "expired", "credential", "exited with code",
  ].some((needle) => msg.includes(needle));
}
