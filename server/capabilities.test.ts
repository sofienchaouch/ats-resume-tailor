import { describe, it, expect } from "vitest";
import { providerCapabilities } from "./capabilities";

describe("providerCapabilities", () => {
  it("grants Gemini the full feature set", () => {
    expect(providerCapabilities("gemini")).toEqual({
      webGrounding: true,
      multimodal: true,
      structuredOutput: true,
    });
  });

  it("denies web grounding to every non-Gemini provider", () => {
    for (const p of ["openai", "openrouter", "custom", "claude-cli"]) {
      expect(providerCapabilities(p).webGrounding, p).toBe(false);
    }
  });

  it("denies multimodal input to every non-Gemini provider", () => {
    for (const p of ["openai", "openrouter", "custom", "claude-cli"]) {
      expect(providerCapabilities(p).multimodal, p).toBe(false);
    }
  });

  it("defaults unknown or missing providers to Gemini, matching the router", () => {
    expect(providerCapabilities(undefined).webGrounding).toBe(true);
    expect(providerCapabilities("")).toEqual(providerCapabilities("gemini"));
    expect(providerCapabilities("not-a-provider")).toEqual(providerCapabilities("gemini"));
  });

  it("does not let a caller mutate the shared capability record", () => {
    const caps = providerCapabilities("claude-cli");
    caps.webGrounding = true;
    expect(providerCapabilities("claude-cli").webGrounding).toBe(false);
  });
});

import { buildProviderChain, requiredCapabilities, isProviderLevelFailure, normalizeKey } from "./capabilities";

const REAL_KEY = { GEMINI_API_KEY: "AIzaReal000", ENABLE_CLAUDE_CLI_PROVIDER: "false" } as NodeJS.ProcessEnv;
const NO_KEY = { GEMINI_API_KEY: "MY_GEMINI_API_KEY", ENABLE_CLAUDE_CLI_PROVIDER: "false" } as NodeJS.ProcessEnv;
const CLI_ON = { GEMINI_API_KEY: "MY_GEMINI_API_KEY", ENABLE_CLAUDE_CLI_PROVIDER: "true" } as NodeJS.ProcessEnv;

describe("normalizeKey", () => {
  it("treats blanks and known placeholders as no key", () => {
    for (const v of ["", "  ", "null", "undefined", "your_api_key", "MY_GEMINI_API_KEY"]) {
      expect(normalizeKey(v)).toBeUndefined();
    }
    expect(normalizeKey("sk-abc123")).toBe("sk-abc123");
  });
});

describe("requiredCapabilities", () => {
  it("detects googleSearch tool", () => {
    expect(requiredCapabilities({ config: { tools: [{ googleSearch: {} }] } }).webGrounding).toBe(true);
    expect(requiredCapabilities({ config: { tools: [] } }).webGrounding).toBe(false);
    expect(requiredCapabilities({}).webGrounding).toBe(false);
  });

  it("detects a non-image inlineData blob anywhere in contents", () => {
    const pdf = { contents: [{ inlineData: { mimeType: "application/pdf", data: "x" } }, { text: "hi" }] };
    expect(requiredCapabilities(pdf).multimodal).toBe(true);
    const img = { contents: [{ inlineData: { mimeType: "image/png", data: "x" } }] };
    expect(requiredCapabilities(img).multimodal).toBe(false);
    expect(requiredCapabilities({ contents: "just a string prompt" }).multimodal).toBe(false);
  });
});

describe("buildProviderChain", () => {
  it("Gemini selected, real key: single entry, no fallbacks", () => {
    const chain = buildProviderChain({ aiConfig: { provider: "gemini" } }, REAL_KEY);
    expect(chain.map((c) => c.provider)).toEqual(["gemini"]);
  });

  it("openai + key: falls back to gemini when a server key exists", () => {
    const chain = buildProviderChain({ aiConfig: { provider: "openai", apiKey: "sk-x" } }, REAL_KEY);
    expect(chain.map((c) => c.provider)).toEqual(["openai", "gemini"]);
    expect(chain[0].key).toBe("sk-x");
    expect(chain[1].key).toBeUndefined();
  });

  it("keyless openai collapses to gemini as head (old auto-swap preserved)", () => {
    const chain = buildProviderChain({ aiConfig: { provider: "openai" } }, REAL_KEY);
    expect(chain.map((c) => c.provider)).toEqual(["gemini"]);
  });

  it("claude-cli selected + CLI on + real key: cli then gemini fallback", () => {
    const chain = buildProviderChain({ aiConfig: { provider: "claude-cli" } }, { ...CLI_ON, GEMINI_API_KEY: "AIzaReal" });
    expect(chain.map((c) => c.provider)).toEqual(["claude-cli", "gemini"]);
  });

  it("claude-cli selected, no gemini key: cli only, no fabricated fallback", () => {
    const chain = buildProviderChain({ aiConfig: { provider: "claude-cli" } }, CLI_ON);
    expect(chain.map((c) => c.provider)).toEqual(["claude-cli"]);
  });

  it("gemini selected + CLI on: gemini then cli", () => {
    const chain = buildProviderChain({ aiConfig: { provider: "gemini" } }, { ...CLI_ON, GEMINI_API_KEY: "AIzaReal" });
    expect(chain.map((c) => c.provider)).toEqual(["gemini", "claude-cli"]);
  });

  it("a grounding call drops every non-grounding provider from the chain", () => {
    const chain = buildProviderChain(
      { aiConfig: { provider: "claude-cli" }, config: { tools: [{ googleSearch: {} }] } },
      { ...CLI_ON, GEMINI_API_KEY: "AIzaReal" },
    );
    expect(chain.map((c) => c.provider)).toEqual(["gemini"]);
  });

  it("a grounding call with only claude-cli available yields an empty chain", () => {
    const chain = buildProviderChain(
      { aiConfig: { provider: "claude-cli" }, config: { tools: [{ googleSearch: {} }] } },
      CLI_ON,
    );
    expect(chain).toEqual([]);
  });

  it("no key anywhere, gemini selected: still one entry (route surfaces the key error)", () => {
    const chain = buildProviderChain({ aiConfig: { provider: "gemini" } }, NO_KEY);
    expect(chain.map((c) => c.provider)).toEqual(["gemini"]);
  });
});

