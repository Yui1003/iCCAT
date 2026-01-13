# Setup Guide: Remote Kiosk Shutdown

This guide explains how to set up the remote shutdown listener on your physical Kiosk Mini-PC.

### Prerequisites
1. **Node.js installed** on the Kiosk Windows PC.
2. **Firebase Service Account Key**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Rename the downloaded file to `serviceAccountKey.json`.

---

### Step 1: Prepare the Files
1. Create a folder on the Kiosk PC (e.g., `C:\iccat-tools\`).
2. Move the following files into that folder:
   - `kiosk-shutdown-listener.js` (The script I just created)
   - `serviceAccountKey.json` (Your Firebase key)

### Step 2: Install Dependencies
Open a command prompt (CMD) in that folder and run:
```bash
npm init -y
npm install firebase-admin
```

### Step 3: Test the Script
Run the script to make sure it connects to Firebase:
```bash
node kiosk-shutdown-listener.js
```
*Note: You may need to manually create a document in Firestore at `settings/system` with the field `shutdownRequested: false` (Boolean) if it doesn't exist.*

### Step 4: Set to Run on Startup (Windows)
To make this run every time the Kiosk turns on:
1. Press `Win + R`, type `shell:startup`, and press Enter.
2. Create a new shortcut in that folder.
3. In the location field, enter:
   `cmd /c "cd /d C:\iccat-tools && node kiosk-shutdown-listener.js"`
4. Save the shortcut as "iCCAT Shutdown Listener".

### Step 5: How to Trigger Shutdown
In your webapp (or manually in Firebase Console), set the value of `settings/system/shutdownRequested` to `true`. The Kiosk will detect the change, reset the flag to `false`, and shut down within 10 seconds.
