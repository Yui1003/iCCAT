import { getFirestore } from "./firebase";
import admin from 'firebase-admin';

let dbInstance: admin.firestore.Firestore | null = null;

export const db = new Proxy({} as admin.firestore.Firestore, {
  get(_target, prop) {
    if (!dbInstance) {
      try {
        dbInstance = getFirestore();
      } catch (error) {
        throw new Error('Firebase not initialized. Check your .env.local file for credentials.');
      }
    }
    return (dbInstance as any)[prop];
  }
});
