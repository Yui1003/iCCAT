// Firebase client-side initialization for offline persistence
import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function initializeFirebaseOffline() {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // Enable offline persistence for Firestore
    enableIndexedDbPersistence(db)
      .then(() => {
        console.log('[FIREBASE] Offline persistence enabled successfully');
      })
      .catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('[FIREBASE] Multiple tabs open - offline persistence disabled for this tab');
        } else if (err.code === 'unimplemented') {
          console.warn('[FIREBASE] Browser does not support offline persistence');
        } else {
          console.warn('[FIREBASE] Offline persistence error:', err);
        }
      });

    return db;
  } catch (err) {
    console.warn('[FIREBASE] Client-side Firebase initialization failed:', err);
    return null;
  }
}
