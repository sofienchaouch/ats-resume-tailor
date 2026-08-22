import express, { NextFunction, Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import mammoth from "mammoth";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { ZodType } from "zod";
import * as schemas from "./server/schemas";
import { computeTailorScoring } from "./server/scoring";
import { detectFabrications } from "./server/fabricationGuard";
import { attachUser, requireServerKey } from "./server/auth";

dotenv.config();

const app = express();
const PORT = 3000;

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Increase payload limit for larger resumes
app.use(express.json({ limit: '10mb' }));

// Middleware to inject custom Gemini API Key from x-gemini-key header into request body aiConfig
app.use((req, res, next) => {
  const customKey = req.headers['x-gemini-key'];
  if (customKey && typeof customKey === 'string' && customKey.trim() !== '') {
    if (!req.body) {
      req.body = {};
    }
    if (!req.body.aiConfig) {
      req.body.aiConfig = {};
    }
    req.body.aiConfig.apiKey = customKey.trim();
  }
  next();
});

app.use(attachUser);

// Rate limiting: only meaningful when the request is billed to the server's
// own GEMINI_API_KEY, so a caller supplying their own key is exempt.
const hasOwnApiKey = (req: Request) =>
  Boolean(req.body?.aiConfig?.apiKey && String(req.body.aiConfig.apiKey).trim() !== '');

const rateLimitKey = (req: Request) => req.user?.uid || ipKeyGenerator(req.ip || 'unknown');

const rateLimitedJson = (req: Request, res: Response) => {
  res.status(429).json({
    error: 'Too many requests. Please wait a bit before trying again.',
    code: 'RATE_LIMITED',
    statusCode: 429,
  });
};

// Standard tier: most AI routes are cheap single-call operations.
const standardAiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  skip: hasOwnApiKey,
  handler: rateLimitedJson,
});

// Expensive tier: /api/tailor can fire two sequential Gemini calls,
// jobs-deep-search does a broad search, generate-pdf launches Chromium.
const expensiveAiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  skip: hasOwnApiKey,
  handler: rateLimitedJson,
});

// Validates req.body against a zod schema before the handler (and any
// Gemini call) runs. On success, req.body is replaced with the parsed
// value, so existing `const { x, y } = req.body` destructuring is unaffected.
function validateBody(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: result.error.issues[0]?.message || "Invalid request body",
        code: "VALIDATION_ERROR",
        statusCode: 400,
      });
    }
    req.body = result.data;
    next();
  };
}

