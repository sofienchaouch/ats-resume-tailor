import { describe, it, expect } from 'vitest';
import { resumeToMarkdown, coverLetterToMarkdown, toMarkdownFileName } from './obsidianSync';
import type { ResumeData, CoverLetterData } from '../types';

const resume: ResumeData = {
  contact: {
    name: 'Ada Lovelace',
    title: 'Analytical Engineer',
    email: 'ada@example.com',
    phone: '',
    location: 'London',
  },
  summary: 'Pioneering computing.',
  experience: [
    {
      role: 'Collaborator',
      company: 'Babbage Lab',
      location: 'London',
      startDate: '1842',
      endDate: '1843',
      bullets: ['Wrote the first algorithm', 'Annotated the Menabrea notes'],
    },
  ],
  skills: [{ category: 'Math', items: ['Algorithms', 'Analysis'] }],
  education: [
    { institution: 'Private tutoring', degree: 'Mathematics', location: 'London', graduationDate: '1840' },
  ],
};

describe('resumeToMarkdown', () => {
  it('renders headings, contact line and bullets', () => {
    const md = resumeToMarkdown(resume);
    expect(md).toContain('# Ada Lovelace');
    expect(md).toContain('**Analytical Engineer**');
    expect(md).toContain('## Work Experience');
    expect(md).toContain('### Collaborator @ Babbage Lab');
    expect(md).toContain('- Wrote the first algorithm');
    expect(md).toContain('- **Math**: Algorithms, Analysis');
  });

  it('omits sections that have no data', () => {
    const bare = resumeToMarkdown({ ...resume, experience: [], skills: [], education: [] });
    expect(bare).not.toContain('## Work Experience');
    expect(bare).not.toContain('## Skills');
    expect(bare).not.toContain('## Education');
  });
});

describe('coverLetterToMarkdown', () => {
  it('includes subject, salutation, body and sign-off', () => {
    const cl: CoverLetterData = {
      recipientName: 'Charles Babbage',
      recipientCompany: 'Babbage Lab',
      subject: 'Application for Analytical Engineer',
      salutation: 'Dear Mr Babbage,',
      introduction: 'I write regarding the Engine.',
      bodyParagraphs: ['I have annotated the notes.', 'I can extend the design.'],
      conclusion: 'I would welcome a discussion.',
      signOff: 'Sincerely,',
      senderName: 'Ada Lovelace',
    };
    const md = coverLetterToMarkdown(cl);
    expect(md).toContain('**Subject:** Application for Analytical Engineer');
    expect(md).toContain('Dear Mr Babbage,');
    expect(md).toContain('I have annotated the notes.');
    expect(md).toContain('**Ada Lovelace**');
  });
});

describe('toMarkdownFileName', () => {
  it('slugifies and appends .md', () => {
    expect(toMarkdownFileName('Ada Lovelace resume')).toBe('ada-lovelace-resume.md');
  });
  it('strips punctuation and collapses separators', () => {
    expect(toMarkdownFileName('  Foo/Bar,  Inc.  ')).toBe('foobar-inc.md');
  });
  it('falls back to "note" when empty', () => {
    expect(toMarkdownFileName('!!!')).toBe('note.md');
  });
});
