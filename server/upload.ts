import admin from 'firebase-admin';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.memoryStorage();
export const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
    }
  }
});

// Create uploads directory if it doesn't exist
const UPLOADS_DIR = path.join(process.cwd(), 'server', 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export async function uploadImageToFirebase(file: Express.Multer.File, type: string, id: string): Promise<string> {
  try {
    const bucket = admin.storage().bucket();
    const bucketExists = await bucket.exists();
    
    if (bucketExists[0]) {
      // Generate filename
      const extension = file.originalname.split('.').pop() || 'jpg';
      const filename = `images/${type}/${id}/${Date.now()}.${extension}`;
      
      const fileRef = bucket.file(filename);
      
      // Upload file
      await fileRef.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
        },
      });
      
      // Make file public
      await fileRef.makePublic();
      
      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
      console.log(`[UPLOAD] Image uploaded successfully to Firebase: ${publicUrl}`);
      return publicUrl;
    } else {
      console.warn('[UPLOAD] Firebase bucket does not exist, falling back to local storage');
      return await saveFileLocally(file, type, id);
    }
  } catch (error) {
    console.error('[UPLOAD] Firebase upload error, falling back to local storage:', error);
    return await saveFileLocally(file, type, id);
  }
}

async function saveFileLocally(file: Express.Multer.File, type: string, id: string): Promise<string> {
  const extension = file.originalname.split('.').pop() || 'jpg';
  const filename = `${Date.now()}.${extension}`;
  const relativePath = path.join('uploads', type, id);
  const fullPath = path.join(UPLOADS_DIR, type, id);
  
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
  
  const filePath = path.join(fullPath, filename);
  fs.writeFileSync(filePath, file.buffer);
  
  const publicUrl = `/uploads/${type}/${id}/${filename}`;
  console.log(`[UPLOAD] Image saved locally: ${publicUrl}`);
  return publicUrl;
}
