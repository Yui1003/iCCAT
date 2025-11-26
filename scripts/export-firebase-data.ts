import admin from 'firebase-admin';
import { writeFileSync } from 'fs';
import { join } from 'path';

const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

if (!projectId || !privateKey || !clientEmail) {
  console.error('Missing Firebase credentials in environment variables');
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

async function exportData() {
  console.log('Exporting data from Firebase...');
  
  const collections = [
    'buildings',
    'floors', 
    'rooms',
    'staff',
    'events',
    'walkpaths',
    'drivepaths',
    'admin_users',
    'settings',
    'saved_routes',
    'feedbacks',
    'analytics'
  ];

  const data: Record<string, any[]> = {};

  for (const collectionName of collections) {
    try {
      const snapshot = await db.collection(collectionName).get();
      data[collectionName] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log(`  - ${collectionName}: ${data[collectionName].length} documents`);
    } catch (error) {
      console.error(`  - Error fetching ${collectionName}:`, error);
      data[collectionName] = [];
    }
  }

  const outputPath = join(process.cwd(), 'data.json');
  writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`\nData exported to ${outputPath}`);
  
  await app.delete();
  process.exit(0);
}

exportData().catch(console.error);
