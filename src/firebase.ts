import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, getDocFromServer, doc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Enable offline persistence
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a a time.
      console.warn('Firestore persistence failed: multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn('Firestore persistence is not supported by this browser');
    }
  });
}

// Connection test
async function testConnection() {
  try {
    // Try to fetch a non-existent document from server to test connection
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
    console.log('Firestore connected successfully');
  } catch (error: any) {
    if (error.message?.includes('the client is offline') || error.code === 'unavailable') {
      console.error('Firestore is offline. Please check your internet connection or Firebase configuration.');
    }
  }
}

testConnection();
