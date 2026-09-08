import { describe, it, expect } from 'vitest';
import { buildResumeFileBase, uniqueFileNames, batchZipFileName } from './resumeFileName';

describe('buildResumeFileBase', () => {
  it('builds the full "{name} - resume {role} {company}" form', () => {
    expect(buildResumeFileBase({ name: 'Ada Lovelace', role: 'Staff Engineer', company: 'Acme' }))
      .toBe('Ada Lovelace - resume Staff Engineer Acme');
  });

  it('drops empty segments', () => {
    expect(buildResumeFileBase({ name: 'Ada Lovelace', role: 'Staff Engineer' }))
      .toBe('Ada Lovelace - resume Staff Engineer');
  });

  it('strips filesystem-illegal characters and collapses whitespace', () => {
    expect(buildResumeFileBase({ name: 'A/B\\C', role: 'X: Y | Z', company: '"Q"' }))
      .toBe('ABC - resume X Y Z Q');
  });

  it('falls back to "resume" when the name is blank', () => {
    expect(buildResumeFileBase({ role: 'Dev' })).toBe('resume - resume Dev');
  });
});

describe('uniqueFileNames', () => {
  it('disambiguates repeats with " (n)"', () => {
    expect(uniqueFileNames(['a', 'a', 'b', 'a'])).toEqual(['a', 'a (2)', 'b', 'a (3)']);
  });
  it('leaves a unique list untouched', () => {
    expect(uniqueFileNames(['x', 'y', 'z'])).toEqual(['x', 'y', 'z']);
  });
});

describe('batchZipFileName', () => {
  it('zero-pads the date', () => {
    expect(batchZipFileName(new Date(2026, 0, 5))).toBe('resumes-2026-01-05.zip');
  });
});
