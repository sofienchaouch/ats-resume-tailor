import { db, auth } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper to recursively remove undefined properties from an object so Firestore won't reject it
function removeUndefined<T>(obj: T): T {
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

export const saveMasterResume = async (userId: string, data: ResumeData) => {
  const path = `users/${userId}`;
  try {
    const sanitizedData = removeUndefined(data);
    await setDoc(doc(db, 'users', userId), { masterResume: sanitizedData }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getMasterResume = async (userId: string): Promise<ResumeData | null> => {
  const path = `users/${userId}`;
  try {
    const docSnap = await getDoc(doc(db, 'users', userId));
    if (docSnap.exists() && docSnap.data().masterResume) {
      return docSnap.data().masterResume as ResumeData;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
};

export const saveHistory = async (userId: string, history: { id: string; timestamp: string; title: string; result: TailorResponse }[]) => {
  const path = `users/${userId}`;
  try {
    const sanitizedHistory = removeUndefined(history);
    await setDoc(doc(db, 'users', userId), { historyList: sanitizedHistory }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getHistory = async (userId: string): Promise<any[] | null> => {
  const path = `users/${userId}`;
  try {
    const docSnap = await getDoc(doc(db, 'users', userId));
    if (docSnap.exists() && docSnap.data().historyList) {
      return docSnap.data().historyList;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
};

export const saveJobApplications = async (userId: string, applications: any[]) => {
  const path = `users/${userId}`;
  try {
    const sanitizedApplications = removeUndefined(applications);
    await setDoc(doc(db, 'users', userId), { jobApplications: sanitizedApplications }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getJobApplications = async (userId: string): Promise<any[] | null> => {
  const path = `users/${userId}`;
  try {
    const docSnap = await getDoc(doc(db, 'users', userId));
    if (docSnap.exists() && docSnap.data().jobApplications) {
      return docSnap.data().jobApplications;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
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
  }
};
