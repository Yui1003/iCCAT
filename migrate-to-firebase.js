import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Load service account key
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Load your data.json (corrected path - in root directory)
const data = JSON.parse(readFileSync('./data.json', 'utf8'));

async function migrateData() {
  try {
    console.log('🚀 Starting data migration to Firestore...\n');

    // Migrate Buildings
    if (data.buildings && data.buildings.length > 0) {
      console.log('📍 Migrating buildings...');
      for (const building of data.buildings) {
        await db.collection('buildings').doc(building.id.toString()).set(building);
        console.log(`  ✅ ${building.name}`);
      }
    }

    // Migrate Staff
    if (data.staff && data.staff.length > 0) {
      console.log('\n👥 Migrating staff...');
      for (const staff of data.staff) {
        await db.collection('staff').doc(staff.id.toString()).set(staff);
        console.log(`  ✅ ${staff.name}`);
      }
    }

    // Migrate Events
    if (data.events && data.events.length > 0) {
      console.log('\n📅 Migrating events...');
      for (const event of data.events) {
        await db.collection('events').doc(event.id.toString()).set(event);
        console.log(`  ✅ ${event.title}`);
      }
    }

    // Migrate Floors
    if (data.floors && data.floors.length > 0) {
      console.log('\n🏢 Migrating floors...');
      for (const floor of data.floors) {
        await db.collection('floors').doc(floor.id.toString()).set(floor);
        console.log(`  ✅ Floor ${floor.floorNumber} - Building ${floor.buildingId}`);
      }
    }

    // Migrate Rooms
    if (data.rooms && data.rooms.length > 0) {
      console.log('\n🚪 Migrating rooms...');
      for (const room of data.rooms) {
        await db.collection('rooms').doc(room.id.toString()).set(room);
        console.log(`  ✅ ${room.name || room.type}`);
      }
    }

    // Migrate Walkpaths
    if (data.walkpaths && data.walkpaths.length > 0) {
      console.log('\n🚶 Migrating walkpaths...');
      for (const path of data.walkpaths) {
        await db.collection('walkpaths').doc(path.id.toString()).set(path);
        console.log(`  ✅ Walkpath ${path.id}`);
      }
    }

    // Migrate Drivepaths
    if (data.drivepaths && data.drivepaths.length > 0) {
      console.log('\n🚗 Migrating drivepaths...');
      for (const path of data.drivepaths) {
        await db.collection('drivepaths').doc(path.id.toString()).set(path);
        console.log(`  ✅ Drivepath ${path.id}`);
      }
    }

    // Migrate Admins
    if (data.admins && data.admins.length > 0) {
      console.log('\n👨‍💼 Migrating admins...');
      for (const adminUser of data.admins) {
        await db.collection('admins').doc(adminUser.id.toString()).set(adminUser);
        console.log(`  ✅ ${adminUser.username}`);
      }
    }

    // Migrate Settings
    if (data.settings && data.settings.length > 0) {
      console.log('\n⚙️ Migrating settings...');
      for (const setting of data.settings) {
        await db.collection('settings').doc(setting.key).set(setting);
        console.log(`  ✅ ${setting.key}`);
      }
    }

    console.log('\n\n✨ Migration complete! All data transferred to Firestore.');
    console.log('\n📊 Summary:');
    console.log(`   Buildings: ${data.buildings?.length || 0}`);
    console.log(`   Staff: ${data.staff?.length || 0}`);
    console.log(`   Events: ${data.events?.length || 0}`);
    console.log(`   Floors: ${data.floors?.length || 0}`);
    console.log(`   Rooms: ${data.rooms?.length || 0}`);
    console.log(`   Walkpaths: ${data.walkpaths?.length || 0}`);
    console.log(`   Drivepaths: ${data.drivepaths?.length || 0}`);
    console.log(`   Admins: ${data.admins?.length || 0}`);
    console.log(`   Settings: ${data.settings?.length || 0}`);
    
    console.log('\n🌐 View your data at:');
    console.log('   https://console.firebase.google.com/');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration error:', error);
    console.error('\nPlease check:');
    console.error('   1. serviceAccountKey.json exists in project root');
    console.error('   2. data.json exists in project root');
    console.error('   3. Firebase project has Firestore enabled');
    console.error('   4. Service account has proper permissions');
    process.exit(1);
  }
}

// Run the migration
migrateData();