// Lazy initialize Gemini client to prevent startup crash if key is missing
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(customApiKey?: string): GoogleGenAI {
  if (customApiKey) {
    return new GoogleGenAI({
      apiKey: customApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please set it in Settings > Secrets or provide your own API key in the AI Settings panel.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Helper function to sleep for a specified duration
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Dynamic client for calling custom OpenAI-compatible API endpoints (e.g. OpenAI, Anthropic, Groq, local models)
async function callOpenAICompatible(params: {
  endpoint: string;
  apiKey: string;
  model: string;
  contents: any;
  config?: any;
}): Promise<any> {
  const { endpoint, apiKey, model, contents, config } = params;

  // Transform contents to messages
  const messages: any[] = [];

  // Add system instruction as system message if present
  if (config?.systemInstruction) {
    messages.push({
      role: "system",
      content: typeof config.systemInstruction === "string" 
        ? config.systemInstruction 
        : (config.systemInstruction.text || "")
    });
  }

  // Parse contents
  if (typeof contents === "string") {
    messages.push({ role: "user", content: contents });
  } else if (Array.isArray(contents)) {
    const contentParts: any[] = [];
    for (const item of contents) {
      if (typeof item === "string") {
        contentParts.push({ type: "text", text: item });
      } else if (item.inlineData) {
        const mimeType = item.inlineData.mimeType;
        if (mimeType.startsWith("image/")) {
          contentParts.push({
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${item.inlineData.data}`
            }
          });
        } else {
          contentParts.push({
            type: "text",
            text: `[Attached Base64 Document of type ${mimeType}]`
          });
        }
      } else if (typeof item === "object" && item.text) {
        contentParts.push({ type: "text", text: item.text });
      }
    }
    messages.push({ role: "user", content: contentParts });
  } else {
    messages.push({ role: "user", content: JSON.stringify(contents) });
  }

  const payload: any = {
    model: model,
    messages: messages,
  };

  // Support specifying max_tokens to prevent credit reserve errors on OpenRouter (defaults to a safe 4096 output limit)
  let maxTokens = config?.generationConfig?.maxOutputTokens || config?.maxOutputTokens || config?.max_tokens;
  if (!maxTokens) {
    maxTokens = 4096;
  }
  payload.max_tokens = maxTokens;

  // Support JSON mode if requested
  if (config?.responseMimeType === "application/json") {
    payload.response_format = { type: "json_object" };
    
    // Inject schema requirements into prompt for better small-model compliance
    if (config.responseSchema) {
      const schemaPrompt = `\n\nCRITICAL: Your output MUST be a valid JSON object matching this JSON Schema:\n${JSON.stringify(config.responseSchema, null, 2)}`;
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && typeof lastMsg.content === "string") {
        lastMsg.content += schemaPrompt;
      } else if (lastMsg && Array.isArray(lastMsg.content)) {
        lastMsg.content.push({ type: "text", text: schemaPrompt });
      }
    }
  }

  const url = endpoint.endsWith("/chat/completions") ? endpoint : `${endpoint.replace(/\/+$/, "")}/chat/completions`;
  console.log(`[AI Routing] Directing request to endpoint: "${url}" with model: "${model}"`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`
  };

  if (url.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "https://ai.studio/build";
    headers["X-Title"] = "ATS Resume Tailor";
  }

  let response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 402 || errorText.includes("max_tokens") || errorText.includes("afford")) {
      // Try to parse how many tokens they can afford
      // e.g. "but can only afford 3692."
      const affordMatch = errorText.match(/can\s+only\s+afford\s+(\d+)/i);
      let retryMaxTokens = 0;
      if (affordMatch) {
        const affordAmount = parseInt(affordMatch[1], 10);
        // Leave a buffer of 100 tokens so it doesn't fail again due to slight price variations or credit checking
        retryMaxTokens = Math.max(500, affordAmount - 100);
      } else {
        // Try with a lower safe limit like 1500 or half the requested tokens
        retryMaxTokens = Math.max(500, Math.floor(maxTokens / 2));
      }

      if (retryMaxTokens < maxTokens) {
        console.log(`[OpenRouter 402 Recovery] Retrying with fewer max_tokens: ${retryMaxTokens} (previously requested ${maxTokens})`);
        payload.max_tokens = retryMaxTokens;
        response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const secondErrorText = await response.text();
          throw new Error(`AI API Provider Error (Status ${response.status}): ${secondErrorText || response.statusText}`);
        }
      } else {
        throw new Error(`AI API Provider Error (Status ${response.status}): ${errorText}`);
      }
    } else {
      throw new Error(`AI API Provider Error (Status ${response.status}): ${errorText || response.statusText}`);
    }
  }

  const resultData = await response.json();
  const textContent = resultData.choices?.[0]?.message?.content || "";

  return {
    text: textContent,
    raw: resultData
  };
}

// Flattens the same `contents` shape callOpenAICompatible understands into a
// single prompt string, since the Claude Code CLI's -p mode takes one prompt
// on stdin rather than a messages array.
function flattenContentsToPrompt(contents: any, systemInstruction?: any): string {
  const parts: string[] = [];

  if (systemInstruction) {
    const sysText = typeof systemInstruction === "string" ? systemInstruction : (systemInstruction.text || "");
    if (sysText) parts.push(sysText);
  }

  if (typeof contents === "string") {
    parts.push(contents);
  } else if (Array.isArray(contents)) {
    for (const item of contents) {
      if (typeof item === "string") {
        parts.push(item);
      } else if (item?.inlineData) {
        // Same degradation as callOpenAICompatible's non-Gemini path: binary
        // attachments (resume PDFs/DOCX) become a text placeholder, not real content.
        parts.push(`[Attached Base64 Document of type ${item.inlineData.mimeType}]`);
      } else if (typeof item === "object" && item.text) {
        parts.push(item.text);
      }
    }
  } else {
    parts.push(JSON.stringify(contents));
  }

  return parts.join("\n\n");
}

/**
 * Routes a generation request through the local Claude Code CLI, authenticated
 * to whatever subscription is logged into `claude` on this machine — no API key.
 *
 * LOCAL DEVELOPMENT ONLY. The CLI binary does not exist on any deployed server,
 * and routing other users' requests through a personal subscription violates
 * Anthropic's terms of service. Gated behind ENABLE_CLAUDE_CLI_PROVIDER so it
 * can never silently activate outside a local .env.
 */
async function callClaudeCli(params: {
  model: string;
  contents: any;
  config?: any;
}): Promise<any> {
  if (process.env.ENABLE_CLAUDE_CLI_PROVIDER !== "true") {
    throw new Error(
      "The Claude Code CLI provider is local-development-only and is disabled. " +
      "Set ENABLE_CLAUDE_CLI_PROVIDER=true in your local .env to use it. " +
      "This provider can never run in a deployed environment — it shells out to a CLI " +
      "authenticated to a personal subscription on this machine."
    );
  }

  let prompt = flattenContentsToPrompt(params.contents, params.config?.systemInstruction);

  // Same schema-injection trick as callOpenAICompatible: only Gemini has native
  // structured output, so every other path asks nicely in the prompt instead.
  if (params.config?.responseMimeType === "application/json" && params.config?.responseSchema) {
    prompt += `\n\nCRITICAL: Your output MUST be a valid JSON object matching this JSON Schema:\n${JSON.stringify(params.config.responseSchema, null, 2)}\n\nOutput ONLY the JSON object. No markdown code fences, no other text.`;
  }

  // Model names in this app are Gemini-shaped (e.g. "gemini-3.5-flash"); the CLI
  // expects its own aliases (sonnet/opus/haiku). Anything not already a Claude
  // model name falls back to the CLI's default via omission.
  const claudeModelAliases = new Set(["sonnet", "opus", "haiku"]);
  const requestedModel = params.model || "";
  const modelArgs = claudeModelAliases.has(requestedModel) || requestedModel.startsWith("claude-")
    ? ["--model", requestedModel]
    : [];

  return new Promise((resolve, reject) => {
    // --tools "" disables every tool (WebFetch, Bash, Read, etc). Without this,
    // the CLI runs as a full agentic session: it can attempt tool calls (e.g.
    // WebFetch on a URL mentioned in the prompt), which get auto-blocked in this
    // headless/non-interactive context, and the model's own narration about being
    // blocked/needing permission/retrying leaks into the result text — which then
    // gets parsed straight into resume JSON fields. This provider is a plain
    // text-in/JSON-out proxy and should never have tool access.
    const child = spawn("claude", ["-p", "--output-format", "json", "--tools", "", ...modelArgs], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("error", (err) => {
      reject(new Error(`Failed to launch the Claude Code CLI: ${err.message}. Is "claude" installed and on PATH?`));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Claude Code CLI exited with code ${code}: ${stderr || "no error output"}`));
        return;
      }
      try {
        const envelope = JSON.parse(stdout);
        if (envelope.is_error) {
          reject(new Error(`Claude Code CLI reported an error: ${envelope.result || stderr || "unknown error"}`));
          return;
        }
        const resultText = envelope.result || "";
        if (!resultText) {
          reject(new Error(`Claude Code CLI returned an empty result. Raw output: ${stdout.slice(0, 500)}`));
          return;
        }
        resolve({ text: resultText, raw: envelope });
      } catch (parseErr: any) {
        reject(new Error(`Failed to parse Claude Code CLI output as JSON: ${parseErr.message}. Raw output: ${stdout.slice(0, 500)}`));
      }
    });

    // Prompt goes on stdin, not argv: real prompts here carry the full resume
    // JSON plus a job description (zod allows up to 20k chars each), which
    // would risk hitting Windows' ~32k command-line length limit as an arg,
    // and stdin sidesteps shell quoting/injection entirely.
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function repairIncompleteJson(jsonStr: string): string {
  let cleaned = jsonStr.trim();
  if (!cleaned) return "{}";

  let inString = false;
  let isEscaped = false;
  const stack: ("{" | "[")[] = [];
  let repaired = "";

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (inString) {
      if (isEscaped) {
        repaired += char;
        isEscaped = false;
      } else if (char === "\\") {
        repaired += char;
        isEscaped = true;
      } else if (char === '"') {
        repaired += char;
        inString = false;
      } else if (char === "\n") {
        repaired += "\\n";
      } else if (char === "\r") {
        repaired += "\\r";
      } else if (char === "\t") {
        repaired += "\\t";
      } else {
        repaired += char;
      }
    } else {
      if (char === '"') {
        inString = true;
        repaired += char;
      } else if (char === "{") {
        stack.push("{");
        repaired += char;
      } else if (char === "[") {
        stack.push("[");
        repaired += char;
      } else if (char === "}") {
        if (stack.length > 0 && stack[stack.length - 1] === "{") {
          stack.pop();
          repaired += char;
        }
      } else if (char === "]") {
        if (stack.length > 0 && stack[stack.length - 1] === "[") {
          stack.pop();
          repaired += char;
        }
      } else {
        repaired += char;
      }
    }
  }

  if (inString) {
    repaired += '"';
  }

  repaired = repaired.trim();
  let prevRep = "";
  while (repaired !== prevRep) {
    prevRep = repaired;
    repaired = repaired.trim();
    repaired = repaired.replace(/,\s*$/, "");
    repaired = repaired.replace(/:\s*$/, "");
    repaired = repaired.replace(/([{,]\s*)"[^"]*"\s*$/, "$1");
    repaired = repaired.replace(/,\s*$/, "");
  }

  while (stack.length > 0) {
    const last = stack.pop();
    if (last === "{") {
      repaired += "}";
    } else if (last === "[") {
      repaired += "]";
    }
  }

  return repaired;
}

function safeJsonParse(text: string): any {
  let cleaned = text.trim();
  
  // Strip Markdown code block indicators if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z0-9]*\n*/, "");
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3).trim();
    }
  }

  // 1. Try simple direct parse
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Ignore and proceed to structural scanning
  }

  // 2. Scan to find the first complete JSON object/array prefix
  let startIdx = cleaned.indexOf("{");
  const startBracket = cleaned.indexOf("[");
  if (startIdx === -1 || (startBracket !== -1 && startBracket < startIdx)) {
    startIdx = startBracket;
  }

  if (startIdx !== -1) {
    let inStr = false;
    let escaped = false;
    const stack: ("{" | "[")[] = [];
    let endIdx = -1;

    for (let i = startIdx; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (inStr) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === '"') {
          inStr = false;
        }
      } else {
        if (char === '"') {
          inStr = true;
        } else if (char === "{") {
          stack.push("{");
        } else if (char === "[") {
          stack.push("[");
        } else if (char === "}") {
          if (stack[stack.length - 1] === "{") {
            stack.pop();
          }
        } else if (char === "]") {
          if (stack[stack.length - 1] === "[") {
            stack.pop();
          }
        }
      }

      if (i > startIdx && stack.length === 0) {
        endIdx = i;
        break;
      }
    }

    if (endIdx !== -1) {
      const candidate = cleaned.substring(startIdx, endIdx + 1);
      try {
        return JSON.parse(candidate);
      } catch (err) {
        // Fallback to repair on structural candidate
        try {
          return JSON.parse(repairIncompleteJson(candidate));
        } catch (repairErr) {
          // Continue to full-string repair fallback
        }
      }
    }
  }

  // 3. Fallback: Parse with character repair on start-sliced or full string
  const toRepair = startIdx !== -1 ? cleaned.substring(startIdx) : cleaned;
  try {
    const repaired = repairIncompleteJson(toRepair);
    return JSON.parse(repaired);
  } catch (err: any) {
    console.error("[safeJsonParse] All parsing and repair attempts failed:", err);
    throw new Error(`Failed to parse AI output: ${err.message || err}`);
  }
}

// Wrapper function to execute generateContent with automatic retry on 429 rate limit/quota or 503 high demand errors
async function generateContentWithRetry(params: {
  model: string;
  contents: any;
  config?: any;
  aiConfig?: {
    provider?: 'gemini' | 'openai' | 'custom' | 'openrouter' | 'claude-cli';
    apiKey?: string;
    model?: string;
    customEndpoint?: string;
  };
}): Promise<any> {
  let provider = params.aiConfig?.provider || 'gemini';
  let customApiKey = params.aiConfig?.apiKey ? String(params.aiConfig.apiKey).trim() : undefined;

  // Normalize empty or placeholder API keys to undefined
  if (!customApiKey || customApiKey === "" || customApiKey === "null" || customApiKey === "undefined" || /^your_api_key$/i.test(customApiKey)) {
    customApiKey = undefined;
  }

  // Gracefully fallback to Gemini system default if a third-party provider is selected but no custom key is provided.
  // claude-cli is exempt: it authenticates via a local CLI session, not a key, so
  // "no key provided" is its normal, expected state rather than a reason to fall back.
  if (provider !== 'gemini' && provider !== 'claude-cli' && !customApiKey) {
    console.log(`[AI Routing] No valid API key provided for provider "${provider}". Falling back to Google Gemini with built-in system credentials.`);
    provider = 'gemini';
  }

  if (provider === 'claude-cli') {
    return await callClaudeCli({
      model: params.aiConfig?.model || params.model,
      contents: params.contents,
      config: params.config,
    });
  }

  if (provider === 'openai' || provider === 'custom' || provider === 'openrouter') {
    const endpoint = provider === 'openai' 
      ? "https://api.openai.com/v1" 
      : provider === 'openrouter'
      ? "https://openrouter.ai/api/v1"
      : (params.aiConfig?.customEndpoint || "https://api.openai.com/v1");

    if (!customApiKey) {
      const providerName = provider === 'openai' ? 'OpenAI' : provider === 'openrouter' ? 'OpenRouter' : 'Custom';
      throw new Error(`API Key is required to use the ${providerName} AI provider. Please input your key in the AI Settings panel.`);
    }

    const oaiModel = params.aiConfig?.model || params.model || (provider === 'openrouter' ? "google/gemini-2.5-flash" : "gpt-4o-mini");
    return await callOpenAICompatible({
      endpoint,
      apiKey: customApiKey,
      model: oaiModel,
      contents: params.contents,
      config: params.config
    });
  }

  // Fallback to Google Gemini
  const geminiApiKey = customApiKey || undefined;
  let requestedModel = params.model || "gemini-3.5-flash";
  
  // Sanitize the model name if we are using Gemini but the model name belongs to another provider
  if (!requestedModel.startsWith("gemini-")) {
    requestedModel = "gemini-3.5-flash";
  }

  const modelsToTry = [requestedModel];
  if (requestedModel === "gemini-3.5-flash") {
    modelsToTry.push("gemini-3.1-flash-lite");
    modelsToTry.push("gemini-3.1-pro-preview");
  } else if (requestedModel === "gemini-3.1-flash-lite") {
    modelsToTry.push("gemini-3.5-flash");
    modelsToTry.push("gemini-3.1-pro-preview");
  } else {
    modelsToTry.push("gemini-3.5-flash");
    modelsToTry.push("gemini-3.1-flash-lite");
  }

  let lastError: any = null;

  for (const currentModel of modelsToTry) {
    const ai = getGeminiClient(geminiApiKey);
    const maxRetries = 2;
    let delay = 1000;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        console.log(`[Gemini] Attempting generation with model: "${currentModel}" (Attempt ${attempt}/${maxRetries + 1})`);
        const result = await ai.models.generateContent({
          ...params,
          model: currentModel
        });
        return result;
      } catch (err: any) {
        lastError = err;
        let errMsgStr = '';
        try {
          errMsgStr = typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err);
        } catch (_) {
          errMsgStr = String(err);
        }
        const errMsg = `${err.message || ''} ${err.status || ''} ${err.code || ''} ${errMsgStr}`.toLowerCase();
        
        const isAuthError = errMsg.includes('api key not valid') || 
                            errMsg.includes('api_key_invalid') || 
                            errMsg.includes('invalid api key') || 
                            errMsg.includes('api key is invalid') || 
                            errMsg.includes('api key');
        if (isAuthError) {
          throw new Error(
            "The configured Gemini API Key is invalid, expired, or missing. " +
            "Please verify your API key in the Settings panel (Settings > Secrets) or provide your own in the AI Settings panel."
          );
        }

        const isLastModel = currentModel === modelsToTry[modelsToTry.length - 1];

        const isHardQuotaExceeded = errMsg.includes('exceeded your current quota') || 
                                    errMsg.includes('billing') || 
                                    errMsg.includes('plan and billing') ||
                                    errMsg.includes('quota exceeded');
        if (isHardQuotaExceeded) {
          if (isLastModel) {
            throw new Error(
              "Your Gemini API Key has exceeded its total project quota or billing limits. " +
              "Please configure your own Gemini API key in the AI Settings panel, or wait for your quota to reset."
            );
          } else {
            console.warn(`[Gemini] Model "${currentModel}" failed with hard quota/billing error: ${errMsg}. Trying fallback model...`);
            break; // break out of attempts loop to try the next model
          }
        }

        const is429 = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('exhausted') || errMsg.includes('rate limit');
        const is503 = errMsg.includes('503') || errMsg.includes('unavailable') || errMsg.includes('high demand') || errMsg.includes('overloaded');
        const isTemporary = is429 || is503 || errMsg.includes('temporary');

        if (isTemporary) {
          // If it is 503/high demand/overloaded, do not waste time retrying the same busy model if we have other fallbacks to try.
          // This routes the request to a healthy model immediately.
          const isLastModel = currentModel === modelsToTry[modelsToTry.length - 1];
          const maxRetriesForThisError = is503 && !isLastModel ? 0 : maxRetries;

          if (attempt <= maxRetriesForThisError) {
            console.warn(`[Gemini] Temporary issue on model "${currentModel}" (${errMsg}). Retrying in ${delay}ms...`);
            await sleep(delay);
            delay *= 1.5;
            continue;
          }
        }

        console.warn(`[Gemini] Model "${currentModel}" failed with error: ${errMsg}. Trying fallback if available...`);
        break;
      }
    }
  }

  let lastErrMsgStr = '';
  try {
    lastErrMsgStr = typeof lastError === 'object' && lastError !== null ? JSON.stringify(lastError) : String(lastError);
  } catch (_) {
    lastErrMsgStr = String(lastError);
  }
  const errMsg = `${lastError?.message || ''} ${lastError?.status || ''} ${lastError?.code || ''} ${lastErrMsgStr}`.toLowerCase();
  const is429 = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('exhausted') || errMsg.includes('rate limit');

  if (is429) {
    throw new Error(
      "Your Gemini API free quota or rate limit has been exceeded across all fallback models. " +
      "To fix this, please provide your own Gemini API Key in the AI Settings panel, " +
      "or wait a moment before trying again."
    );
  }
  if (errMsg.includes('503') || errMsg.includes('unavailable') || errMsg.includes('high demand') || errMsg.includes('temporary')) {
    throw new Error(
      "The Gemini API is currently experiencing very high demand across all fallback models. " +
      "Please try again in a few moments, or configure your own Gemini API Key in the AI Settings panel."
    );
  }

  throw lastError;
}

// REST API endpoint to analyze a job URL and extract missing skills
app.post("/api/analyze-job-url", standardAiLimiter, requireServerKey, validateBody(schemas.analyzeJobUrlSchema), async (req, res) => {
  try {
    const { jobUrl, masterResume, model, aiConfig } = req.body;

    if (!jobUrl || !masterResume) {
      return res.status(400).json({ error: "Job URL and Master Resume are required" });
    }

    const prompt = `
Analyze the following job posting URL: "${jobUrl}".
Based on the provided master resume, identify the key technical and soft skills that are missing from the resume but required by the job posting.

Master Resume:
${JSON.stringify(masterResume, null, 2)}

Output the result as a JSON object: { "missingSkills": string[] }
`;

    const response = await generateContentWithRetry({
      model: model || "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            missingSkills: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["missingSkills"]
        },
        systemInstruction: "You are an expert career and resume optimization assistant. Analyze the job URL and the provided master resume to identify missing skills required for the job. Output valid JSON.",
      },
      aiConfig
    });

    const data = safeJsonParse(response.text);
    res.json(data);
  } catch (error: any) {
    console.error("Analyze job URL error:", error);
    res.status(500).json({ error: error.message || "An error occurred during job URL analysis" });
  }
});

// REST API endpoint to score and analyze resume impact
app.post("/api/score-resume", standardAiLimiter, requireServerKey, validateBody(schemas.scoreResumeSchema), async (req, res) => {
  try {
    const { masterResume, model, aiConfig } = req.body;

    if (!masterResume) {
      return res.status(400).json({ error: "Master resume is required" });
    }

    const prompt = `
Analyze the following resume bullet points for impact and quality.
Calculate a score (0-100) based on:
1. Use of strong action verbs.
2. Inclusion of quantified metrics (percentages, currency, time saved, etc.).
3. Clarity and brevity.

Provide the score and a list of specific improvement suggestions for the bullet points.

Master Resume:
${JSON.stringify(masterResume, null, 2)}

Output the result as a JSON object: { "score": number, "suggestions": string[] }
`;

    const response = await generateContentWithRetry({
      model: model || "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["score", "suggestions"]
        },
        systemInstruction: "You are an expert resume optimization coach. Analyze bullet points for action verbs, quantification, and impact. Provide a score out of 100 and actionable suggestions."
      },
      aiConfig
    });

    const data = safeJsonParse(response.text);
    res.json(data);
  } catch (error: any) {
    console.error("Score resume error:", error);
    res.status(500).json({ error: error.message || "An error occurred during resume analysis" });
  }
});

// REST API endpoint to translate master resume
app.post("/api/translate-resume", standardAiLimiter, requireServerKey, validateBody(schemas.translateResumeSchema), async (req, res) => {
  try {
    const { masterResume, targetLanguage, model, aiConfig } = req.body;

    if (!masterResume || !targetLanguage) {
      return res.status(400).json({ error: "Master resume and target language are required" });
    }

    const langName = targetLanguage === 'fr' ? 'French' : 'English';

    const prompt = `
Translate the following JSON resume data into ${langName}. 
Maintain the exact same JSON structure, keys, and array lengths. 
Only translate the textual values (names, descriptions, roles, bullet points, locations, etc.). Do not translate email addresses, URLs, or personal names.

Master Resume:
${JSON.stringify(masterResume, null, 2)}

Output the fully translated JSON object.
`;

    const response = await generateContentWithRetry({
      model: model || "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            contact: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                title: { type: Type.STRING },
                email: { type: Type.STRING },
                phone: { type: Type.STRING },
                location: { type: Type.STRING },
                linkedin: { type: Type.STRING },
                website: { type: Type.STRING }
              }
            },
            summary: { type: Type.STRING },
            experience: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  company: { type: Type.STRING },
                  role: { type: Type.STRING },
                  startDate: { type: Type.STRING },
                  endDate: { type: Type.STRING },
                  location: { type: Type.STRING },
                  bullets: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                }
              }
            },
            skills: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  items: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                }
              }
            },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  institution: { type: Type.STRING },
                  degree: { type: Type.STRING },
                  location: { type: Type.STRING },
                  graduationDate: { type: Type.STRING },
                  gpa: { type: Type.STRING }
                }
              }
            },
            projects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  technologies: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  link: { type: Type.STRING }
                }
              }
            },
            certifications: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  issuer: { type: Type.STRING },
                  date: { type: Type.STRING }
                }
              }
            },
            languages: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        },
        systemInstruction: "You are an expert technical translator. Translate resumes flawlessly."
      },
      aiConfig
    });

    const data = safeJsonParse(response.text);
    res.json({ translatedResume: data });
  } catch (error: any) {
    console.error("Translate resume error:", error);
    res.status(500).json({ error: error.message || "An error occurred during resume translation" });
  }
});

// REST API endpoint to translate a cover letter (mirrors /api/translate-resume)
app.post("/api/translate-cover-letter", standardAiLimiter, requireServerKey, validateBody(schemas.translateCoverLetterSchema), async (req, res) => {
  try {
    const { coverLetter, targetLanguage, model, aiConfig } = req.body;
    const langName = targetLanguage === 'fr' ? 'French' : 'English';

    const prompt = `
Translate the following JSON cover letter data into ${langName}.
Maintain the exact same JSON structure, keys, and array length for bodyParagraphs.
Translate all textual fields naturally and professionally, adapting tone/idiom to the target language rather than translating word-for-word. Do not translate the sender's or recipient's personal names.

Cover Letter:
${JSON.stringify(coverLetter, null, 2)}

Output the fully translated JSON object.
`;

    const response = await generateContentWithRetry({
      model: model || "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            recipientCompany: { type: Type.STRING },
            recipientName: { type: Type.STRING },
            salutation: { type: Type.STRING },
            introduction: { type: Type.STRING },
            bodyParagraphs: { type: Type.ARRAY, items: { type: Type.STRING } },
            conclusion: { type: Type.STRING },
            signOff: { type: Type.STRING },
            senderName: { type: Type.STRING }
          },
          required: ["subject", "recipientCompany", "recipientName", "salutation", "introduction", "bodyParagraphs", "conclusion", "signOff", "senderName"]
        },
        systemInstruction: "You are an expert professional translator specializing in business correspondence. Translate cover letters flawlessly, preserving tone and persuasive intent."
      },
      aiConfig
    });

    const data = safeJsonParse(response.text);
    res.json({ translatedCoverLetter: data });
  } catch (error: any) {
    console.error("Translate cover letter error:", error);
    res.status(500).json({ error: error.message || "An error occurred during cover letter translation" });
  }
});

// REST API endpoint to tailor the resume
app.post("/api/tailor", expensiveAiLimiter, requireServerKey, validateBody(schemas.tailorSchema), async (req, res) => {
  try {
    const { masterResume, jobDescription, jobUrl, language, optimizeForRelocation, model, aiConfig } = req.body;
    if (!jobDescription && !jobUrl) {
      return res.status(400).json({ error: "Job description or Job URL is required" });
    }

    const targetLang = language === 'fr' ? 'French' : 'English';

    // If a Job URL is provided, fetch/summarize its details first in a separate non-JSON call using Google Search
    let fetchedJobDetails = "";
    if (jobUrl) {
      try {
        console.log(`[Gemini] URL provided (${jobUrl}). Fetching details first via Google Search (without responseMimeType)...`);
        const searchPrompt = `Retrieve and analyze the job posting or details at the following URL: "${jobUrl}". Summarize the job requirements, responsibilities, qualifications, tech stack, and company name clearly so we can use it to tailor a resume.`;
        const searchResponse = await generateContentWithRetry({
          model: model || "gemini-3.5-flash",
          contents: searchPrompt,
          config: {
            systemInstruction: "You are an expert career research assistant. Use Google Search to fetch or find details for the specified job posting URL, then provide a detailed, cohesive summary of the job description.",
            tools: [{ googleSearch: {} }]
          },
          aiConfig
        });
        fetchedJobDetails = searchResponse.text || "";
        console.log(`[Gemini] Successfully retrieved job details via Google Search. Length: ${fetchedJobDetails.length}`);
      } catch (err) {
        console.error("[Gemini] Failed to retrieve job details via Google Search. Proceeding with provided text context:", err);
      }
    }

    // Construct detailed prompt instructions
    let prompt = `
You are an elite Applicant Tracking System (ATS) optimization expert and executive resume copywriter.
Your task is to adapt a given "Master Resume" to fit a specific "Job Description" or "Job URL" to maximize its ATS score and secure interview invitations.

Strict Rules of Engagement:
1. DO NOT fabricate credentials: Under no circumstances should you invent degrees, projects, companies, certifications, or years of experience that do not exist or are not implied in the Master Resume.
2. OPTIMIZE bullet points: For each work experience, rewrite existing bullets to emphasize achievements using the STAR methodology (Situation, Task, Action, Result). Lead with powerful action verbs in the target language (${targetLang}).
3. ALIGN keywords: Identify key technical/hard skills, soft skills, and industry terminology mentioned in the job post. Seamlessly integrate these keywords into the "Summary", "Experience" bullet points, and "Skills" list of the tailored resume.
4. ATS COMPLIANCY: Ensure headings are standard, clean, and easily parsed. The layout must be strictly single-column. Avoid non-standard fonts, text boxes, or columns.
5. TRANSLATION: If the Master Resume is in one language and the target is different, translate the content professionally. The output tailored resume must be written entirely in ${targetLang}.
6. READABILITY, STYLE & CLARITY ANALYSIS:
   - Perform a thorough style, clarity, vocabulary strength, active vs. passive voice, and readability analysis specifically on the provided "Master Resume".
   - styleClarityScore: Calculate a realistic readability and clarity score from 0 to 100 based on standard professional writing principles (word complexity, active verbs, sentence length, lack of cliché buzzwords).
   - readabilityLevel: Formulate a user-friendly description of the readability level (e.g., "Grade 10 - Standard Professional" or "Grade 15 - Slightly Wordy/Complex").
   - wordCount: Calculate the exact or approximate total word count of the master resume.
   - sentenceComplexity: Classify sentence structures as 'simple', 'balanced', or 'complex'.
   - improvements: Provide 3-5 clear, highly actionable bullet-pointed recommendations to improve clarity or style on specific sections of the master resume.
   - strongPoints: Provide 2-3 specific, positive highlights where the master resume demonstrates exceptional clarity or writing strength.
   - clicheCount: Identify the count of generic buzzwords or clichés (e.g. "synergy", "team-player", "results-oriented", "go-getter") found in the master resume.
   - passiveVoiceInstances: List up to 3 exact phrases from the master resume where passive voice was used instead of active action verbs.
${optimizeForRelocation ? `
7. RELOCATION & SPONSORSHIP ENHANCEMENT (CRITICAL):
   - Redraft the resume summary / professional statement to highlight the candidate's active flexibility for international relocation, high readiness for global mobility, adaptability to multicultural global teams, and eligibility or preparedness for international visa sponsorship.
   - Position them as a highly mobile talent asset ready to relocate immediately, without fabricating any credentials.
` : ""}

Input Data:
- Target Language: ${targetLang}
- Job Description / Post Details:
${jobDescription || "Not provided directly, please refer to Job URL details"}
${fetchedJobDetails ? `\n- Retrieved Job Posting Details from URL:\n${fetchedJobDetails}` : ""}
${jobUrl ? `- Job URL: ${jobUrl}` : ""}

- Master Resume:
${JSON.stringify(masterResume, null, 2)}
`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        tailoredResume: {
          type: Type.OBJECT,
          description: "The fully updated resume tailored and translated if necessary.",
          properties: {
            contact: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                title: { type: Type.STRING, description: "Professional title aligned with target job" },
                email: { type: Type.STRING },
                phone: { type: Type.STRING },
                location: { type: Type.STRING },
                linkedin: { type: Type.STRING },
                website: { type: Type.STRING }
              },
              required: ["name", "title", "email", "phone", "location"]
            },
            summary: { type: Type.STRING, description: "Professional summary optimized for the job, including key target keywords." },
            experience: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  company: { type: Type.STRING },
                  role: { type: Type.STRING },
                  location: { type: Type.STRING },
                  startDate: { type: Type.STRING },
                  endDate: { type: Type.STRING },
                  bullets: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Highly optimized experience bullets starting with strong action verbs and including exact keywords."
                  }
                },
                required: ["company", "role", "startDate", "endDate", "bullets"]
              }
            },
            skills: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING, description: "Skill category name (e.g., Programming, Soft Skills)" },
                  items: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ["category", "items"]
              }
            },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  institution: { type: Type.STRING },
                  degree: { type: Type.STRING },
                  location: { type: Type.STRING },
                  graduationDate: { type: Type.STRING },
                  gpa: { type: Type.STRING }
                },
                required: ["institution", "degree", "graduationDate"]
              }
            },
            certifications: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  issuer: { type: Type.STRING },
                  date: { type: Type.STRING }
                },
                required: ["name"]
              }
            },
            projects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  technologies: { type: Type.ARRAY, items: { type: Type.STRING } },
                  link: { type: Type.STRING }
                },
                required: ["name", "description"]
              }
            },
            languages: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["contact", "summary", "experience", "skills", "education"]
        },
        optimizationSummary: { type: Type.STRING, description: "A detailed summary of how the resume was tailored, what keywords were mapped, and structural fixes applied." },
        readabilityAnalysis: {
          type: Type.OBJECT,
          description: "Readability, style, and clarity analysis specifically for the provided Master Resume.",
          properties: {
            styleClarityScore: { type: Type.INTEGER, description: "Style and clarity score (0-100)" },
            readabilityLevel: { type: Type.STRING, description: "E.g., Grade 10 - Standard Professional, Grade 15 - Wordy, etc." },
            wordCount: { type: Type.INTEGER, description: "Word count of the master resume" },
            sentenceComplexity: { type: Type.STRING, description: "Must be 'simple', 'balanced', or 'complex'" },
            improvements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 clear suggestions to improve style/clarity" },
            strongPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 highlights where style is exceptional" },
            clicheCount: { type: Type.INTEGER, description: "Number of generic/cliché buzzwords found" },
            passiveVoiceInstances: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Up to 3 exact passive-voice phrases" }
          },
          required: ["styleClarityScore", "readabilityLevel", "wordCount", "sentenceComplexity", "improvements", "strongPoints", "clicheCount", "passiveVoiceInstances"]
        }
      },
      required: ["tailoredResume", "optimizationSummary", "readabilityAnalysis"]
    };

    const response = await generateContentWithRetry({
      model: model || "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: `You are an expert executive ATS resume analyzer and CV translation machine. Your goal is to maximize ATS keyword density and structure while translating to English/French perfectly. Output valid JSON adhering precisely to the specified schema.`,
      },
      aiConfig
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No output generated from Gemini API");
    }

    // Parse safety check
    const data = safeJsonParse(textOutput);

    // ATS score, keyword coverage, and formatting checks are computed
    // deterministically from the actual resume/job text (server/scoring.ts)
    // rather than asked of the model, so the reported "before -> after"
    // delta is real instead of a prompt instruction to always improve.
    const scoring = computeTailorScoring(
      masterResume,
      data.tailoredResume,
      `${jobDescription || ""} ${fetchedJobDetails || ""}`.trim()
    );
    data.atsScoreBefore = scoring.atsScoreBefore;
    data.atsScoreAfter = scoring.atsScoreAfter;
    data.keywords = scoring.keywords;
    data.formattingChecks = scoring.formattingChecks;

    // The prompt asks the model not to invent credentials; this verifies it.
    data.fabricationFlags = detectFabrications(masterResume, data.tailoredResume);

    res.json(data);

  } catch (error: any) {
    console.error("Tailor Resume error:", error);
    res.status(500).json({ error: error.message || "An error occurred during resume tailoring" });
  }
});

// REST API endpoint to generate a cover letter
app.post("/api/cover-letter", standardAiLimiter, requireServerKey, validateBody(schemas.coverLetterSchema), async (req, res) => {
  try {
    const { tailoredResume, jobDescription, language, model, aiConfig } = req.body;

    if (!tailoredResume) {
      return res.status(400).json({ error: "Tailored resume is required" });
    }
    if (!jobDescription) {
      return res.status(400).json({ error: "Job description is required" });
    }

    const targetLang = language === 'fr' ? 'French' : 'English';

    let prompt = `
You are an elite career coach, ATS expert, and executive resume copywriter.
Your task is to generate a professional, high-impact, and ATS-optimized cover letter template that perfectly matches the user's tailored resume and the target job description.

Strict Rules:
1. MATCH DETAILS: Extract facts solely from the provided Tailored Resume. Do NOT fabricate any experiences, credentials, degrees, skills, or achievements.
2. ATS OPTIMIZATION: Write with highly relevant keywords from the job description seamlessly integrated into the narrative.
3. STRUCTURE: Include a professional Subject Line, formal Salutation, an attention-grabbing Introduction, 2-3 detailed Body Paragraphs highlighting relevant achievements (using quantified metrics if present), a professional Conclusion with a proactive interview call-to-action, a formal Sign-off, and the Sender's name.
4. TRANSLATION / LANGUAGE: The cover letter must be written entirely in ${targetLang}.
5. TONAL PAIRING: Keep the tone highly professional, confident, and persuasive.

Input Data:
- Target Language: ${targetLang}
- Job Description:
${jobDescription}

- Tailored Resume:
${JSON.stringify(tailoredResume, null, 2)}
`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        subject: { type: Type.STRING, description: "The professional subject line of the cover letter, including job title and company if known." },
        recipientCompany: { type: Type.STRING, description: "The name of the target company, or 'Hiring Team' if not found." },
        recipientName: { type: Type.STRING, description: "The recipient's name (e.g. 'Hiring Manager' or 'Hiring Team' or specific person if mentioned in job description)." },
        salutation: { type: Type.STRING, description: "The formal salutation, e.g. 'Dear Hiring Manager,' or 'Dear [Company Name] Hiring Team,'" },
        introduction: { type: Type.STRING, description: "Introductory paragraph introducing yourself, stating the role you are applying for, and showing enthusiasm." },
        bodyParagraphs: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "2 to 3 paragraphs detailing specific achievements, credentials, and matching skills from the resume that align with the job requirements."
        },
        conclusion: { type: Type.STRING, description: "Concluding paragraph with a call to action, thanking the team, and expressing enthusiasm for an interview." },
        signOff: { type: Type.STRING, description: "The formal sign-off, e.g. 'Sincerely,' or 'Best regards,'" },
        senderName: { type: Type.STRING, description: "Full name of the sender from the resume" }
      },
      required: ["subject", "recipientCompany", "recipientName", "salutation", "introduction", "bodyParagraphs", "conclusion", "signOff", "senderName"]
    };

    const response = await generateContentWithRetry({
      model: model || "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: `You are an expert executive ATS career advisor and cover letter generator. Output valid JSON adhering precisely to the specified schema in ${targetLang}.`,
      },
      aiConfig
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No output generated from Gemini API");
    }

    const data = safeJsonParse(textOutput);
    res.json(data);

  } catch (error: any) {
    console.error("Generate Cover Letter error:", error);
    res.status(500).json({ error: error.message || "An error occurred during cover letter generation" });
  }
});

// REST API endpoint to parse PDF or DOCX resume using Gemini
app.post("/api/parse-resume", standardAiLimiter, requireServerKey, validateBody(schemas.parseResumeSchema), async (req, res) => {
  try {
    const { base64Data, fileType, model, aiConfig } = req.body;

    if (!base64Data) {
      return res.status(400).json({ error: "File data (base64) is required" });
    }
    if (!fileType || (fileType !== "pdf" && fileType !== "docx")) {
      return res.status(400).json({ error: "Invalid or unsupported file type. Supported: pdf, docx" });
    }

    // The shared schema for structured resume data
    const resumeResponseSchema = {
      type: Type.OBJECT,
      properties: {
        contact: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            title: { type: Type.STRING },
            email: { type: Type.STRING },
            phone: { type: Type.STRING },
            location: { type: Type.STRING },
            linkedin: { type: Type.STRING },
            website: { type: Type.STRING }
          },
          required: ["name", "title", "email", "phone", "location"]
        },
        summary: { type: Type.STRING },
        experience: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              company: { type: Type.STRING },
              role: { type: Type.STRING },
              location: { type: Type.STRING },
              startDate: { type: Type.STRING },
              endDate: { type: Type.STRING },
              bullets: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["company", "role", "location", "startDate", "endDate", "bullets"]
          }
        },
        skills: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              items: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["category", "items"]
          }
        },
        education: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              institution: { type: Type.STRING },
              degree: { type: Type.STRING },
              location: { type: Type.STRING },
              graduationDate: { type: Type.STRING },
              gpa: { type: Type.STRING }
            },
            required: ["institution", "degree", "location", "graduationDate"]
          }
        },
        certifications: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              issuer: { type: Type.STRING },
              date: { type: Type.STRING }
            },
            required: ["name", "issuer", "date"]
          }
        },
        projects: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              technologies: { type: Type.ARRAY, items: { type: Type.STRING } },
              link: { type: Type.STRING }
            },
            required: ["name", "description"]
          }
        },
        languages: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      },
      required: ["contact", "summary", "experience", "skills", "education"]
    };

    let response;

    if (fileType === "pdf") {
      response = await generateContentWithRetry({
        model: model || "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: "application/pdf"
            }
          },
          {
            text: "Parse this PDF resume and map all details into the specified structured JSON format representing a professional CV."
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: resumeResponseSchema,
          systemInstruction: "You are an elite, highly precise multi-lingual resume parsing engine. Extract contact info, summary, experience, skills, and education into the required structured JSON format. Ensure experience bullets are parsed as separate elements in the bullets array. Do not invent details; extract only what is written."
        },
        aiConfig
      });
    } else {
      const buffer = Buffer.from(base64Data, 'base64');
      const { value: extractedText } = await mammoth.extractRawText({ buffer });

      if (!extractedText || extractedText.trim().length === 0) {
        return res.status(400).json({ error: "Could not extract any readable text from the DOCX file." });
      }

      response = await generateContentWithRetry({
        model: model || "gemini-3.5-flash",
        contents: `Parse this plain text resume and map all details into the specified structured JSON format representing a professional CV:\n\n${extractedText}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: resumeResponseSchema,
          systemInstruction: "You are an elite, highly precise multi-lingual resume parsing engine. Extract contact info, summary, experience, skills, and education into the required structured JSON format. Ensure experience bullets are parsed as separate elements in the bullets array. Do not invent details; extract only what is written."
        },
        aiConfig
      });
    }

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No output generated from Gemini API");
    }

    const data = safeJsonParse(textOutput);
    res.json(data);

  } catch (error: any) {
    console.error("Parse Resume error:", error);
    res.status(500).json({ error: error.message || "An error occurred during resume parsing." });
  }
});

// REST API endpoint to run a deep search for jobs using Gemini and Google Search Grounding
app.post("/api/jobs-deep-search", expensiveAiLimiter, requireServerKey, validateBody(schemas.jobsDeepSearchSchema), async (req, res) => {
  try {
    const { query, location, masterResume, useResume, supportsRelocation, jobType, salaryExpectation, remoteStatus, model, aiConfig } = req.body;

    let searchQueryStr = query;
    let searchLocationStr = location;

    // Set immediate fallbacks from master resume fields if useResume is enabled
    if (useResume && masterResume) {
      if (!searchQueryStr || searchQueryStr === "Dynamic Title") {
        searchQueryStr = masterResume.contact?.title || (masterResume.experience?.[0]?.role) || "Software Engineer";
      }
      if (!searchLocationStr || searchLocationStr === "Remote" || searchLocationStr === "") {
        searchLocationStr = masterResume.contact?.location || "Remote";
      }
    }

    // If useResume is active, automatically analyze the master resume to extract the best target title and location
    if (useResume && masterResume) {
      try {
        const analysisPrompt = `Analyze this master resume and the user's requested search parameters to formulate the absolute best job search terms:
1. An optimal, highly-relevant, concise job search query targeting active postings (e.g., "Senior Software Engineer" or "React Developer"). Use the user's input query "${query || ''}" as a strong guideline/starting point if provided.
2. The preferred job search location. Use the user's input location "${location || ''}" as a strong guideline/starting point if provided.

Resume:
${JSON.stringify(masterResume, null, 2)}

Output your response as a JSON object matching: {"query": "string", "location": "string"}`;

        const analysisResponse = await generateContentWithRetry({
          model: model || "gemini-3.5-flash",
          contents: analysisPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                query: { type: Type.STRING },
                location: { type: Type.STRING }
              },
              required: ["query", "location"]
            }
          },
          aiConfig
        });
        
        const extracted = safeJsonParse(analysisResponse.text);
        if (extracted.query) searchQueryStr = extracted.query;
        if (extracted.location) searchLocationStr = extracted.location;
        console.log(`Auto-generated search parameters from resume: Query="${searchQueryStr}", Location="${searchLocationStr}"`);
      } catch (err) {
        console.error("Resume pre-analysis for deep search failed, using fallback inputs:", err);
      }
    }

    if (!searchQueryStr) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const relocationClause = supportsRelocation 
      ? " that support or offer relocation assistance, visa sponsorship, or relocation packages" 
      : "";

    const jobTypeClause = jobType && jobType !== "Any" ? ` for ${jobType} positions` : "";
    const salaryClause = salaryExpectation && salaryExpectation !== "Any" ? ` with a salary of at least ${salaryExpectation}` : "";
    const remoteClause = remoteStatus && remoteStatus !== "Any" ? ` that are ${remoteStatus}` : "";

    console.log(`[Gemini] Performing web-grounded job search for "${searchQueryStr}" in "${searchLocationStr}"${supportsRelocation ? ' with relocation assistance' : ''}${jobTypeClause}${salaryClause}${remoteClause}...`);
    const rawSearchResponse = await generateContentWithRetry({
      model: model || "gemini-3.5-flash",
      contents: `Search for active, real job postings matching query "${searchQueryStr}" in location "${searchLocationStr}"${relocationClause}${jobTypeClause}${salaryClause}${remoteClause}. Find 4-6 highly relevant postings. For each, extract the Job Title, Company Name, Location, URL, a brief summary of requirements/description (explicitly highlighting any relocation support or visa sponsorship if applicable), and Source (e.g. LinkedIn, company site).`,
      config: {
        systemInstruction: "You are an expert real-time career intelligence agent. Use the Google Search tool to search for real, current, live job listings and extract precise details including company, title, location, description, URL, and source.",
        tools: [{ googleSearch: {} }]
      },
      aiConfig
    });

    const searchRawText = rawSearchResponse.text || "";
    console.log(`[Gemini] Retrieved search results. Parsing into structured JSON format...`);

    const response = await generateContentWithRetry({
      model: model || "gemini-3.5-flash",
      contents: `Parse the following raw web search job listings into a structured JSON array of jobs conforming to the schema:\n\n${searchRawText}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            jobs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  company: { type: Type.STRING },
                  location: { type: Type.STRING },
                  url: { type: Type.STRING },
                  description: { type: Type.STRING },
                  source: { type: Type.STRING },
                  relocationOffered: { type: Type.BOOLEAN, description: "True if relocation support, relocation package, or visa sponsorship is mentioned in the posting, otherwise false" },
                  visaSupport: { type: Type.STRING, description: "Description or specifics of relocation/visa support offered (e.g. 'Visa sponsorship provided', 'Relocation allowance', etc.), or empty string if none" }
                },
                required: ["title", "company", "location", "url", "description", "source", "relocationOffered", "visaSupport"]
              }
            }
          },
          required: ["jobs"]
        },
        systemInstruction: "You are a precise data parsing agent. Extract the list of job postings from the text and output a strictly valid JSON object conforming to the response schema. If any URLs or details are missing in the input text, construct reasonable, accurate placeholders based on the context. Ensure URLs are real or synthesized accurately."
      },
      aiConfig
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No output generated from Gemini API");
    }

    const data = safeJsonParse(textOutput);
    res.json({
      ...data,
      autoQuery: searchQueryStr,
      autoLocation: searchLocationStr
    });

  } catch (error: any) {
    console.error("Jobs deep search error:", error);
    res.status(500).json({ error: error.message || "An error occurred during jobs deep search" });
  }
});

// REST API endpoint to improve an individual resume achievement bullet point using Gemini AI
app.post("/api/improve-bullet", standardAiLimiter, requireServerKey, validateBody(schemas.improveBulletSchema), async (req, res) => {
  try {
    const { bulletText, jobDescription, model, aiConfig } = req.body;

    if (!bulletText) {
      return res.status(400).json({ error: "Bullet text is required" });
    }

    const prompt = `Rewrite this resume achievement bullet point to be highly professional, impactful, and optimized for ATS systems.
Follow the STAR methodology (Situation, Task, Action, Result) and start with a strong action verb (e.g., Designed, Spearheaded, Engineered, Orchestrated, Optimized).
Include placeholders for quantifiable metrics (e.g. '[X]%' or '$[Y]') to encourage data-driven outcomes if none exist.

Original bullet point: "${bulletText}"
${jobDescription ? `Context of the target job description:\n"${jobDescription}"` : ''}

Generate exactly 3 diverse, polished alternative options. Output in JSON matching the specified responseSchema.`;

    const response = await generateContentWithRetry({
      model: model || "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["suggestions"]
        },
        systemInstruction: "You are an elite executive resume copywriter and career coach. Your task is to craft high-impact resume achievement bullet points that prove value, utilize strong action verbs, and integrate key keywords."
      },
      aiConfig
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No output generated from Gemini API");
    }

    const data = safeJsonParse(textOutput);
    res.json(data);

  } catch (error: any) {
    console.error("Improve bullet error:", error);
    res.status(500).json({ error: error.message || "An error occurred during bullet point improvement" });
  }
});

function findLocalChromeOrEdgePath(): string | null {
  const platform = os.platform();
  
  if (platform === "win32") {
    const paths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === "darwin") {
    const paths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === "linux") {
    const paths = [
      "/usr/bin/google-chrome",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/microsoft-edge",
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

// REST API endpoint to generate ATS-safe PDF
app.post("/api/generate-pdf", expensiveAiLimiter, requireServerKey, validateBody(schemas.generatePdfSchema), async (req, res) => {
  try {
    const { htmlContent } = req.body;
    if (!htmlContent) {
      return res.status(400).json({ error: "htmlContent is required" });
    }

    const localPath = findLocalChromeOrEdgePath();
    let browser;
    if (localPath) {
      console.log(`[PDF Generator] Using discovered local browser executable: ${localPath}`);
      browser = await puppeteer.launch({
        executablePath: localPath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
        headless: true
      });
    } else {
      console.log(`[PDF Generator] No local browser discovered. Falling back to @sparticuz/chromium.`);
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: (chromium as any).defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: (chromium as any).headless,
      });
    }

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' as any });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    });
    await browser.close();
    
    res.contentType("application/pdf");
    res.send(Buffer.from(pdfBuffer));
  } catch (error: any) {
    console.error("PDF generation error:", error);
    res.status(500).json({ error: error.message || "An error occurred during PDF generation" });
  }
});

// REST API endpoint to generate interview preparation questions & strategies using Gemini AI
app.post("/api/interview-prep", standardAiLimiter, requireServerKey, validateBody(schemas.interviewPrepSchema), async (req, res) => {
  try {
    const { resumeData, jobDescription, model, aiConfig } = req.body;

    if (!resumeData) {
      return res.status(400).json({ error: "Resume data is required" });
    }
    if (!jobDescription) {
      return res.status(400).json({ error: "Job description is required" });
    }

    const prompt = `You are an elite executive interview coach.
Your task is to analyze the provided "Resume Data" and "Job Description" to generate 6 highly tailored, realistic, and challenging interview questions (2 Behavioral, 2 Technical, and 2 Situational/Role-specific).

For each question, you MUST formulate:
1. question: The actual question they are likely to ask.
2. type: The type of question (must be either 'behavioral', 'technical', or 'situational').
3. intent: The underlying reason or motivation why the interviewer is asking this question (what they are testing).
4. starStrategy: A step-by-step guideline on how the candidate should structure their response using the STAR (Situation, Task, Action, Result) methodology.
5. sampleAnswer: A complete, highly impactful model answer that references the candidate's actual work experience, skills, or projects from their resume.
6. prepTips: A quick actionable advice point for this specific question.

Candidate's Resume:
${JSON.stringify(resumeData, null, 2)}

Target Job Description:
"${jobDescription}"

Provide your output in a structured JSON matching the specified responseSchema. Ensure the sampleAnswer and strategies are professional and detailed.`;

    const response = await generateContentWithRetry({
      model: model || "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  type: { type: Type.STRING },
                  intent: { type: Type.STRING },
                  starStrategy: { type: Type.STRING },
                  sampleAnswer: { type: Type.STRING },
                  prepTips: { type: Type.STRING }
                },
                required: ["question", "type", "intent", "starStrategy", "sampleAnswer", "prepTips"]
              }
            }
          },
          required: ["questions"]
        },
        systemInstruction: "You are an elite interview coach and career strategist. Your goal is to prepare job applicants to ace interviews by providing tailored, highly strategic prep materials."
      },
      aiConfig
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No output generated from Gemini API");
    }

    const data = safeJsonParse(textOutput);
    res.json(data);

  } catch (error: any) {
    console.error("Interview prep generation error:", error);
    res.status(500).json({ error: error.message || "An error occurred during interview prep generation" });
  }
});

// REST API endpoint to analyze draft mock interview answers and provide score and constructive feedback
app.post("/api/interview-feedback", standardAiLimiter, requireServerKey, validateBody(schemas.interviewFeedbackSchema), async (req, res) => {
  try {
    const { question, userAnswer, jobDescription, model, aiConfig } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }
    if (!userAnswer) {
      return res.status(400).json({ error: "User answer is required" });
    }

    const prompt = `You are an expert executive interview coach.
Analyze the user's draft response to this specific interview question:
Question: "${question}"
User's Answer: "${userAnswer}"
${jobDescription ? `Context of the target job description:\n"${jobDescription}"` : ''}

Provide your feedback in structured JSON matching the specified responseSchema:
1. score: A realistic rating of the response from 0 to 100 based on STAR structure, relevance, professionalism, and persuasiveness.
2. strongPoints: An array of 2-3 aspects the user nailed.
3. areasToImprove: An array of 2-3 specific recommendations on what is missing or can be phrased better.
4. suggestedRefinement: A polished, optimized version of their draft response incorporating the feedback, keeping their original voice and experiences but restructuring it using the STAR methodology.`;

    const response = await generateContentWithRetry({
      model: model || "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            strongPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            areasToImprove: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            suggestedRefinement: { type: Type.STRING }
          },
          required: ["score", "strongPoints", "areasToImprove", "suggestedRefinement"]
        },
        systemInstruction: "You are a professional executive interview coach providing positive, constructive, and highly actionable response assessments."
      },
      aiConfig
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No output generated from Gemini API");
    }

    const data = safeJsonParse(textOutput);
    res.json(data);

  } catch (error: any) {
    console.error("Interview feedback error:", error);
    res.status(500).json({ error: error.message || "An error occurred during interview feedback generation" });
  }
});

// REST API endpoint to suggest networking opportunities adapted for the role and CV
app.post("/api/networking-suggestions", standardAiLimiter, requireServerKey, validateBody(schemas.networkingSuggestionsSchema), async (req, res) => {
  try {
    const { tailoredResume, jobDescription, model, aiConfig } = req.body;
    if (!tailoredResume) {
      return res.status(400).json({ error: "Tailored resume is required" });
    }

    const prompt = `You are an elite career development and corporate networking strategist.
Analyze the candidate's Tailored Resume and the target Job Description (if available) to suggest 4 highly targeted, realistic networking opportunities, customized specifically to their background, industry, and role.

For each networking opportunity, provide:
1. title: A catchy and descriptive name of the networking opportunity (e.g. "Connect with Senior Engineering Managers", "TypeScript & React London Community Outreach").
2. category: Must be one of: "LinkedIn Outreach", "Industry Events", "Local Meetups", "Online Communities", or "Professional Associations".
3. targetAudience: Specific description of the people, groups, or venues to look for (e.g. "DevOps Leads in FinTech at scale-ups in London", "The local chapter of Project Management Institute").
4. relevanceExplanation: A custom, highly relevant, 1-2 sentence explanation of why this is perfect for the candidate based on their specific skills or experiences (e.g., "Given your strong history in React and Docker, connecting with container-focused frontend leads can unlock hidden roles.").
5. approachStrategy: Concrete, step-by-step advice on how to start the interaction or make contact (e.g. "Search on LinkedIn for people at target companies with this exact title, send a customized invite, and ask for a 15-minute virtual coffee chat.").
6. outreachTemplate: A fully composed, ready-to-use outreach message or email template (approx 100-150 words). It MUST be customized to include references to the candidate's actual projects or skills from their resume (e.g. referencing their experience at their actual previous company, their specific tech stack, etc.), with brackets like [Contact Name] or [Target Company] where they should insert recipient details. It must feel authentic, polite, and low-pressure.

Candidate's Resume:
${JSON.stringify(tailoredResume, null, 2)}

${jobDescription ? `Target Job Description:\n"${jobDescription}"` : ""}

Generate valid JSON adhering strictly to the response schema.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        suggestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              targetAudience: { type: Type.STRING },
              relevanceExplanation: { type: Type.STRING },
              approachStrategy: { type: Type.STRING },
              outreachTemplate: { type: Type.STRING }
            },
            required: ["title", "category", "targetAudience", "relevanceExplanation", "approachStrategy", "outreachTemplate"]
          }
        },
        executiveSummary: { type: Type.STRING, description: "A high-level overview of the networking strategy for this specific candidate." }
      },
      required: ["suggestions", "executiveSummary"]
    };

    const response = await generateContentWithRetry({
      model: model || "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: "You are an elite career development strategist. Output valid JSON adhering precisely to the specified schema."
      },
      aiConfig
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No output generated from Gemini API");
    }

    const data = safeJsonParse(textOutput);
    res.json(data);

  } catch (error: any) {
    console.error("Networking suggestions error:", error);
    res.status(500).json({ error: error.message || "An error occurred during networking suggestions generation" });
  }
});

