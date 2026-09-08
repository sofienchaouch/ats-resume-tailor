import { auth } from '../firebase';
import type { RateLimitSnapshot } from './rateBudget';

export interface ApiErrorShape {
  error: string;
  code: string;
  statusCode: number;
}

export class ApiRequestError extends Error {
  code: string;
  statusCode: number;

  constructor(info: ApiErrorShape) {
    super(info.error);
    this.name = 'ApiRequestError';
    this.code = info.code;
    this.statusCode = info.statusCode;
  }
}

export interface ApiFetchOptions {
  /** BYO Gemini/OpenAI-compatible API key, sent as x-gemini-key. */
  apiKey?: string;
  method?: 'GET' | 'POST';
  signal?: AbortSignal;
  /**
   * Called with the server's rate-limit headers when they are present on the
   * response (both 2xx and 429). Lets the tailor queue track the real budget
   * instead of guessing. Never fires for BYO-key users — the server skips the
   * limiter and emits no headers.
   */
  onRateLimitInfo?: (snapshot: RateLimitSnapshot) => void;
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Parses express-rate-limit's `RateLimit-*` draft headers. `RateLimit-Reset` is
 * delta-seconds until the window resets, converted here to an absolute epoch-ms.
 * Returns all-null when the headers are absent.
 */
export function readRateLimitHeaders(headers: Headers, now: number = Date.now()): RateLimitSnapshot {
  const num = (raw: string | null): number | null => {
    if (raw === null) return null;
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  };
  const resetSeconds = num(headers.get('ratelimit-reset'));
  return {
    limit: num(headers.get('ratelimit-limit')),
    remaining: num(headers.get('ratelimit-remaining')),
    resetAtMs: resetSeconds !== null ? now + resetSeconds * 1000 : null,
  };
}

function reportRateLimit(response: Response, options: ApiFetchOptions): void {
  if (!options.onRateLimitInfo) return;
  if (!response.headers.has('ratelimit-limit') && !response.headers.has('ratelimit-remaining')) return;
  options.onRateLimitInfo(readRateLimitHeaders(response.headers));
}

async function buildHeaders(body: unknown, options: ApiFetchOptions): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const idToken = await currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${idToken}`;
    } catch (err) {
      console.error('apiClient: failed to get Firebase ID token', err);
    }
  }

  if (options.apiKey && options.apiKey.trim() !== '') {
    headers['x-gemini-key'] = options.apiKey.trim();
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

async function doFetch(path: string, body: unknown, options: ApiFetchOptions): Promise<Response> {
  const headers = await buildHeaders(body, options);
  const method = options.method ?? (body !== undefined ? 'POST' : 'GET');

  try {
    return await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: options.signal,
    });
  } catch (err: any) {
    if (isAbortError(err)) {
      throw err;
    }
    throw new ApiRequestError({
      error: 'Network request failed. Check your connection and try again.',
      code: 'NETWORK_ERROR',
      statusCode: 0,
    });
  }
}

/**
 * Central fetch wrapper for all JSON /api/* calls.
 * Attaches the signed-in user's Firebase ID token and/or a BYO API key,
 * and normalizes failures to ApiRequestError so callers can branch on `.code`.
 */
export async function apiFetch<T = any>(
  path: string,
  body?: unknown,
  options: ApiFetchOptions = {}
): Promise<T> {
  const response = await doFetch(path, body, options);
  reportRateLimit(response, options);

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON response body; data stays null.
  }

  if (!response.ok) {
    throw new ApiRequestError({
      error: data?.error || `Request failed with status ${response.status}`,
      code: data?.code || 'UNKNOWN_ERROR',
      statusCode: response.status,
    });
  }

  return data as T;
}

/**
 * Same as apiFetch, but for endpoints that return a binary body (e.g. PDF export).
 * On failure, still tries to parse a JSON error body for a useful message.
 */
export async function apiFetchBlob(
  path: string,
  body?: unknown,
  options: ApiFetchOptions = {}
): Promise<Blob> {
  const response = await doFetch(path, body, options);
  reportRateLimit(response, options);

  if (!response.ok) {
    let data: any = null;
    try {
      data = await response.json();
    } catch {
      // Non-JSON error body.
    }
    throw new ApiRequestError({
      error: data?.error || `Request failed with status ${response.status}`,
      code: data?.code || 'UNKNOWN_ERROR',
      statusCode: response.status,
    });
  }

  return response.blob();
}
