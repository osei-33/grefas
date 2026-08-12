import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, doc, getDocFromServer, setDoc, terminate, clearIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Use standard getFirestore for stable WebChannel streaming in browser/iframe environments
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

/**
 * Handle Firestore errors according to integration guidelines
 */
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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
  }
  
  // Only log and throw if it's NOT a connectivity/offline error or internal SDK watch assertion
  const lowercaseError = errInfo.error.toLowerCase();
  if (
    lowercaseError.includes('offline') || 
    lowercaseError.includes('could not reach') || 
    lowercaseError.includes('unavailable') || 
    lowercaseError.includes('connection failed') || 
    lowercaseError.includes('network') ||
    lowercaseError.includes('internal assertion failed') ||
    lowercaseError.includes('unexpected state')
  ) {
    console.debug('Firestore internal event or connection state (handled):', path, errInfo.error);
    return; // Don't throw for handled transient errors to prevent UI crashes
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Improved connection check with backoff logic
async function verifyConnection(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      await getDocFromServer(doc(db, 'settings', 'global'));
      console.log("Firestore connection verified");
      return;
    } catch (error) {
      if (i === retries - 1) {
        console.warn("Firestore connection attempt failed after retries. Operating in offline-first mode.");
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
      }
    }
  }
}

// Start verification in background (disabled to suppress noisy connection warnings in sandboxed browser environments)
// verifyConnection();