// REST API endpoint to parse email messages to find interview invitations
app.post("/api/parse-email-interview", standardAiLimiter, requireServerKey, validateBody(schemas.parseEmailInterviewSchema), async (req, res) => {
  try {
    const { emailSnippet, emailBody, model, aiConfig } = req.body;
    if (!emailBody && !emailSnippet) {
      return res.status(400).json({ error: "Email body or snippet is required" });
    }

    const prompt = `You are an expert AI recruiting coordinator and administrative virtual assistant.
Analyze this email message snippet and body to determine if it is an active job interview invitation, schedule request, or call scheduler (like Calendly, Google Meet, Zoom invite, or technical test schedule).

Email Snippet: "${emailSnippet || ''}"
Email Body: "${emailBody || ''}"

If it is an interview invite, extract the structured details. If you cannot find a specific field, do not make it up, but estimate the best default based on context (e.g. if job title is not explicitly named but company is, state the company and general role name if implied).
For the interviewDate, if the email lists multiple time options or a scheduling link, estimate the most reasonable date or leave it empty, or suggest the scheduling link as notes.
Always output valid JSON in the exact schema specified.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        isInterviewInvite: { type: Type.BOOLEAN, description: "True if the email is a request to schedule or an active invitation for a job interview, screen, test, or virtual meet." },
        company: { type: Type.STRING, description: "The name of the hiring company. If not found, use empty string." },
        role: { type: Type.STRING, description: "The job role or title. If not found, use empty string." },
        interviewType: { type: Type.STRING, description: "Type of interview (e.g. HR Phone Screen, Technical Interview, System Design, Cultural Fit, or Panel Interview). If unknown, use empty string." },
        interviewDate: { type: Type.STRING, description: "If a specific date/time is confirmed, extract it in YYYY-MM-DD format. If multiple slots or Calendly link is offered, use empty string." },
        interviewTime: { type: Type.STRING, description: "If a specific time is confirmed, extract it (e.g. '14:00 GMT' or '10:00 AM EST'). Otherwise use empty string." },
        meetingLink: { type: Type.STRING, description: "Any video call or scheduling link found (e.g., Google Meet, Zoom, Teams, Calendly). If none, use empty string." },
        summaryNotes: { type: Type.STRING, description: "A concise 2-3 sentence summary of the email instructions (e.g. 'Hiring manager wants to schedule a 30m phone chat. Please click the Calendly link to select a time')." }
      },
      required: ["isInterviewInvite", "company", "role", "interviewType", "interviewDate", "interviewTime", "meetingLink", "summaryNotes"]
    };

    const response = await generateContentWithRetry({
      model: model || "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: "You are an expert recruitment assistant. Output valid JSON adhering precisely to the specified schema."
      },
      aiConfig
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No output generated from Gemini API");
    }

    const data = safeJsonParse(textOutput);
    res.json(data);

  } catch (error: any) {
    console.error("Parse email interview error:", error);
    res.status(500).json({ error: error.message || "An error occurred during email parsing" });
  }
});

// ==========================================
// LINKEDIN OAUTH INTEGRATION ENDPOINTS
// ==========================================

// 1. Get Authorization URL (handles both sandbox and real LinkedIn OAuth flow)
app.get('/api/auth/linkedin/url', (req, res) => {
  // Use custom or default redirect URI
  const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/auth/linkedin/callback`;
  const clientId = req.query.client_id ? String(req.query.client_id).trim() : (process.env.LINKEDIN_CLIENT_ID || '');
  const clientSecret = req.query.client_secret ? String(req.query.client_secret).trim() : (process.env.LINKEDIN_CLIENT_SECRET || '');

  // Package client_id and client_secret in state parameter to retrieve upon callback redirect
  const stateObj = {
    csrf: 'linkedin_state_ats_tailor',
    client_id: clientId,
    client_secret: clientSecret
  };
  const stateStr = Buffer.from(JSON.stringify(stateObj)).toString('base64');

  if (clientId && clientId !== '') {
    // Construct real LinkedIn OAuth 2.0 authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state: stateStr,
      scope: 'w_member_social r_liteprofile', // standard permissions
    });
    res.json({
      url: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
      isSandbox: false
    });
  } else {
    // If client ID is missing, fall back to our beautifully crafted interactive sandbox flow
    const params = new URLSearchParams({
      redirect_uri: redirectUri,
      state: stateStr,
    });
    res.json({
      url: `/auth/linkedin/sandbox?${params.toString()}`,
      isSandbox: true
    });
  }
});

