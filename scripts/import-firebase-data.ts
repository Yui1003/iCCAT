import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

if (!projectId || !privateKey || !clientEmail) {
  console.error('Missing Firebase credentials in environment variables');
  console.error('Make sure FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL are set');
  process.exit(1);
}

const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    privateKey: privateKey.replace(/\\n/g, '\n'),
    clientEmail,
  })
});

const db = app.firestore();

async function importData() {
  try {
    console.log('Reading data from data.json...');
    
    const dataPath = join(process.cwd(), 'data.json');
    const data = JSON.parse(readFileSync(dataPath, 'utf8'));
    
    const collectionMappings: Record<string, string> = {
      'buildings': 'buildings',
      'floors': 'floors',
      'rooms': 'rooms',
      'staff': 'staff',
      'events': 'events',
      'walkpaths': 'walkpaths',
      'drivepaths': 'drivepaths',
      'admins': 'admin_users',
      'settings': 'settings',
      'feedbacks': 'feedbacks',
      'indoorNodes': 'indoor_nodes',
      'roomPaths': 'room_paths'
    };

    console.log('\nImporting data to Firebase Firestore...\n');

    for (const [jsonKey, firestoreCollection] of Object.entries(collectionMappings)) {
      if (!data[jsonKey] || !Array.isArray(data[jsonKey])) {
        console.log(`⊘ ${firestoreCollection}: No data found (skipping)`);
        continue;
      }

      const items = data[jsonKey];
      console.log(`→ Importing ${items.length} documents to '${firestoreCollection}'...`);

      for (const item of items) {
        const { id, ...docData } = item;
        try {
          await db.collection(firestoreCollection).doc(id).set(docData, { merge: true });
        } catch (error: any) {
          console.error(`  ✗ Error importing ${id}:`, error.message);
        }
      }

      console.log(`✓ ${firestoreCollection}: ${items.length} documents imported`);
    }

    console.log('\n✓ Data import completed successfully!');
    
    await app.delete();
    process.exit(0);
  } catch (error) {
    console.error('✗ Import failed:', error);
    await app.delete();
    process.exit(1);
  }
}

importData();
