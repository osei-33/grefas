import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Removed aggressive module-level logo update to prevent permission errors on startup

// Test connection only when needed or with better handling
async function testConnection() {
  try {
    // Only attempt if not obviously offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    
    await getDocFromServer(doc(db, 'settings', 'global'));
    console.log("Firestore connection successful");
  } catch (error) {
    // Silently handle initial connectivity delays
    if (error instanceof Error && error.message.includes('the client is offline')) {
      // Don't log error here as it's often just a delay in initialization
    } else {
      console.warn("Firestore connection test encountered an issue:", error);
    }
  }
}
testConnection();
