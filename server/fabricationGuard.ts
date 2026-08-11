import type { ResumeData, FabricationFlag } from "../src/types";

// The tailoring prompt tells the model not to invent credentials, but a
// prompt instruction is not a guarantee. This checks the model's own
// output: every company, employment date range, degree/institution,
// certification, and project name in the tailored resume must trace back
// to something already in the master resume. Bullet text and job titles
// are exempt — those are meant to be reworded by the tailoring pass.

function normalize(value: string | undefined | null): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function detectFabrications(masterResume: ResumeData, tailoredResume: ResumeData): FabricationFlag[] {
  const flags: FabricationFlag[] = [];

  const masterCompanyDates = new Map<string, { startDate: string; endDate: string }[]>();
  for (const exp of masterResume.experience || []) {
    const key = normalize(exp.company);
    if (!key) continue;
    const list = masterCompanyDates.get(key) || [];
    list.push({ startDate: normalize(exp.startDate), endDate: normalize(exp.endDate) });
    masterCompanyDates.set(key, list);
  }

  for (const exp of tailoredResume.experience || []) {
    const key = normalize(exp.company);
    const masterEntries = masterCompanyDates.get(key);
    if (!masterEntries) {
      flags.push({
        category: "company",
        value: exp.company,
        detail: `"${exp.company}" doesn't appear in the master resume's work history.`,
      });
      continue;
    }
    const datesMatch = masterEntries.some(
      (m) => m.startDate === normalize(exp.startDate) && m.endDate === normalize(exp.endDate)
    );
    if (!datesMatch) {
      flags.push({
        category: "dates",
        value: `${exp.company}: ${exp.startDate} - ${exp.endDate}`,
        detail: `The employment dates for "${exp.company}" don't match any entry in the master resume.`,
      });
    }
  }

  const masterEducation = new Set(
    (masterResume.education || []).map((e) => `${normalize(e.institution)}|${normalize(e.degree)}`)
  );
  for (const edu of tailoredResume.education || []) {
    const key = `${normalize(edu.institution)}|${normalize(edu.degree)}`;
    if (!masterEducation.has(key)) {
      flags.push({
        category: "education",
        value: `${edu.degree} - ${edu.institution}`,
        detail: `This degree/institution pair doesn't appear in the master resume.`,
      });
    }
  }

  const masterCerts = new Set((masterResume.certifications || []).map((c) => normalize(c.name)));
  for (const cert of tailoredResume.certifications || []) {
    if (!masterCerts.has(normalize(cert.name))) {
      flags.push({
        category: "certification",
        value: cert.name,
        detail: `"${cert.name}" doesn't appear in the master resume's certifications.`,
      });
    }
  }

  const masterProjects = new Set((masterResume.projects || []).map((p) => normalize(p.name)));
  for (const proj of tailoredResume.projects || []) {
    if (!masterProjects.has(normalize(proj.name))) {
      flags.push({
        category: "project",
        value: proj.name,
        detail: `"${proj.name}" doesn't appear in the master resume's projects.`,
      });
    }
  }

  return flags;
}
