import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  Auth,
} from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;
export const FIREBASE_STORAGE_BUCKET = firebaseConfig.storageBucket;
export const FIREBASE_AUTH_DOMAIN = firebaseConfig.authDomain;

const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db: Firestore = FIRESTORE_DATABASE_ID
  ? getFirestore(app, FIRESTORE_DATABASE_ID)
  : getFirestore(app);

export const auth: Auth = getAuth(app);
export const storage: FirebaseStorage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export function createSecondaryAuthApp(name: string): FirebaseApp {
  const existing = getApps().find((a) => a.name === name);
  return existing || initializeApp(firebaseConfig, name);
}

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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function isQuotaError(error: unknown): boolean {
  if (!error) return false;
  const code = (error as any)?.code || '';
  const msg = error instanceof Error ? error.message : String(error);
  return (
    code === 'resource-exhausted' ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.toLowerCase().includes('quota limit exceeded') ||
    msg.toLowerCase().includes('quota exceeded')
  );
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: rawMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  if (isQuotaError(error)) {
    throw new Error(
      'Cota diária gratuita do Firestore excedida (RESOURCE_EXHAUSTED). Tente novamente mais tarde ou atualize o plano no Firebase Console.'
    );
  }
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<{
  ok: boolean;
  quotaExceeded?: boolean;
  error?: string;
}> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    if (isQuotaError(error)) {
      return {
        ok: false,
        quotaExceeded: true,
        error:
          'Cota diária do Cloud Firestore excedida (RESOURCE_EXHAUSTED).',
      };
    }
    return { ok: false, quotaExceeded: false, error: msg };
  }
}

export { firebaseConfig };
