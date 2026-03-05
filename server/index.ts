import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeFirebase } from "./firebase";
import { config } from "dotenv";
import { join } from "path";

// Load environment variables from .env.local
config({ path: join(process.cwd(), '.env.local') });

// Initialize Firebase on startup (with fallback)
try {
  initializeFirebase();
} catch (error) {
  console.warn('⚠️ Firebase initialization failed - using fallback mode with data.json');
}

const app = express();

// Trust proxy headers for production environments (Render, etc.)
// This ensures req.ip and req.socket.remoteAddress properly reflect the client IP
app.set('trust proxy', true);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Cache control middleware - prevent stale content from Service Worker
app.use((req, res, next) => {
  // Mobile navigation - never cache (disable service worker for this route)
  if (req.path.match(/^\/navigate\//)) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  // Never cache HTML files
  else if (req.path === '/' || req.path.endsWith('.html')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  // Cache static assets for longer
  else if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|eot|ttf)$/)) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  // API responses - let Service Worker handle caching
  else if (req.path.startsWith('/api')) {
    res.set('Cache-Control', 'private, max-age=0');
  }
  
  next();
});

// Mobile restriction middleware
app.use((req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const path = req.path;

  // Conditions to block:
  // 1. Is a mobile device
  // 2. Is NOT a navigation route (/navigate/:id)
  // 3. Is NOT an API route
  // 4. Is NOT an admin route
  // 5. Does NOT have a file extension (it's a page request)
  if (isMobile && 
      !path.startsWith('/navigate') && 
      !path.startsWith('/api') && 
      !path.startsWith('/admin') && 
      !path.includes('.')) {
    
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>iCCAT - Kiosk Only</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background-color: #f0fdf4;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #166534;
            text-align: center;
            padding: 20px;
          }
          .container {
            max-width: 400px;
            background: white;
            padding: 40px 20px;
            border-radius: 20px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          }
          .logo-circle {
            width: 80px;
            height: 80px;
            background: #22c55e;
            border-radius: 20px;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .logo-circle svg {
            width: 50px;
            height: 50px;
            color: white;
          }
          h1 { margin: 0 0 10px; font-size: 24px; color: #14532d; }
          p { margin: 0 0 20px; line-height: 1.5; color: #166534; }
          .hint {
            font-size: 14px;
            background: #dcfce7;
            padding: 15px;
            border-radius: 12px;
            border: 1px solid #bbf7d0;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #166534;
            opacity: 0.7;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo-circle">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <h1>iCCAT</h1>
          <p>This terminal is for on-site kiosk use only.</p>
          <div class="hint">
            <strong>Have a QR Code?</strong><br>
            Please scan the QR code from the kiosk screen to open your navigation route on this device.
          </div>
        </div>
        <div class="footer">
          Interactive Campus Companion & Assistance Terminal<br>
          CVSU CCAT Campus
        </div>
      </body>
      </html>
    `);
  }

  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
