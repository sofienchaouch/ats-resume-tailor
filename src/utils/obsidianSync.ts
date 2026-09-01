import { ResumeData, CoverLetterData } from '../types';

export interface ObsidianSyncMetadata {
  company?: string;
  title?: string;
  atsScore?: number;
}

/** Slugify a string into a safe Markdown filename stem. */
export function toMarkdownFileName(stem: string): string {
  const clean = stem
    .trim()
    .replace(/[^a-z0-9\s-]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
  return `${clean || 'note'}.md`;
}

/**
 * Trigger a client-side download of Markdown text. Drop the file into any
 * Obsidian vault folder (or anywhere else) — no server, no vault path config.
 */
export function downloadMarkdown(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format ResumeData into clean Markdown
 */
export function resumeToMarkdown(resume: ResumeData, metadata?: ObsidianSyncMetadata): string {
  const lines: string[] = [];

  // Header / Contact
  lines.push(`# ${resume.contact.name}`);
  lines.push(`**${resume.contact.title}**`);
  const contactParts: string[] = [];
  if (resume.contact.email) contactParts.push(`📧 ${resume.contact.email}`);
  if (resume.contact.phone) contactParts.push(`📞 ${resume.contact.phone}`);
  if (resume.contact.location) contactParts.push(`📍 ${resume.contact.location}`);
  if (resume.contact.linkedin) contactParts.push(`🔗 [LinkedIn](${resume.contact.linkedin})`);
  if (resume.contact.website) contactParts.push(`🌐 [Portfolio](${resume.contact.website})`);
  lines.push(contactParts.join(' | '));
  lines.push('');

  // Summary
  if (resume.summary) {
    lines.push('## Executive Summary');
    lines.push(resume.summary);
    lines.push('');
  }

  // Experience
  if (resume.experience && resume.experience.length > 0) {
    lines.push('## Work Experience');
    for (const exp of resume.experience) {
      lines.push(`### ${exp.role} @ ${exp.company}`);
      lines.push(`*${exp.startDate} - ${exp.endDate} | ${exp.location}*`);
      if (exp.bullets && exp.bullets.length > 0) {
        for (const bullet of exp.bullets) {
          lines.push(`- ${bullet}`);
        }
      }
      lines.push('');
    }
  }

  // Skills
  if (resume.skills && resume.skills.length > 0) {
    lines.push('## Skills & Core Competencies');
    for (const skillCat of resume.skills) {
      lines.push(`- **${skillCat.category}**: ${skillCat.items.join(', ')}`);
    }
    lines.push('');
  }

  // Education
  if (resume.education && resume.education.length > 0) {
    lines.push('## Education');
    for (const edu of resume.education) {
      lines.push(`- **${edu.degree}** - ${edu.institution} (${edu.graduationDate})${edu.gpa ? ` | GPA: ${edu.gpa}` : ''}`);
    }
    lines.push('');
  }

  // Projects
  if (resume.projects && resume.projects.length > 0) {
    lines.push('## Key Projects');
    for (const proj of resume.projects) {
      lines.push(`### ${proj.name}`);
      lines.push(proj.description);
      if (proj.technologies && proj.technologies.length > 0) {
        lines.push(`*Tech Stack*: ${proj.technologies.join(', ')}`);
      }
      lines.push('');
    }
  }

  // Certifications
  if (resume.certifications && resume.certifications.length > 0) {
    lines.push('## Certifications');
    for (const cert of resume.certifications) {
      lines.push(`- **${cert.name}** - ${cert.issuer} (${cert.date})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format CoverLetterData into clean Markdown
 */
export function coverLetterToMarkdown(cl: CoverLetterData): string {
  const lines: string[] = [];

  lines.push(`# Cover Letter: ${cl.recipientCompany || 'Hiring Team'}`);
  lines.push(`**Subject:** ${cl.subject}`);
  lines.push('');
  lines.push(`**Date:** ${new Date().toLocaleDateString()}`);
  lines.push(`**Recipient:** ${cl.recipientName} (${cl.recipientCompany})`);
  lines.push('');
  lines.push(cl.salutation);
  lines.push('');
  lines.push(cl.introduction);
  lines.push('');

  if (cl.bodyParagraphs && cl.bodyParagraphs.length > 0) {
    for (const para of cl.bodyParagraphs) {
      lines.push(para);
      lines.push('');
    }
  }

  lines.push(cl.conclusion);
  lines.push('');
  lines.push(cl.signOff);
  lines.push(`**${cl.senderName}**`);

  return lines.join('\n');
}

/**
 * Format Interview Prep Questions into clean Markdown study guide
 */
export function interviewPrepToMarkdown(questions: any[], company?: string): string {
  const lines: string[] = [];

  lines.push(`# Interview Prep Study Guide ${company ? `- ${company}` : ''}`);
  lines.push(`*Generated on ${new Date().toLocaleDateString()}*`);
  lines.push('');

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    lines.push(`## Q${i + 1}: ${q.question}`);
    lines.push(`- **Category**: \`${q.type?.toUpperCase() || 'GENERAL'}\``);
    lines.push(`- **Interviewer Intent**: ${q.intent}`);
    lines.push(`- **Actionable Prep Tip**: ${q.prepTips}`);
    lines.push('');
    lines.push(`### STAR Answer Strategy`);
    lines.push(q.starStrategy);
    lines.push('');
    lines.push(`### Recommended Model Answer`);
    lines.push(`> ${q.sampleAnswer.split('\n').join('\n> ')}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

