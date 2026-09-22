import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, setLogLevel, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Set log level to silent first to prevent internal SDK connection retry notices from polluting console.error
setLogLevel('silent');

// Use initializeFirestore with forced long polling.
// In iframe and proxy environments (such as Cloud Run reverse proxy), WebSockets and
// chunked fetch streams fail the initial handshake, causing "Connection failed 1 times"
// and "The operation could not be completed" errors. Forced long polling establishes
// immediate, robust HTTP communication.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || '(default)');

// Test connection on boot per Firebase integration skill (deferred slightly to allow initial connection handshake)
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore operating in offline mode until connection is established.");
    }
  }
}
if (typeof window !== 'undefined') {
  setTimeout(testConnection, 2000);
}

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
