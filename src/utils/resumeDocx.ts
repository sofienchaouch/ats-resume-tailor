import type { ResumeData } from '../types';

/**
 * Self-contained DOCX builder for the tailor queue's bulk export. Produces a
 * clean, ATS-safe single-column document — deliberately simpler than the styled
 * single-resume export in ResumePreview (which carries layout/section-order
 * options a batch has no UI to set). `docx` is dynamically imported so it stays
 * out of the main bundle.
 */
export async function buildResumeDocxBlob(resume: ResumeData): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import('docx');
  const FONT = 'Arial';

  const heading = (text: string) =>
    new Paragraph({
      spacing: { before: 320, after: 120 },
      children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 24, font: FONT, color: '0f172a' })],
    });

  const line = (text: string, opts: { bold?: boolean; italics?: boolean; size?: number } = {}) =>
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text, font: FONT, size: opts.size ?? 20, bold: opts.bold, italics: opts.italics })],
    });

  const bullet = (text: string) =>
    new Paragraph({
      bullet: { level: 0 },
      spacing: { after: 40 },
      children: [new TextRun({ text, font: FONT, size: 20 })],
    });

  // Paragraph is a runtime binding from the dynamic import, not a usable type.
  const children: any[] = [];
  const c = resume.contact;

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: c.name || '', bold: true, size: 32, font: FONT, color: '0f172a' })],
    })
  );
  if (c.title) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: c.title.toUpperCase(), bold: true, size: 22, font: FONT, color: '4f46e5' })],
      })
    );
  }
  const contact = [c.email, c.phone, c.location, c.linkedin, c.website].filter(Boolean).join('  •  ');
  if (contact) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ text: contact, font: FONT, size: 18, color: '475569' })],
      })
    );
  }

  if (resume.summary?.trim()) {
    children.push(heading('Summary'), line(resume.summary.trim()));
  }

  if (resume.experience?.length) {
    children.push(heading('Experience'));
    for (const exp of resume.experience) {
      children.push(line(`${exp.role || ''}${exp.company ? ` — ${exp.company}` : ''}`, { bold: true }));
      const meta = [exp.location, [exp.startDate, exp.endDate].filter(Boolean).join(' – ')].filter(Boolean).join('  |  ');
      if (meta) children.push(line(meta, { italics: true, size: 18 }));
      for (const b of exp.bullets || []) if (b?.trim()) children.push(bullet(b.trim()));
    }
  }

  if (resume.skills?.length) {
    children.push(heading('Skills'));
    for (const cat of resume.skills) {
      const items = (cat.items || []).filter(Boolean).join(', ');
      if (items) children.push(line(cat.category ? `${cat.category}: ${items}` : items));
    }
  }

  if (resume.education?.length) {
    children.push(heading('Education'));
    for (const ed of resume.education) {
      children.push(line(`${ed.degree || ''}${ed.institution ? ` — ${ed.institution}` : ''}`, { bold: true }));
      const meta = [ed.location, ed.graduationDate, ed.gpa ? `GPA ${ed.gpa}` : ''].filter(Boolean).join('  |  ');
      if (meta) children.push(line(meta, { italics: true, size: 18 }));
    }
  }

  if (resume.projects?.length) {
    children.push(heading('Projects'));
    for (const p of resume.projects) {
      children.push(line(p.name || '', { bold: true }));
      if (p.description?.trim()) children.push(line(p.description.trim()));
      const tech = (p.technologies || []).filter(Boolean).join(', ');
      if (tech) children.push(line(tech, { italics: true, size: 18 }));
      if (p.link) children.push(line(p.link, { size: 18 }));
    }
  }

  if (resume.certifications?.length) {
    children.push(heading('Certifications'));
    for (const cert of resume.certifications) {
      const parts = [cert.name, cert.issuer, cert.date].filter(Boolean).join('  —  ');
      if (parts) children.push(line(parts));
    }
  }

  if (resume.languages?.length) {
    children.push(heading('Languages'), line(resume.languages.filter(Boolean).join(', ')));
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return Packer.toBlob(doc);
}

/** Blob -> object-URL -> synthetic <a> download. Browser-only. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
