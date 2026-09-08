import { describe, it, expect } from 'vitest';
import { readRateLimitHeaders } from './apiClient';

const T0 = 1_000_000_000_000;

describe('readRateLimitHeaders', () => {
  it('parses the RateLimit-* draft headers, converting Reset to absolute ms', () => {
    const h = new Headers({
      'RateLimit-Limit': '8',
      'RateLimit-Remaining': '3',
      'RateLimit-Reset': '120',
    });
    expect(readRateLimitHeaders(h, T0)).toEqual({
      limit: 8,
      remaining: 3,
      resetAtMs: T0 + 120_000,
    });
  });

  it('returns all-null when the headers are absent', () => {
    expect(readRateLimitHeaders(new Headers(), T0)).toEqual({
      limit: null,
      remaining: null,
      resetAtMs: null,
    });
  });

  it('yields null (never NaN) for garbage header values', () => {
    const h = new Headers({ 'RateLimit-Limit': 'abc', 'RateLimit-Remaining': '', 'RateLimit-Reset': 'x' });
    const snap = readRateLimitHeaders(h, T0);
    expect(snap.limit).toBeNull();
    expect(snap.remaining).toBeNull();
    expect(snap.resetAtMs).toBeNull();
  });

  it('handles remaining 0 as a real value, not missing', () => {
    const h = new Headers({ 'RateLimit-Remaining': '0', 'RateLimit-Reset': '60' });
    const snap = readRateLimitHeaders(h, T0);
    expect(snap.remaining).toBe(0);
    expect(snap.resetAtMs).toBe(T0 + 60_000);
  });
});
