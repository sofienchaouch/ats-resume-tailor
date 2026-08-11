import { db, auth } from './firebase';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { ResumeData, TailorResponse } from './types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  // Intentionally excludes email, emailVerified, and provider data (PII).
  // uid is kept because it's needed to correlate a support report with a
  // specific account; it is not itself personally identifying.
  authInfo: {
    userId?: string | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper to recursively remove undefined properties from an object so Firestore won't reject it
export function removeUndefined<T>(obj: T): T {
  if (obj === undefined) {
    return null as any;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefined(item)) as any;
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== undefined) {
      result[key] = removeUndefined(val);
    }
  }
  return result;
}

// Schema v2: instead of one monolithic users/{uid} document holding
// masterResume/historyList/jobApplications as fields (1MB document ceiling,
// full-document rewrite on every save), those live in subcollections.
// users/{uid} itself now holds only profile data (schemaVersion, aiConfig).
export const SCHEMA_VERSION = 2;

// The default resume every account starts with. users/{uid}/resumes/{resumeId}
// is a subcollection, so additional named versions (e.g. "Backend", "Data")
// live alongside it as their own documents.
export const PRIMARY_RESUME_ID = 'primary';

export interface ResumeVersionMeta {
  id: string;
  name: string;
  updatedAt: number;
}

/**
 * Upserts `items` (each needs a stable `id`) into users/{userId}/{subcollection}
 * as one document per item, and deletes any existing docs there that are no
 * longer present in `items`. Lets saveHistory/saveJobApplications keep their
 * existing "pass the whole array" contract while storing each entry as its
 * own small document instead of one array field shared with everything else.
 */
async function syncSubcollection(userId: string, subcollectionName: string, items: { id: string }[]) {
  const colRef = collection(db, 'users', userId, subcollectionName);
  const existingSnap = await getDocs(colRef);
  const incomingIds = new Set(items.map((item) => String(item.id)));

  const batch = writeBatch(db);
  for (const item of items) {
    if (!item?.id) continue;
    batch.set(doc(colRef, String(item.id)), removeUndefined(item));
  }
  for (const existingDoc of existingSnap.docs) {
    if (!incomingIds.has(existingDoc.id)) {
      batch.delete(existingDoc.ref);
    }
  }
  await batch.commit();
}

/**
 * One-time, idempotent fan-out of the legacy monolithic users/{uid} document
 * into the v2 subcollection shape. Safe to call on every sign-in: it's a
 * no-op once users/{uid}.schemaVersion === SCHEMA_VERSION. Legacy fields are
 * left in place (not deleted) as a safety net; they simply stop being read.
 */
