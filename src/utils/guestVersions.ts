import { ResumeData } from '../types';
import { localDb } from './localDb';
import { PRIMARY_RESUME_ID, ResumeVersionMeta } from '../db';

/**
 * Named resume versions for signed-out users.
 *
 * Mirrors the Firestore version API in src/db.ts (list/get/save/rename/delete)
 * so App.tsx can branch on `user` and otherwise treat both storage backends the
 * same way. Layout in localDb:
 *
 *   ats_master_resume            -> ResumeData for the primary version. Existing
 *                                   key, kept as-is so older guest data loads.
 *   ats_guest_resume_versions    -> ResumeVersionMeta[] covering every version,
 *                                   primary included, so the switcher renders
 *                                   without reading each resume body.
 *   ats_guest_resume_v_<id>      -> ResumeData for a non-primary version.
 *
 * Deliberately NOT `ats_resume_versions`: that localStorage key already belongs
 * to the manual snapshot feature in MasterResumeWizard/ResumePreview, which
 * stores a different shape ({id, name, timestamp, data}).
 */

export const GUEST_MASTER_KEY = 'ats_master_resume';
export const GUEST_VERSIONS_KEY = 'ats_guest_resume_versions';
const GUEST_VERSION_PREFIX = 'ats_guest_resume_v_';

const PRIMARY_DEFAULT_NAME = 'Master Resume';

function versionKey(resumeId: string): string {
  return resumeId === PRIMARY_RESUME_ID ? GUEST_MASTER_KEY : `${GUEST_VERSION_PREFIX}${resumeId}`;
}

async function readMeta(): Promise<ResumeVersionMeta[]> {
  const meta = await localDb.getItem<ResumeVersionMeta[]>(GUEST_VERSIONS_KEY, []);
  return Array.isArray(meta) ? meta : [];
}

async function writeMeta(meta: ResumeVersionMeta[]): Promise<void> {
  await localDb.setItem(GUEST_VERSIONS_KEY, meta);
}

/**
 * Lists guest versions, primary first and the rest newest-first -- the same
 * ordering listResumeVersions() produces for signed-in users. The primary entry
 * is synthesised when absent from the meta list, since guest data created
 * before versions existed only has `ats_master_resume`.
 */
export async function listGuestResumeVersions(): Promise<ResumeVersionMeta[]> {
  const meta = await readMeta();
  const withPrimary = meta.some((v) => v.id === PRIMARY_RESUME_ID)
    ? meta
    : [{ id: PRIMARY_RESUME_ID, name: PRIMARY_DEFAULT_NAME, updatedAt: 0 }, ...meta];

  return [...withPrimary].sort((a, b) =>
    a.id === PRIMARY_RESUME_ID ? -1 : b.id === PRIMARY_RESUME_ID ? 1 : b.updatedAt - a.updatedAt
  );
}

export async function getGuestResumeVersion(resumeId: string): Promise<ResumeData | null> {
  return localDb.getItem<ResumeData | null>(versionKey(resumeId), null);
}

/**
 * Writes a version's body and refreshes its metadata. `name` is only applied
 * when supplied, so autosaves never clobber a name the user chose -- matching
 * saveResumeVersion()'s contract.
 */
export async function saveGuestResumeVersion(
  resumeId: string,
  data: ResumeData,
  name?: string
): Promise<void> {
  await localDb.setItem(versionKey(resumeId), data);

  const meta = await readMeta();
  const existing = meta.find((v) => v.id === resumeId);
  const defaultName = resumeId === PRIMARY_RESUME_ID ? PRIMARY_DEFAULT_NAME : 'Untitled Resume';
  const next: ResumeVersionMeta = {
    id: resumeId,
    name: name ?? existing?.name ?? defaultName,
    updatedAt: Date.now(),
  };
  await writeMeta(existing ? meta.map((v) => (v.id === resumeId ? next : v)) : [...meta, next]);
}

export async function renameGuestResumeVersion(resumeId: string, name: string): Promise<void> {
  const meta = await readMeta();
  const existing = meta.find((v) => v.id === resumeId);
  const renamed: ResumeVersionMeta = { id: resumeId, name, updatedAt: Date.now() };
  await writeMeta(existing ? meta.map((v) => (v.id === resumeId ? renamed : v)) : [...meta, renamed]);
}

export async function deleteGuestResumeVersion(resumeId: string): Promise<void> {
  if (resumeId === PRIMARY_RESUME_ID) return;
  await localDb.removeItem(versionKey(resumeId));
  const meta = await readMeta();
  await writeMeta(meta.filter((v) => v.id !== resumeId));
}

/**
 * Every non-primary guest version with its body attached, for handing to
 * importGuestData() at sign-in.
 */
export async function collectGuestVersions(): Promise<
  { id: string; name: string; updatedAt: number; data: ResumeData }[]
> {
  const meta = await readMeta();
  const collected: { id: string; name: string; updatedAt: number; data: ResumeData }[] = [];
  for (const version of meta) {
    if (version.id === PRIMARY_RESUME_ID) continue;
    const data = await getGuestResumeVersion(version.id);
    if (data) collected.push({ ...version, data });
  }
  return collected;
}

/**
 * Drops every guest resume/version key. Called after a successful import so the
 * same data is not re-offered on the next sign-in.
 */
export async function clearGuestResumeData(): Promise<void> {
  const meta = await readMeta();
  for (const version of meta) {
    await localDb.removeItem(versionKey(version.id));
  }
  await localDb.removeItem(GUEST_MASTER_KEY);
  await localDb.removeItem(GUEST_VERSIONS_KEY);
}