// 2. Sandbox OAuth mock page (interactive LinkedIn authorization simulator)
app.get('/auth/linkedin/sandbox', (req, res) => {
  const { redirect_uri, state } = req.query;
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Authorize ATS Resume Tailor on LinkedIn</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          body { font-family: 'Inter', sans-serif; }
        </style>
      </head>
      <body class="bg-[#f3f2ef] flex items-center justify-center min-h-screen">
        <div class="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full border border-[#dad8d4] mx-4 transition-all hover:shadow-2xl">
          <!-- Header -->
          <div class="flex justify-between items-center mb-6">
            <img src="https://upload.wikimedia.org/wikipedia/commons/0/01/LinkedIn_Logo.svg" alt="LinkedIn" class="h-6">
            <span class="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Sandbox Mode</span>
          </div>
          
          <!-- App Connection Visualization -->
          <div class="flex flex-col items-center text-center mb-6">
            <div class="flex items-center justify-center space-x-5">
              <div class="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-md border border-indigo-500">
                AI
              </div>
              <div class="flex flex-col items-center">
                <i class="fa-solid fa-arrow-right-arrow-left text-slate-400 text-lg animate-pulse"></i>
              </div>
              <div class="w-14 h-14 rounded-full bg-[#0a66c2] text-white flex items-center justify-center text-2xl shadow-md">
                <i class="fa-brands fa-linkedin-in"></i>
              </div>
            </div>
            
            <div class="mt-4">
              <h2 class="text-base font-extrabold text-[#191919]">ATS Resume Tailor Pro</h2>
              <p class="text-xs text-[#666666] mt-1.5 px-2 leading-relaxed">
                wants permission to view your basic professional identity and share achievements directly to your professional network.
              </p>
            </div>
          </div>

          <!-- Scope List -->
          <div class="border-t border-b border-[#f0eee9] py-4 mb-6 space-y-3.5">
            <h3 class="text-[10px] font-extrabold text-[#666666] uppercase tracking-wider">Requested Access:</h3>
            <div class="flex items-start space-x-3 text-xs">
              <div class="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <i class="fa-regular fa-user"></i>
              </div>
              <div>
                <p class="font-bold text-[#191919]">Personal Profile Data</p>
                <p class="text-[#666666] text-[10px] mt-0.5">Use your name, current title, and photo to customize sharing card designs.</p>
              </div>
            </div>
            <div class="flex items-start space-x-3 text-xs">
              <div class="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <i class="fa-solid fa-square-rss"></i>
              </div>
              <div>
                <p class="font-bold text-[#191919]">Publish Social Updates</p>
                <p class="text-[#666666] text-[10px] mt-0.5">Share tailored summaries, scores, and accomplishments on your LinkedIn feed.</p>
              </div>
            </div>
          </div>

          <!-- Active Sandbox profile selection -->
          <div class="mb-6 space-y-2">
            <label class="block text-[10px] font-extrabold text-[#666666] uppercase tracking-wider">Select Mock Profile to Connect:</label>
            <select id="profile-select" class="w-full bg-slate-50 dark:bg-slate-800 border border-[#dad8d4] text-xs font-semibold rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800" onchange="updateProfilePreview()">
              <option value="tech">Alex Mercer (Senior Software Engineer)</option>
              <option value="biz">Sophia Chen (Lead Product Manager)</option>
              <option value="creative">Marcus Vance (Creative Director & UI/UX Designer)</option>
              <option value="custom">Use my Tailored Resume Profile</option>
            </select>
            
            <div class="flex items-center space-x-3 border border-slate-100 p-2.5 rounded-xl bg-slate-50/50 mt-2">
              <img id="profile-pic" src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face" alt="Avatar" class="w-10 h-10 rounded-full object-cover border-2 border-indigo-100">
              <div class="flex-1 min-w-0">
                <p id="profile-name" class="text-xs font-bold text-[#191919] truncate">Alex Mercer</p>
                <p id="profile-title" class="text-[10px] text-[#666666] truncate">Senior Software Engineer at TechCorp</p>
              </div>
              <span class="text-[9px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-extrabold">Active</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="space-y-2">
            <button 
              onclick="approve()"
              class="w-full bg-[#0a66c2] hover:bg-[#004182] text-white font-bold text-xs py-2.5 rounded-full shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <i class="fa-solid fa-circle-check"></i>
              Agree & Connect Account
            </button>
            <button 
              onclick="window.close()"
              class="w-full border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs py-2.5 rounded-full transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
          
          <p class="text-[9px] text-center text-[#999999] mt-4 leading-relaxed">
            Since no custom client keys were specified, this simulation acts as a fully compliant mock gateway for your ATS development sandbox.
          </p>
        </div>

        <script>
          const profiles = {
            tech: {
              name: "Alex Mercer",
              title: "Senior Software Engineer at TechCorp",
              pic: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face"
            },
            biz: {
              name: "Sophia Chen",
              title: "Lead Product Manager at FinTech Labs",
              pic: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face"
            },
            creative: {
              name: "Marcus Vance",
              title: "Creative Director & UI/UX Designer",
              pic: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
            },
            custom: {
              name: "Custom Applicant",
              title: "Job Applicant Extraordinaire",
              pic: ""
            }
          };

          function updateProfilePreview() {
            const val = document.getElementById('profile-select').value;
            const profile = profiles[val];
            if (profile) {
              document.getElementById('profile-name').innerText = profile.name;
              document.getElementById('profile-title').innerText = profile.title;
              if (profile.pic) {
                document.getElementById('profile-pic').src = profile.pic;
                document.getElementById('profile-pic').style.display = 'block';
              } else {
                document.getElementById('profile-pic').src = "";
                document.getElementById('profile-pic').style.display = 'none';
              }
            }
          }

          function approve() {
            const selectVal = document.getElementById('profile-select').value;
            const chosen = profiles[selectVal];
            
            const redirectUri = "${redirect_uri}";
            const state = "${state}";
            
            // Build redirect URL
            const url = new URL(redirectUri);
            url.searchParams.set('code', 'MOCK_LINKEDIN_CODE_XYZ');
            url.searchParams.set('state', state);
            url.searchParams.set('sandbox', 'true');
            url.searchParams.set('chosen_name', chosen.name);
            url.searchParams.set('chosen_title', chosen.title);
            url.searchParams.set('chosen_pic', chosen.pic);
            
            window.location.href = url.toString();
          }
        </script>
      </body>
    </html>
  `);
});

// 3. Callback URL (handles exchanging code for tokens and sending result back to the frontend popup window)
app.get(['/api/auth/linkedin/callback', '/api/auth/linkedin/callback/'], async (req, res) => {
  const { code, state, sandbox, chosen_name, chosen_title, chosen_pic } = req.query;

  // 1. Check if sandbox callback is requested
  if (sandbox === 'true' || code === 'MOCK_LINKEDIN_CODE_XYZ') {
    const profileData = {
      name: chosen_name || "Alex Mercer",
      title: chosen_title || "Senior Software Engineer at TechCorp",
      avatarUrl: chosen_pic || "",
      accessToken: "MOCK_LINKEDIN_SANDBOX_TOKEN_ABC",
      isSandbox: true
    };

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>LinkedIn Authentication Success</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 40px; background-color: #f3f2ef; }
            .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); max-w: 360px; margin: auto; }
            h1 { color: #0a66c2; font-size: 20px; }
            p { color: #666; font-size: 14px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>✓ Connection Confirmed!</h1>
            <p>Your sandbox profile has been successfully integrated. Closing this window...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'LINKEDIN_AUTH_SUCCESS', 
                payload: ${JSON.stringify(profileData)} 
              }, '*');
              setTimeout(() => { window.close(); }, 1200);
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
    return;
  }

  // 2. Real OAuth Flow Exchange
  let clientId = process.env.LINKEDIN_CLIENT_ID || '';
  let clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';

  if (state) {
    try {
      const decodedState = JSON.parse(Buffer.from(String(state), 'base64').toString('utf-8'));
      if (decodedState.client_id) {
        clientId = decodedState.client_id;
      }
      if (decodedState.client_secret) {
        clientSecret = decodedState.client_secret;
      }
    } catch (e) {
      console.error("Failed to decode LinkedIn state parameter:", e);
    }
  }

  const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/auth/linkedin/callback`;

  if (!clientId || !clientSecret) {
    res.status(400).send("LinkedIn client credentials are not defined. Please configure them in the Outreach Suite panel or env variables.");
    return;
  }

  try {
    // Exchange Authorization Code for Access Token
    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: redirectUri,
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errText}`);
    }

    const tokenData: any = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch Connected User's Profile Details using modern userinfo standard
    const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      }
    });

    let profileData = {
      name: "LinkedIn Partner",
      title: "LinkedIn Professional",
      avatarUrl: "",
      accessToken: accessToken,
      isSandbox: false
    };

    if (profileResponse.ok) {
      const profile: any = await profileResponse.json();
      profileData.name = `${profile.given_name || ''} ${profile.family_name || ''}`.trim() || "LinkedIn User";
      profileData.avatarUrl = profile.picture || "";
    }

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>LinkedIn Connection Success</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 40px; background-color: #f3f2ef; }
            .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); max-w: 360px; margin: auto; }
            h1 { color: #0a66c2; font-size: 20px; }
            p { color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>✓ LinkedIn Connected</h1>
            <p>Welcome, ${profileData.name}! Synchronizing profile dashboard... Closing shortly.</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'LINKEDIN_AUTH_SUCCESS', 
                payload: ${JSON.stringify(profileData)} 
              }, '*');
              setTimeout(() => { window.close(); }, 1200);
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);

  } catch (err: any) {
    console.error("LinkedIn OAuth Exchange Error:", err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>LinkedIn Authorization Failed</title>
          <style>
            body { font-family: -apple-system, sans-serif; text-align: center; padding: 40px; background-color: #fcf8f8; }
            .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); max-w: 360px; margin: auto; border-top: 4px solid #ef4444; }
            h1 { color: #ef4444; font-size: 20px; }
            p { color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>✕ Authorization Error</h1>
            <p>${err.message || 'Verification token exchange failed'}</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'LINKEDIN_AUTH_FAILURE', 
                error: "${err.message || 'Unknown error during code exchange'}" 
              }, '*');
              setTimeout(() => { window.close(); }, 3000);
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  }
});

// Serve frontend build static files in production
if (process.env.NODE_ENV !== "production") {
  const startViteMiddleware = async () => {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Development Server running on http://localhost:${PORT}`);
    });
  };
  startViteMiddleware();
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Production Server running on port ${PORT}`);
  });
}