export const migrateToSubcollections = async (userId: string): Promise<void> => {
  const path = `users/${userId}`;
  try {
    const profileRef = doc(db, 'users', userId);
    const profileSnap = await getDoc(profileRef);
    const profileData = profileSnap.exists() ? profileSnap.data() : null;

    if (profileData?.schemaVersion === SCHEMA_VERSION) {
      return;
    }

    const batch = writeBatch(db);

    if (profileData?.masterResume) {
      batch.set(
        doc(db, 'users', userId, 'resumes', PRIMARY_RESUME_ID),
        { name: 'Master Resume', data: removeUndefined(profileData.masterResume), updatedAt: Date.now() },
        { merge: true }
      );
    }

    if (Array.isArray(profileData?.historyList)) {
      for (const item of profileData.historyList) {
        if (!item?.id) continue;
        batch.set(doc(db, 'users', userId, 'history', String(item.id)), removeUndefined(item));
      }
    }

    if (Array.isArray(profileData?.jobApplications)) {
      for (const app of profileData.jobApplications) {
        if (!app?.id) continue;
        batch.set(
          doc(db, 'users', userId, 'applications', String(app.id)),
          removeUndefined({ ...app, resumeId: PRIMARY_RESUME_ID })
        );
      }
    }

    batch.set(profileRef, { schemaVersion: SCHEMA_VERSION }, { merge: true });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

/**
 * Saves resume data for a given version. `name` is only written when
 * provided, so routine autosaves (which don't pass a name) never clobber a
 * version the user has renamed.
 */
export const saveResumeVersion = async (userId: string, resumeId: string, data: ResumeData, name?: string) => {
  const path = `users/${userId}/resumes/${resumeId}`;
  try {
    const sanitizedData = removeUndefined(data);
    const payload: any = { data: sanitizedData, updatedAt: Date.now() };
    if (name !== undefined) {
      payload.name = name;
    }
    await setDoc(doc(db, 'users', userId, 'resumes', resumeId), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getResumeVersion = async (userId: string, resumeId: string): Promise<ResumeData | null> => {
  const path = `users/${userId}/resumes/${resumeId}`;
  try {
    const docSnap = await getDoc(doc(db, 'users', userId, 'resumes', resumeId));
    if (docSnap.exists() && docSnap.data().data) {
      return docSnap.data().data as ResumeData;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const listResumeVersions = async (userId: string): Promise<ResumeVersionMeta[]> => {
  const path = `users/${userId}/resumes`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'resumes'));
    return snap.docs
      .map((d) => ({
        id: d.id,
        name: (d.data().name as string) || 'Untitled Resume',
        updatedAt: (d.data().updatedAt as number) || 0,
      }))
      .sort((a, b) => (a.id === PRIMARY_RESUME_ID ? -1 : b.id === PRIMARY_RESUME_ID ? 1 : b.updatedAt - a.updatedAt));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const renameResumeVersion = async (userId: string, resumeId: string, name: string) => {
  const path = `users/${userId}/resumes/${resumeId}`;
  try {
    await setDoc(doc(db, 'users', userId, 'resumes', resumeId), { name, updatedAt: Date.now() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const deleteResumeVersion = async (userId: string, resumeId: string) => {
  const path = `users/${userId}/resumes/${resumeId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'resumes', resumeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

// Legacy single-resume API, kept for the callers that only ever deal with
// the default version. Thin wrappers over the version-aware functions above.
export const saveMasterResume = async (userId: string, data: ResumeData) => {
  await saveResumeVersion(userId, PRIMARY_RESUME_ID, data);
};

export const getMasterResume = async (userId: string): Promise<ResumeData | null> => {
  return getResumeVersion(userId, PRIMARY_RESUME_ID);
};

export const saveHistory = async (userId: string, history: { id: string; timestamp: string; title: string; result: TailorResponse }[]) => {
  const path = `users/${userId}/history`;
  try {
    await syncSubcollection(userId, 'history', history);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getHistory = async (userId: string): Promise<any[] | null> => {
  const path = `users/${userId}/history`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'history'));
    return snap.docs.map((d) => d.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const saveJobApplications = async (userId: string, applications: any[]) => {
  const path = `users/${userId}/applications`;
  try {
    await syncSubcollection(userId, 'applications', applications);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getJobApplications = async (userId: string): Promise<any[] | null> => {
  const path = `users/${userId}/applications`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'applications'));
    return snap.docs.map((d) => d.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const saveAnswerBank = async (userId: string, entries: any[]) => {
  const path = `users/${userId}/answerBank`;
  try {
    await syncSubcollection(userId, 'answerBank', entries);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getAnswerBank = async (userId: string): Promise<any[] | null> => {
  const path = `users/${userId}/answerBank`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'answerBank'));
    return snap.docs.map((d) => d.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const saveAchievementBank = async (userId: string, entries: any[]) => {
  const path = `users/${userId}/achievementBank`;
  try {
    await syncSubcollection(userId, 'achievementBank', entries);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getAchievementBank = async (userId: string): Promise<any[] | null> => {
  const path = `users/${userId}/achievementBank`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'achievementBank'));
    return snap.docs.map((d) => d.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const saveAiConfig = async (userId: string, config: any) => {
  const path = `users/${userId}`;
  try {
    const sanitizedConfig = removeUndefined(config);
    await setDoc(doc(db, 'users', userId), { aiConfig: sanitizedConfig }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getAiConfig = async (userId: string): Promise<any | null> => {
  const path = `users/${userId}`;
  try {
    const docSnap = await getDoc(doc(db, 'users', userId));
    if (docSnap.exists() && docSnap.data().aiConfig) {
      return docSnap.data().aiConfig;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};
