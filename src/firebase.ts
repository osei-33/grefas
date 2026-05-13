import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, setDoc, terminate, clearIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Connect with improved settings for stability in the preview environment
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

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
  
  // Only log and throw if it's NOT a connectivity error during initialization
  if (errInfo.error.includes('the client is offline') || errInfo.error.includes('Could not reach')) {
    console.debug('Firestore is currently offline (handled):', path);
    return; // Don't throw for offline errors to prevent UI crashes
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

// Start verification in background
verifyConnection();
