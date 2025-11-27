import admin from 'firebase-admin';
import multer from 'multer';

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

export async function uploadImageToFirebase(file: Express.Multer.File, type: string, id: string): Promise<string> {
  try {
    const bucket = admin.storage().bucket('iccat-campus-app.firebasestorage.app');
    
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
    console.log(`[UPLOAD] Image uploaded successfully: ${publicUrl}`);
    
    return publicUrl;
  } catch (error) {
    console.error('[UPLOAD] Firebase upload error:', error);
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
