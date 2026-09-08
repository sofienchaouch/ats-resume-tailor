import { describe, it, expect } from 'vitest';
import { jobKey, attachJobIds } from './jobKey';

describe('jobKey', () => {
  it('collapses the same URL differing only by tracking params / trailing slash', () => {
    const a = jobKey({ url: 'https://boards.greenhouse.io/acme/jobs/123?utm_source=x' });
    const b = jobKey({ url: 'https://boards.greenhouse.io/acme/jobs/123/' });
    expect(a).toBe(b);
    expect(a).toBe('u:boards.greenhouse.io/acme/jobs/123');
  });

  it('keeps different URL paths distinct', () => {
    expect(jobKey({ url: 'https://x.com/a' })).not.toBe(jobKey({ url: 'https://x.com/b' }));
  });

  it('falls back to company::title on a malformed URL', () => {
    const k = jobKey({ url: 'not a url', company: 'Acme', title: 'Backend Engineer' });
    expect(k).toBe('ct:acme::backend engineer');
  });

  it('normalizes case and punctuation in company/title to one key', () => {
    const a = jobKey({ company: 'Acme, Inc.', title: 'Senior  Back-End Engineer' });
    const b = jobKey({ company: 'ACME INC', title: 'senior back end engineer' });
    expect(a).toBe(b);
  });

  it('uses a stable description hash when there is no url/company/title', () => {
    const desc = 'We are hiring a platform engineer to own our build system.';
    const a = jobKey({ description: desc });
    const b = jobKey({ description: desc });
    expect(a).toBe(b);
    expect(a.startsWith('d:')).toBe(true);
  });

  it('returns empty string when the job has nothing to key on', () => {
    expect(jobKey({})).toBe('');
  });
});

describe('attachJobIds', () => {
  it('disambiguates two genuinely identical jobs', () => {
    const [a, b] = attachJobIds([
      { company: 'Acme', title: 'Dev' },
      { company: 'Acme', title: 'Dev' },
    ]);
    expect(a.id).toBe('ct:acme::dev');
    expect(b.id).toBe('ct:acme::dev#2');
    expect(a.id).not.toBe(b.id);
  });

  it('assigns an index-based id when a job has nothing to key on', () => {
    const ids = attachJobIds([{}, {}]).map((j) => j.id);
    expect(ids).toEqual(['job:0', 'job:1']);
  });

  it('preserves the original job fields', () => {
    const [only] = attachJobIds([{ company: 'Acme', title: 'Dev', url: 'https://x.com/1' }]);
    expect(only.company).toBe('Acme');
    expect(only.url).toBe('https://x.com/1');
  });
});
