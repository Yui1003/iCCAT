const admin = require('firebase-admin');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * iCCAT Kiosk Remote Shutdown Listener
 * 
 * This script runs locally on the Kiosk Mini-PC.
 * it listens for changes in Firestore and triggers a system shutdown.
 */

// 1. Setup Firebase Admin (Use your service account key)
// Replace 'serviceAccountKey.json' with the actual path to your downloaded key
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Error: serviceAccountKey.json not found!');
  console.log('Please download your service account key from Firebase Console -> Project Settings -> Service Accounts');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 2. Listen for the shutdown command
// We assume there is a document 'settings/system' with a field 'shutdownRequested'
console.log('iCCAT Shutdown Listener started...');
console.log('Waiting for remote shutdown command...');

const docRef = db.collection('settings').doc('system');

docRef.onSnapshot((doc) => {
  if (doc.exists) {
    const data = doc.data();
    if (data.shutdownRequested === true) {
      console.log('SHUTDOWN COMMAND RECEIVED!');
      
      // Reset the flag immediately so it doesn't loop on next boot
      docRef.update({ shutdownRequested: false })
        .then(() => {
          console.log('Shutdown flag reset. Powering off system...');
          
          // Trigger Windows Shutdown
          exec('shutdown /s /t 10 /c "Remote shutdown initiated by Admin"', (error, stdout, stderr) => {
            if (error) {
              console.error(`Exec error: ${error}`);
              return;
            }
            console.log(`stdout: ${stdout}`);
            console.error(`stderr: ${stderr}`);
          });
        })
        .catch(err => {
          console.error('Error resetting shutdown flag:', err);
        });
    }
  }
}, (error) => {
  console.error('Firestore listener error:', error);
});
