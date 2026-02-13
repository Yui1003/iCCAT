import admin from 'firebase-admin';

let firebaseApp: admin.app.App;
let firestoreDb: admin.firestore.Firestore;
let initializationFailed = false;

export function initializeFirebase() {
  if (firebaseApp) {
    return { app: firebaseApp, db: firestoreDb };
  }

  if (initializationFailed) {
    throw new Error('Firebase initialization previously failed');
  }

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

    if (!projectId || !privateKey || !clientEmail) {
      console.warn('⚠️ Firebase credentials not found in environment variables');
      console.warn('⚠️ Falling back to data.json for read operations');
      initializationFailed = true;
      throw new Error('Firebase credentials not configured');
    }

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        privateKey: privateKey.replace(/\\n/g, '\n'),
        clientEmail,
      }),
      storageBucket: storageBucket || `${projectId}.firebasestorage.app`
    }); // Initialize as default app to avoid "default Firebase app does not exist" error

    firestoreDb = firebaseApp.firestore();
    
    console.log('✅ Firebase Admin initialized successfully');
    return { app: firebaseApp, db: firestoreDb };
  } catch (error) {
    console.error('❌ Error initializing Firebase:', error);
    initializationFailed = true;
    throw error;
  }
}

export function getFirestore(): admin.firestore.Firestore {
  if (!firestoreDb) {
    const { db } = initializeFirebase();
    return db;
  }
  return firestoreDb;
}

/**
 * Trigger a remote shutdown by updating Firestore
 */
export async function triggerRemoteShutdown() {
  try {
    const db = getFirestore();
    const docRef = db.collection('settings').doc('system');
    
    // Create document if it doesn't exist, then update the flag
    await docRef.set({ 
      shutdownRequested: true,
      lastShutdownAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log('[FIREBASE] Shutdown flag set to true in Firestore');
    return true;
  } catch (error) {
    console.error('[FIREBASE] Failed to set shutdown flag:', error);
    throw error;
  }
}