describe("isProviderLevelFailure", () => {
  it("true for auth/quota/cli failures", () => {
    for (const m of ["API key not valid", "RESOURCE_EXHAUSTED quota", "429 rate limit", "OAuth session expired", "Claude Code CLI exited with code 1"]) {
      expect(isProviderLevelFailure(new Error(m)), m).toBe(true);
    }
  });
  it("false for ordinary errors", () => {
    for (const m of ["Failed to parse AI output", "socket hang up", "ECONNRESET"]) {
      expect(isProviderLevelFailure(new Error(m)), m).toBe(false);
    }
  });
});

describe("buildProviderChain — per-task overrides", () => {
  const envBoth = { GEMINI_API_KEY: "AIzaReal", ENABLE_CLAUDE_CLI_PROVIDER: "true" } as NodeJS.ProcessEnv;

  it("pins a task to a different provider than the global selection", () => {
    const chain = buildProviderChain(
      { aiConfig: { provider: "gemini", taskBucket: "resumeWriting", taskOverrides: { resumeWriting: "claude-cli" } } },
      envBoth,
    );
    expect(chain[0].provider).toBe("claude-cli");
    // gemini still present as a fallback
    expect(chain.map((c) => c.provider)).toContain("gemini");
  });

  it("ignores an override for a different bucket", () => {
    const chain = buildProviderChain(
      { aiConfig: { provider: "gemini", taskBucket: "analysis", taskOverrides: { resumeWriting: "claude-cli" } } },
      envBoth,
    );
    expect(chain[0].provider).toBe("gemini");
  });

  it("ignores an override whose provider can't do a grounding call", () => {
    const chain = buildProviderChain(
      {
        aiConfig: { provider: "gemini", taskBucket: "analysis", taskOverrides: { analysis: "claude-cli" } },
        config: { tools: [{ googleSearch: {} }] },
      },
      envBoth,
    );
    expect(chain.map((c) => c.provider)).toEqual(["gemini"]);
  });

  it("ignores an override for claude-cli when the CLI provider is disabled", () => {
    const chain = buildProviderChain(
      { aiConfig: { provider: "gemini", taskBucket: "resumeWriting", taskOverrides: { resumeWriting: "claude-cli" } } },
      { GEMINI_API_KEY: "AIzaReal", ENABLE_CLAUDE_CLI_PROVIDER: "false" } as NodeJS.ProcessEnv,
    );
    expect(chain[0].provider).toBe("gemini");
  });
});

describe("claude-cli web search opt-in", () => {
  const ON = { ENABLE_CLAUDE_CLI_WEB_SEARCH: "true" } as NodeJS.ProcessEnv;
  const OFF = {} as NodeJS.ProcessEnv;

  it("claude-cli has no webGrounding by default", () => {
    expect(providerCapabilities("claude-cli", OFF).webGrounding).toBe(false);
  });

  it("ENABLE_CLAUDE_CLI_WEB_SEARCH flips webGrounding on for claude-cli only", () => {
    expect(providerCapabilities("claude-cli", ON).webGrounding).toBe(true);
    expect(providerCapabilities("openai", ON).webGrounding).toBe(false);
    expect(providerCapabilities("claude-cli", ON).multimodal).toBe(false); // unchanged
  });

  it("a grounding job search keeps claude-cli in the chain when the flag is on", () => {
    const chain = buildProviderChain(
      { aiConfig: { provider: "claude-cli" }, config: { tools: [{ googleSearch: {} }] } },
      { ENABLE_CLAUDE_CLI_PROVIDER: "true", ENABLE_CLAUDE_CLI_WEB_SEARCH: "true", GEMINI_API_KEY: "MY_GEMINI_API_KEY" } as NodeJS.ProcessEnv,
    );
    expect(chain.map((c) => c.provider)).toEqual(["claude-cli"]);
  });

  it("without the flag, that same search yields an empty chain (route returns 400)", () => {
    const chain = buildProviderChain(
      { aiConfig: { provider: "claude-cli" }, config: { tools: [{ googleSearch: {} }] } },
      { ENABLE_CLAUDE_CLI_PROVIDER: "true", GEMINI_API_KEY: "MY_GEMINI_API_KEY" } as NodeJS.ProcessEnv,
    );
    expect(chain).toEqual([]);
  });
});
