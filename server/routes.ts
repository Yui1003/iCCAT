import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { exec } from "child_process";
import https from "https";
import http from "http";
import { storage } from "./storage";
import { upload, uploadImageToFirebase } from "./upload";
import { 
  listenerManager, 
  notifyBuildingsChange, 
  notifyEventsChange, 
  notifyStaffChange, 
  notifyFloorsChange, 
  notifyRoomsChange, 
  notifyWalkpathsChange, 
  notifyDrivepathsChange, 
  notifyPwdPathsChange,
  notifyIndoorNodesChange, 
  notifyRoomPathsChange, 
  notifySettingsChange,
  notifyAnalyticsReset,
  notifyKioskUptimeChange
} from "./listeners";
import {
  insertBuildingSchema,
  insertFloorSchema,
  insertRoomSchema,
  insertStaffSchema,
  insertEventSchema,
  insertWalkpathSchema,
  insertDrivepathSchema,
  insertPwdPathSchema,
  insertSettingSchema,
  insertFeedbackSchema,
  insertSavedRouteSchema,
  insertIndoorNodeSchema,
  insertRoomPathSchema,
  insertKioskUptimeSchema,
  canHaveStaff,
  type POIType
} from "@shared/schema";
import { analyticsEventSchema, AnalyticsEventType } from "@shared/analytics-schema";
import { z } from "zod";
import { findShortestPath } from "./pathfinding";
import { triggerRemoteShutdown } from "./firebase";

const loginSchema = z.object({
  username: z.string(),
  password: z.string()
});

const updateSettingSchema = z.object({
  value: z.string()
});

interface UploadRequestBody {
  type?: string;
  id?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get device IP endpoint - returns the client IP for kiosk device identification
  // Handles proxy headers for production environments (Render, etc.)
  app.get('/api/get-device-ip', (req, res) => {
    try {
      let ip = 'unknown';
      
      // Check proxy headers first (for reverse proxy environments like Render)
      const xForwardedFor = req.headers['x-forwarded-for'];
      if (xForwardedFor) {
        // x-forwarded-for can contain multiple IPs, take the first one
        ip = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(',')[0].trim();
      } else if (req.headers['cf-connecting-ip']) {
        // Cloudflare header
        ip = req.headers['cf-connecting-ip'] as string;
      } else if (req.headers['x-real-ip']) {
        // Nginx header
        ip = req.headers['x-real-ip'] as string;
      } else if (req.socket.remoteAddress) {
        // Direct connection
        ip = req.socket.remoteAddress;
      }
      
      console.log('[IP-DETECTION] Client IP detected:', ip, 'Headers:', {
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'cf-connecting-ip': req.headers['cf-connecting-ip'],
        'x-real-ip': req.headers['x-real-ip'],
        'socket.remoteAddress': req.socket.remoteAddress
      });
      
      return res.json({ ip });
    } catch (error) {
      console.error('Error getting device IP:', error);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Failed to get device IP', ip: 'unknown' });
      }
    }
  });

  // Image upload endpoint
  app.post('/api/upload-image', upload.single('file'), async (req: Request<{}, {}, UploadRequestBody>, res: Response) => {
    try {
      const file = (req as any).file as any;
      if (!file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const type = (req.body as UploadRequestBody).type || 'general';
      const id = (req.body as UploadRequestBody).id || 'unknown';

      const url = await uploadImageToFirebase(file, type, id);
      return res.json({ url });
    } catch (error) {
      console.error('[UPLOAD] Error:', error);
      if (!res.headersSent) {
        return res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Upload failed' 
        });
      }
    }
  });

  // Image proxy endpoint - fetches external images to bypass CORS
  // This allows all images (Firebase, external URLs) to be cached by the Service Worker
  app.get('/api/proxy-image', async (req, res) => {
    const imageUrl = req.query.url as string;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
      const decodedUrl = decodeURIComponent(imageUrl);
      
      // Validate URL
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(decodedUrl);
      } catch {
        return res.status(400).json({ error: 'Invalid URL' });
      }

      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: 'Invalid protocol' });
      }

      const httpModule = parsedUrl.protocol === 'https:' ? https : http;
      
      const proxyRequest = httpModule.get(decodedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
          'Accept': 'image/*,*/*',
        },
        timeout: 15000
      }, (proxyResponse) => {
        // Handle redirects
        if (proxyResponse.statusCode && proxyResponse.statusCode >= 300 && proxyResponse.statusCode < 400 && proxyResponse.headers.location) {
          const redirectUrl = proxyResponse.headers.location;
          // Make a new request to the redirect URL
          const redirectParsedUrl = new URL(redirectUrl, decodedUrl);
          const redirectHttpModule = redirectParsedUrl.protocol === 'https:' ? https : http;
          
          const redirectRequest = redirectHttpModule.get(redirectParsedUrl.href, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
              'Accept': 'image/*,*/*',
            },
            timeout: 15000
          }, (redirectResponse) => {
            if (redirectResponse.statusCode !== 200) {
              return res.status(redirectResponse.statusCode || 502).json({ error: 'Failed to fetch image after redirect' });
            }
            
            // Set appropriate headers
            res.setHeader('Content-Type', redirectResponse.headers['content-type'] || 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            redirectResponse.pipe(res);
          });
          
          redirectRequest.on('error', (err) => {
            console.error('[PROXY] Redirect request error:', err.message);
            if (!res.headersSent) {
              return res.status(502).json({ error: 'Failed to fetch redirected image' });
            }
          });
          
          redirectRequest.on('timeout', () => {
            redirectRequest.destroy();
            if (!res.headersSent) {
              return res.status(504).json({ error: 'Redirect request timeout' });
            }
          });
          
          return;
        }
        
        if (proxyResponse.statusCode !== 200) {
          return res.status(proxyResponse.statusCode || 502).json({ error: 'Failed to fetch image' });
        }

        // Set appropriate headers
        res.setHeader('Content-Type', proxyResponse.headers['content-type'] || 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Pipe the image data directly to the response
        proxyResponse.pipe(res);
      });

      proxyRequest.on('error', (err) => {
        console.error('[PROXY] Request error:', err.message);
        if (!res.headersSent) {
          return res.status(502).json({ error: 'Failed to fetch image' });
        }
      });

      proxyRequest.on('timeout', () => {
        proxyRequest.destroy();
        if (!res.headersSent) {
          return res.status(504).json({ error: 'Request timeout' });
        }
      });

    } catch (error) {
      console.error('[PROXY] Error:', error);
      if (!res.headersSent) {
        return res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Proxy failed' 
        });
      }
    }
  });

  app.post('/api/admin/login', async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      const admin = await storage.getAdminByUsername(username);
      
      if (!admin || admin.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      return res.json({ success: true, username: admin.username });
    } catch (error) {
      if (!res.headersSent) {
        return res.status(400).json({ error: 'Invalid request' });
      }
    }
  });

  // Shutdown kiosk endpoint
  app.post('/api/admin/shutdown', async (req, res) => {
    try {
      console.log('[SHUTDOWN] Shutdown request received');
      
      // 1. Trigger remote shutdown flag in Firestore for the Kiosk Listener
      try {
        await triggerRemoteShutdown();
        console.log('[SHUTDOWN] Remote shutdown flag triggered in Firebase');
      } catch (err) {
        console.error('[SHUTDOWN] Firebase trigger failed:', err);
      }
      
      // 2. Execute Windows shutdown command (local fallback if running on the actual kiosk server)
      // shutdown /s /t 0
      // /s = shutdown
      // /t 0 = timeout of 0 seconds (immediate)
      exec('shutdown /s /t 0', (error, stdout, stderr) => {
        if (error) {
          console.error('[SHUTDOWN] Local shutdown command failed (Expected if not running on Kiosk PC):', error.message);
        }
      });
      
      // Send immediate response
      return res.json({ 
        success: true, 
        message: 'System shutdown initiated via Firebase' 
      });
    } catch (error) {
      console.error('[SHUTDOWN] Failed to initiate shutdown:', error);
      if (!res.headersSent) {
        return res.status(500).json({ 
          error: 'Failed to initiate system shutdown',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  // Settings routes
  app.get('/api/settings/:key', async (req, res) => {
    try {
      const setting = await storage.getSetting(req.params.key);
      if (!setting) {
        return res.status(404).json({ error: 'Setting not found' });
      }
      return res.json(setting);
    } catch (error) {
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Failed to fetch setting' });
      }
    }
  });

  app.put('/api/settings/:key', async (req, res) => {
    try {
      const { value } = updateSettingSchema.parse(req.body);
      let setting = await storage.getSetting(req.params.key);
      if (!setting) {
        // Create if doesn't exist
        const data = insertSettingSchema.parse({ key: req.params.key, value, description: null });
        setting = await storage.createSetting(data);
      } else {
        // Update existing
        setting = await storage.updateSetting(req.params.key, value);
      }
      const settings = await storage.getSettings();
      notifySettingsChange(settings);
      return res.json(setting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request body', details: error.errors });
      }
      if (!res.headersSent) {
        return res.status(400).json({ error: 'Failed to update setting' });
      }
    }
  });

  // Feedback routes
  app.get('/api/feedback', async (req, res) => {
    try {
      const feedbacks = await storage.getFeedbacks();
      res.json(feedbacks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch feedbacks' });
    }
  });

  app.post('/api/feedback', async (req, res) => {
    try {
      const data = insertFeedbackSchema.parse(req.body);
      const feedback = await storage.createFeedback(data);
      res.status(201).json(feedback);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid feedback data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create feedback' });
    }
  });

  app.delete('/api/feedback/clear-all', async (req, res) => {
    try {
      await storage.clearAllFeedback();
      res.json({ success: true, message: 'All feedback records have been deleted' });
    } catch (error: any) {
      console.error('Failed to clear feedback:', error);
      res.status(500).json({ error: 'Failed to clear all feedback' });
    }
  });

  app.get('/api/feedback/export', async (req, res) => {
    try {
      const XLSX = await import('xlsx');
      const feedbacks = await storage.getFeedbacks();
      
      // Format data for Excel
      const excelData = feedbacks.map((f) => {
        // Parse timestamp - handle both Date objects and strings
        let timestampDate: Date;
        if (f.timestamp instanceof Date) {
          timestampDate = f.timestamp;
        } else if (typeof f.timestamp === 'string') {
          timestampDate = new Date(f.timestamp);
        } else {
          timestampDate = new Date();
        }
        
        // Ensure we have a valid date
        if (isNaN(timestampDate.getTime())) {
          timestampDate = new Date();
        }
        
        return {
          'Timestamp': timestampDate.toLocaleString('en-US', {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          }),
          'User #': f.userId ?? '',
          'Functional Suitability': (f.avgFunctionalSuitability ?? 0).toFixed(2),
          'Performance Efficiency': (f.avgPerformanceEfficiency ?? 0).toFixed(2),
          'Compatibility': (f.avgCompatibility ?? 0).toFixed(2),
          'Usability': (f.avgUsability ?? 0).toFixed(2),
          'Reliability': (f.avgReliability ?? 0).toFixed(2),
          'Security': (f.avgSecurity ?? 0).toFixed(2),
          'Maintainability': (f.avgMaintainability ?? 0).toFixed(2),
          'Portability': (f.avgPortability ?? 0).toFixed(2),
          'UX Items': (f.avgUxItems ?? 0).toFixed(2),
          'Comments': f.comments || ''
        };
      });

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Feedback');

      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Set headers for file download
      const filename = `iccat-feedbacks-${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (error) {
      console.error('Excel export error:', error);
      res.status(500).json({ error: 'Failed to export feedbacks' });
    }
  });

  app.get('/api/buildings', async (req, res) => {
    try {
      const buildings = await storage.getBuildings();
      res.json(buildings);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch buildings' });
    }
  });

  app.get('/api/buildings/:id', async (req, res) => {
    try {
      const building = await storage.getBuilding(req.params.id);
      if (!building) {
        return res.status(404).json({ error: 'Building not found' });
      }
      res.json(building);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch building' });
    }
  });

  app.post('/api/buildings', async (req, res) => {
    try {
      const data = insertBuildingSchema.parse(req.body);
      const building = await storage.createBuilding(data);
      const buildings = await storage.getBuildings();
      notifyBuildingsChange(buildings);
      res.status(201).json(building);
    } catch (error) {
      res.status(400).json({ error: 'Invalid building data' });
    }
  });

  app.put('/api/buildings/:id', async (req, res) => {
    try {
      const data = insertBuildingSchema.parse(req.body);
      const building = await storage.updateBuilding(req.params.id, data);
      if (!building) {
        return res.status(404).json({ error: 'Building not found' });
      }
      const buildings = await storage.getBuildings();
      notifyBuildingsChange(buildings);
      res.json(building);
    } catch (error) {
      res.status(400).json({ error: 'Invalid building data' });
    }
  });

  app.delete('/api/buildings/:id', async (req, res) => {
    try {
      const success = await storage.deleteBuilding(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Building not found' });
      }
      const buildings = await storage.getBuildings();
      notifyBuildingsChange(buildings);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete building' });
    }
  });

  app.get('/api/floors', async (req, res) => {
    try {
      const floors = await storage.getFloors();
      res.json(floors);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch floors' });
    }
  });

  app.get('/api/floors/:id', async (req, res) => {
    try {
      const floor = await storage.getFloor(req.params.id);
      if (!floor) {
        return res.status(404).json({ error: 'Floor not found' });
      }
      res.json(floor);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch floor' });
    }
  });

  app.post('/api/floors', async (req, res) => {
    try {
      const data = insertFloorSchema.parse(req.body);
      const floor = await storage.createFloor(data);
      const floors = await storage.getFloors();
      notifyFloorsChange(floors);
      res.status(201).json(floor);
    } catch (error) {
      res.status(400).json({ error: 'Invalid floor data' });
    }
  });

  app.put('/api/floors/:id', async (req, res) => {
    try {
      const data = insertFloorSchema.parse(req.body);
      const floor = await storage.updateFloor(req.params.id, data);
      if (!floor) {
        return res.status(404).json({ error: 'Floor not found' });
      }
      const floors = await storage.getFloors();
      notifyFloorsChange(floors);
      res.json(floor);
    } catch (error) {
      res.status(400).json({ error: 'Invalid floor data' });
    }
  });

  app.delete('/api/floors/:id', async (req, res) => {
    try {
      const success = await storage.deleteFloor(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Floor not found' });
      }
      const floors = await storage.getFloors();
      notifyFloorsChange(floors);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete floor' });
    }
  });

  app.get('/api/rooms', async (req, res) => {
    try {
      const rooms = await storage.getRooms();
      res.json(rooms);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch rooms' });
    }
  });

  app.get('/api/rooms/:id', async (req, res) => {
    try {
      const room = await storage.getRoom(req.params.id);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      res.json(room);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch room' });
    }
  });

  app.post('/api/rooms', async (req, res) => {
    try {
      const data = insertRoomSchema.parse(req.body);
      const room = await storage.createRoom(data);
      const rooms = await storage.getRooms();
      notifyRoomsChange(rooms);
      res.status(201).json(room);
    } catch (error) {
      res.status(400).json({ error: 'Invalid room data' });
    }
  });

  app.put('/api/rooms/:id', async (req, res) => {
    try {
      const data = insertRoomSchema.parse(req.body);
      const room = await storage.updateRoom(req.params.id, data);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      const rooms = await storage.getRooms();
      notifyRoomsChange(rooms);
      res.json(room);
    } catch (error) {
      res.status(400).json({ error: 'Invalid room data' });
    }
  });

  app.delete('/api/rooms/:id', async (req, res) => {
    try {
      const success = await storage.deleteRoom(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Room not found' });
      }
      const rooms = await storage.getRooms();
      notifyRoomsChange(rooms);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete room' });
    }
  });

  app.get('/api/staff', async (req, res) => {
    try {
      const staff = await storage.getStaff();
      res.json(staff);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch staff' });
    }
  });

  app.get('/api/staff/:id', async (req, res) => {
    try {
      const staff = await storage.getStaffMember(req.params.id);
      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      res.json(staff);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch staff member' });
    }
  });

  app.post('/api/staff', async (req, res) => {
    try {
      const data = insertStaffSchema.parse(req.body);
      
      // Validate that buildingId (if provided) belongs to a staff-allowed POI type
      if (data.buildingId) {
        const building = await storage.getBuilding(data.buildingId);
        if (!building) {
          return res.status(400).json({ error: 'Building not found' });
        }
        if (!canHaveStaff(building.type as POIType)) {
          return res.status(400).json({ 
            error: `Staff cannot be assigned to ${building.type} POI type. Allowed types: Building, Security Office / Campus Police, Gym / Sports Facility, Library, Administrative Office, Health Services / Clinic` 
          });
        }
      }
      
      const staff = await storage.createStaff(data);
      const staffList = await storage.getStaff();
      notifyStaffChange(staffList);
      res.status(201).json(staff);
    } catch (error) {
      res.status(400).json({ error: 'Invalid staff data' });
    }
  });

  app.put('/api/staff/:id', async (req, res) => {
    try {
      const data = insertStaffSchema.parse(req.body);
      
      // Validate that buildingId (if provided) belongs to a staff-allowed POI type
      if (data.buildingId) {
        const building = await storage.getBuilding(data.buildingId);
        if (!building) {
          return res.status(400).json({ error: 'Building not found' });
        }
        if (!canHaveStaff(building.type as POIType)) {
          return res.status(400).json({ 
            error: `Staff cannot be assigned to ${building.type} POI type. Allowed types: Building, Security Office / Campus Police, Gym / Sports Facility, Library, Administrative Office, Health Services / Clinic` 
          });
        }
      }
      
      const staff = await storage.updateStaff(req.params.id, data);
      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      const staffList = await storage.getStaff();
      notifyStaffChange(staffList);
      res.json(staff);
    } catch (error) {
      res.status(400).json({ error: 'Invalid staff data' });
    }
  });

  app.delete('/api/staff/:id', async (req, res) => {
    try {
      const success = await storage.deleteStaff(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      const staffList = await storage.getStaff();
      notifyStaffChange(staffList);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete staff member' });
    }
  });

  app.get('/api/events', async (req, res) => {
    try {
      const events = await storage.getEvents();
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  });

  app.get('/api/events/:id', async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch event' });
    }
  });

  app.post('/api/events', async (req, res) => {
    try {
      const data = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(data);
      const events = await storage.getEvents();
      notifyEventsChange(events);
      res.status(201).json(event);
    } catch (error) {
      res.status(400).json({ error: 'Invalid event data' });
    }
  });

  app.put('/api/events/:id', async (req, res) => {
    try {
      const data = insertEventSchema.parse(req.body);
      const event = await storage.updateEvent(req.params.id, data);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      const events = await storage.getEvents();
      notifyEventsChange(events);
      res.json(event);
    } catch (error) {
      res.status(400).json({ error: 'Invalid event data' });
    }
  });

  app.delete('/api/events/:id', async (req, res) => {
    try {
      const success = await storage.deleteEvent(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Event not found' });
      }
      const events = await storage.getEvents();
      notifyEventsChange(events);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete event' });
    }
  });

  app.get('/api/walkpaths', async (req, res) => {
    try {
      const walkpaths = await storage.getWalkpaths();
      res.json(walkpaths);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch walkpaths' });
    }
  });

  app.get('/api/walkpaths/:id', async (req, res) => {
    try {
      const walkpath = await storage.getWalkpath(req.params.id);
      if (!walkpath) {
        return res.status(404).json({ error: 'Walkpath not found' });
      }
      res.json(walkpath);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch walkpath' });
    }
  });

  app.post('/api/walkpaths', async (req, res) => {
    try {
      const data = insertWalkpathSchema.parse(req.body);
      const walkpath = await storage.createWalkpath(data);
      const walkpaths = await storage.getWalkpaths();
      notifyWalkpathsChange(walkpaths);
      res.status(201).json(walkpath);
    } catch (error) {
      res.status(400).json({ error: 'Invalid walkpath data' });
    }
  });

  app.put('/api/walkpaths/:id', async (req, res) => {
    try {
      const data = insertWalkpathSchema.parse(req.body);
      const walkpath = await storage.updateWalkpath(req.params.id, data);
      if (!walkpath) {
        return res.status(404).json({ error: 'Walkpath not found' });
      }
      const walkpaths = await storage.getWalkpaths();
      notifyWalkpathsChange(walkpaths);
      res.json(walkpath);
    } catch (error) {
      res.status(400).json({ error: 'Invalid walkpath data' });
    }
  });

  app.delete('/api/walkpaths/:id', async (req, res) => {
    try {
      const success = await storage.deleteWalkpath(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Walkpath not found' });
      }
      const walkpaths = await storage.getWalkpaths();
      notifyWalkpathsChange(walkpaths);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete walkpath' });
    }
  });

  app.get('/api/drivepaths', async (req, res) => {
    try {
      const drivepaths = await storage.getDrivepaths();
      res.json(drivepaths);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch drivepaths' });
    }
  });

  app.get('/api/drivepaths/:id', async (req, res) => {
    try {
      const drivepath = await storage.getDrivepath(req.params.id);
      if (!drivepath) {
        return res.status(404).json({ error: 'Drivepath not found' });
      }
      res.json(drivepath);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch drivepath' });
    }
  });

  app.post('/api/drivepaths', async (req, res) => {
    try {
      const data = insertDrivepathSchema.parse(req.body);
      const drivepath = await storage.createDrivepath(data);
      const drivepaths = await storage.getDrivepaths();
      notifyDrivepathsChange(drivepaths);
      res.status(201).json(drivepath);
    } catch (error) {
      res.status(400).json({ error: 'Invalid drivepath data' });
    }
  });

  app.put('/api/drivepaths/:id', async (req, res) => {
    try {
      const data = insertDrivepathSchema.parse(req.body);
      const drivepath = await storage.updateDrivepath(req.params.id, data);
      if (!drivepath) {
        return res.status(404).json({ error: 'Drivepath not found' });
      }
      const drivepaths = await storage.getDrivepaths();
      notifyDrivepathsChange(drivepaths);
      res.json(drivepath);
    } catch (error) {
      res.status(400).json({ error: 'Invalid drivepath data' });
    }
  });

  app.delete('/api/drivepaths/:id', async (req, res) => {
    try {
      const success = await storage.deleteDrivepath(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Drivepath not found' });
      }
      const drivepaths = await storage.getDrivepaths();
      notifyDrivepathsChange(drivepaths);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete drivepath' });
    }
  });

  // PWD Paths routes - for wheelchair-accessible navigation
  app.get('/api/pwd-paths', async (req, res) => {
    try {
      const pwdPaths = await storage.getPwdPaths();
      res.json(pwdPaths);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch PWD paths' });
    }
  });

  app.get('/api/pwd-paths/:id', async (req, res) => {
    try {
      const pwdPath = await storage.getPwdPath(req.params.id);
      if (!pwdPath) {
        return res.status(404).json({ error: 'PWD path not found' });
      }
      res.json(pwdPath);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch PWD path' });
    }
  });

  app.post('/api/pwd-paths', async (req, res) => {
    try {
      const data = insertPwdPathSchema.parse(req.body);
      const pwdPath = await storage.createPwdPath(data);
      const pwdPaths = await storage.getPwdPaths();
      notifyPwdPathsChange(pwdPaths);
      res.status(201).json(pwdPath);
    } catch (error) {
      res.status(400).json({ error: 'Invalid PWD path data' });
    }
  });

  app.put('/api/pwd-paths/:id', async (req, res) => {
    try {
      const data = insertPwdPathSchema.parse(req.body);
      const pwdPath = await storage.updatePwdPath(req.params.id, data);
      if (!pwdPath) {
        return res.status(404).json({ error: 'PWD path not found' });
      }
      const pwdPaths = await storage.getPwdPaths();
      notifyPwdPathsChange(pwdPaths);
      res.json(pwdPath);
    } catch (error) {
      res.status(400).json({ error: 'Invalid PWD path data' });
    }
  });

  app.delete('/api/pwd-paths/:id', async (req, res) => {
    try {
      const success = await storage.deletePwdPath(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'PWD path not found' });
      }
      const pwdPaths = await storage.getPwdPaths();
      notifyPwdPathsChange(pwdPaths);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete PWD path' });
    }
  });

  // Indoor Nodes routes - for indoor navigation
  app.get('/api/indoor-nodes', async (req, res) => {
    try {
      const nodes = await storage.getIndoorNodes();
      res.json(nodes);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch indoor nodes' });
    }
  });

  app.get('/api/indoor-nodes/:id', async (req, res) => {
    try {
      const node = await storage.getIndoorNode(req.params.id);
      if (!node) {
        return res.status(404).json({ error: 'Indoor node not found' });
      }
      res.json(node);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch indoor node' });
    }
  });

  app.get('/api/indoor-nodes/floor/:floorId', async (req, res) => {
    try {
      const nodes = await storage.getIndoorNodesByFloor(req.params.floorId);
      res.json(nodes);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch indoor nodes for floor' });
    }
  });

  app.post('/api/indoor-nodes', async (req, res) => {
    try {
      const data = insertIndoorNodeSchema.parse(req.body);
      const node = await storage.createIndoorNode(data);
      const indoorNodes = await storage.getIndoorNodes();
      notifyIndoorNodesChange(indoorNodes);
      res.status(201).json(node);
    } catch (error) {
      res.status(400).json({ error: 'Invalid indoor node data' });
    }
  });

  app.put('/api/indoor-nodes/:id', async (req, res) => {
    try {
      const data = insertIndoorNodeSchema.parse(req.body);
      const node = await storage.updateIndoorNode(req.params.id, data);
      if (!node) {
        return res.status(404).json({ error: 'Indoor node not found' });
      }
      const indoorNodes = await storage.getIndoorNodes();
      notifyIndoorNodesChange(indoorNodes);
      res.json(node);
    } catch (error) {
      res.status(400).json({ error: 'Invalid indoor node data' });
    }
  });

  app.delete('/api/indoor-nodes/:id', async (req, res) => {
    try {
      const success = await storage.deleteIndoorNode(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Indoor node not found' });
      }
      const indoorNodes = await storage.getIndoorNodes();
      notifyIndoorNodesChange(indoorNodes);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete indoor node' });
    }
  });

  // Room Paths routes - for indoor navigation paths
  app.get('/api/room-paths', async (req, res) => {
    try {
      const paths = await storage.getRoomPaths();
      res.json(paths);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch room paths' });
    }
  });

  app.get('/api/room-paths/:id', async (req, res) => {
    try {
      const path = await storage.getRoomPath(req.params.id);
      if (!path) {
        return res.status(404).json({ error: 'Room path not found' });
      }
      res.json(path);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch room path' });
    }
  });

  app.get('/api/room-paths/floor/:floorId', async (req, res) => {
    try {
      const paths = await storage.getRoomPathsByFloor(req.params.floorId);
      res.json(paths);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch room paths for floor' });
    }
  });

  app.post('/api/room-paths', async (req, res) => {
    try {
      const data = insertRoomPathSchema.parse(req.body);
      const path = await storage.createRoomPath(data);
      const roomPaths = await storage.getRoomPaths();
      notifyRoomPathsChange(roomPaths);
      res.status(201).json(path);
    } catch (error) {
      res.status(400).json({ error: 'Invalid room path data' });
    }
  });

  app.put('/api/room-paths/:id', async (req, res) => {
    try {
      const data = insertRoomPathSchema.parse(req.body);
      const path = await storage.updateRoomPath(req.params.id, data);
      if (!path) {
        return res.status(404).json({ error: 'Room path not found' });
      }
      const roomPaths = await storage.getRoomPaths();
      notifyRoomPathsChange(roomPaths);
      res.json(path);
    } catch (error) {
      res.status(400).json({ error: 'Invalid room path data' });
    }
  });

  app.delete('/api/room-paths/:id', async (req, res) => {
    try {
      const success = await storage.deleteRoomPath(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Room path not found' });
      }
      const roomPaths = await storage.getRoomPaths();
      notifyRoomPathsChange(roomPaths);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete room path' });
    }
  });

  const routeSchema = z.object({
    startId: z.string(),
    startLat: z.number().optional(),
    startLng: z.number().optional(),
    endId: z.string(),
    mode: z.enum(['walking', 'driving'])
  });

  app.post('/api/routes/calculate', async (req, res) => {
    try {
      const { startId, startLat, startLng, endId, mode } = routeSchema.parse(req.body);
      
      let startBuilding;
      if (startId === 'kiosk' && startLat !== undefined && startLng !== undefined) {
        startBuilding = {
          id: 'kiosk',
          name: 'Your Location (Kiosk)',
          lat: startLat,
          lng: startLng,
          nodeLat: startLat,
          nodeLng: startLng,
          type: 'Kiosk',
          description: null,
          departments: null,
          image: null,
          markerIcon: null,
          polygon: null,
          polygonColor: null,
          polygonOpacity: null,
          entranceLat: startLat,
          entranceLng: startLng
        };
      } else {
        startBuilding = await storage.getBuilding(startId);
      }
      
      const endBuilding = await storage.getBuilding(endId);
      
      if (!startBuilding || !endBuilding) {
        return res.status(404).json({ error: 'Building not found' });
      }

      const paths = mode === 'walking' 
        ? await storage.getWalkpaths()
        : await storage.getDrivepaths();

      const route = findShortestPath(startBuilding, endBuilding, paths);

      if (!route) {
        return res.status(404).json({ error: 'No route found' });
      }

      res.json({ route });
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  // Save route for QR code navigation
  app.post('/api/routes', async (req, res) => {
    try {
      const routeData = insertSavedRouteSchema.parse(req.body);
      const savedRoute = await storage.createSavedRoute(routeData);
      res.json(savedRoute);
    } catch (error) {
      console.error('Error saving route:', error);
      res.status(400).json({ error: 'Invalid route data' });
    }
  });

  // Retrieve saved route by ID
  app.get('/api/routes/:id', async (req, res) => {
    try {
      const route = await storage.getSavedRoute(req.params.id);
      if (!route) {
        return res.status(404).json({ error: 'Route not found' });
      }
      
      // Check if route has expired
      if (route.expiresAt && new Date(route.expiresAt) < new Date()) {
        return res.status(410).json({ error: 'Route has expired' });
      }
      
      res.json(route);
    } catch (error) {
      console.error('Error retrieving route:', error);
      res.status(500).json({ error: 'Failed to retrieve route' });
    }
  });

  // Analytics endpoints
  app.post('/api/analytics', async (req, res) => {
    try {
      const event = analyticsEventSchema.parse(req.body);
      await storage.addAnalyticsEvent(event);
      res.json({ success: true });
    } catch (error) {
      console.error('Error logging analytics:', error);
      res.status(400).json({ error: 'Invalid analytics event' });
    }
  });

  app.get('/api/admin/analytics', async (req, res) => {
    try {
      const summary = await storage.getAnalyticsSummary();
      res.json(summary);
    } catch (error) {
      console.error('Error retrieving analytics:', error);
      res.status(500).json({ error: 'Failed to retrieve analytics' });
    }
  });

  app.post('/api/admin/analytics/reset', async (req, res) => {
    try {
      await storage.resetAnalytics();
      // Broadcast reset to all connected kiosks via Firebase
      notifyAnalyticsReset();
      return res.json({ success: true, message: 'Analytics data reset' });
    } catch (error) {
      console.error('Error resetting analytics:', error);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Failed to reset analytics' });
      }
    }
  });

  // Get mobile navigation count (QR scans / page loads)
  app.get('/api/admin/analytics/mobile-navigation-count', async (req, res) => {
    try {
      const count = await storage.getMobileNavigationCount();
      res.json({ count });
    } catch (error) {
      console.error('Error getting mobile navigation count:', error);
      res.status(500).json({ error: 'Failed to get mobile navigation count' });
    }
  });

  // Export analytics as CSV or JSON
  app.get('/api/admin/analytics/export/:format', async (req, res) => {
    try {
      const format = req.params.format as 'csv' | 'json';
      const events = await storage.getAnalyticsExport();

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-export-${Date.now()}.json"`);
        res.json(events);
      } else if (format === 'csv') {
        // Convert to CSV with proper formatting in Philippine Time (UTC+8)
        const csvHeader = 'ID,EventType,ResponseTime(ms),Date,Time,Mobile_Navigation_Usage\n';
        const mobileNavEvents = events.filter(e => 
          e.eventType === AnalyticsEventType.INTERFACE_ACTION && 
          e.metadata && 
          e.metadata.action === 'mobile_navigation_opened'
        );
        const mobileNavCount = mobileNavEvents.length;
        const mobileNavInfo = mobileNavCount > 0 ? `${mobileNavCount}` : '0';
        
        const csvRows = events
          .map((event) => {
            const eventDate = new Date(event.timestamp);
            // Format using Philippine timezone (Asia/Manila - UTC+8)
            const dateFormatter = new Intl.DateTimeFormat('en-CA', {
              timeZone: 'Asia/Manila'
            });
            const timeFormatter = new Intl.DateTimeFormat('en-US', {
              timeZone: 'Asia/Manila',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            });
            const dateStr = dateFormatter.format(eventDate);
            const timeStr = timeFormatter.format(eventDate);
            const isMobileNavEvent = event.metadata && event.metadata.action === 'mobile_navigation_opened';
            return `"${event.id}","${event.eventType}",${event.responseTime},"${dateStr}","${timeStr}","${isMobileNavEvent ? 'Yes' : ''}"`;
          })
          .join('\n');
        
        // Add summary line
        const summaryLine = `"SUMMARY - Mobile Navigation Usage","INTERFACE_ACTION",0,"","","${mobileNavInfo}"`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-export-${Date.now()}.csv"`);
        res.send(csvHeader + csvRows + '\n' + summaryLine);
      } else {
        res.status(400).json({ error: 'Invalid format. Use "json" or "csv"' });
      }
    } catch (error) {
      console.error('Error exporting analytics:', error);
      res.status(500).json({ error: 'Failed to export analytics' });
    }
  });

  // Kiosk Uptime Tracking
  app.post('/api/analytics/kiosk-uptime/start', async (req, res) => {
    try {
      const { deviceId, appVersion } = req.body;
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID is required' });
      }
      const uptime = await storage.startKioskSession(deviceId, appVersion);
      console.log(`[KIOSK-UPTIME] Session started for device: ${deviceId}`);
      // Broadcast real-time update to all listeners
      const allUptimes = await storage.getAllKioskUptimes();
      notifyKioskUptimeChange(allUptimes);
      res.json(uptime);
    } catch (error) {
      console.error('Error starting kiosk session:', error);
      res.status(500).json({ error: 'Failed to start kiosk session' });
    }
  });

  app.post('/api/analytics/kiosk-uptime/heartbeat', async (req, res) => {
    try {
      const { deviceId, status, totalRequests, successfulRequests, uptimePercentage } = req.body;
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID is required' });
      }
      // Status defaults to 'active' if not provided (backward compatibility)
      const kioskStatus = status || 'active';
      const uptime = await storage.updateKioskHeartbeat(deviceId, kioskStatus, totalRequests, successfulRequests, uptimePercentage);
      
      // If no session exists for this device, tell the client to start a session first
      if (!uptime) {
        return res.status(404).json({ error: 'No active session found. Please call /start first.' });
      }
      
      // Broadcast real-time update to all listeners
      const allUptimes = await storage.getAllKioskUptimes();
      notifyKioskUptimeChange(allUptimes);
      res.json(uptime);
    } catch (error) {
      console.error('Error updating kiosk heartbeat:', error);
      res.status(500).json({ error: 'Failed to update heartbeat' });
    }
  });

  app.post('/api/analytics/kiosk-uptime/end', async (req, res) => {
    try {
      const { deviceId, totalRequests, successfulRequests, uptimePercentage } = req.body;
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID is required' });
      }
      const uptime = await storage.endKioskSession(deviceId, totalRequests, successfulRequests, uptimePercentage);
      console.log(`[KIOSK-UPTIME] Session ended for device: ${deviceId}, uptime: ${uptimePercentage}%`);
      // Broadcast real-time update to all listeners - device now shows as INACTIVE
      const allUptimes = await storage.getAllKioskUptimes();
      notifyKioskUptimeChange(allUptimes);
      res.json(uptime);
    } catch (error) {
      console.error('Error ending kiosk session:', error);
      res.status(500).json({ error: 'Failed to end kiosk session' });
    }
  });

  app.get('/api/analytics/kiosk-uptime', async (req, res) => {
    try {
      const uptimes = await storage.getAllKioskUptimes();
      res.json(uptimes);
    } catch (error) {
      console.error('Error fetching kiosk uptimes:', error);
      res.status(500).json({ error: 'Failed to fetch kiosk uptimes' });
    }
  });

  app.delete('/api/analytics/kiosk-uptime', async (req, res) => {
    try {
      await storage.deleteAllKioskUptimes();
      // Broadcast real-time update to all listeners - all devices cleared
      notifyKioskUptimeChange([]);
      res.json({ success: true, message: 'All kiosk uptime records deleted' });
    } catch (error) {
      console.error('Error deleting kiosk uptimes:', error);
      res.status(500).json({ error: 'Failed to delete kiosk uptimes' });
    }
  });

  app.delete('/api/analytics/kiosk-uptime/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteKioskUptime(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Kiosk uptime record not found' });
      }
      // Broadcast real-time update to all listeners - this updates all connected clients
      const allUptimes = await storage.getAllKioskUptimes();
      notifyKioskUptimeChange(allUptimes);
      console.log(`[KIOSK-UPTIME] Broadcasted update after deletion, ${allUptimes.length} records remaining`);
      res.json({ success: true, message: `Kiosk uptime record ${id} deleted` });
    } catch (error: any) {
      console.error('Error deleting kiosk uptime:', error);
      // Storage throws on Firestore errors, so this is a server error
      res.status(500).json({ error: error.message || 'Failed to delete kiosk uptime record' });
    }
  });

  // Firebase Real-Time Listener Endpoints (Server-Sent Events)
  // These endpoints stream data changes instead of requiring polling
  // Cost: ~1-5K reads/day instead of 100K with polling
  // Real-time: Instant updates instead of 5-second delay

  app.get('/api/listen/buildings', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
      const buildings = await storage.getBuildings();
      res.write(`data: ${JSON.stringify(buildings)}\n\n`);
      
      const clientId = `buildings-${Date.now()}-${Math.random()}`;
      listenerManager.registerClient('buildings', res, clientId);
    } catch (error) {
      console.error('[LISTENER] Buildings listener error:', error);
      res.write(`data: ${JSON.stringify([])}\n\n`);
      res.end();
    }
  });

  app.get('/api/listen/events', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
      const events = await storage.getEvents();
      res.write(`data: ${JSON.stringify(events)}\n\n`);
      
      const clientId = `events-${Date.now()}-${Math.random()}`;
      listenerManager.registerClient('events', res, clientId);
    } catch (error) {
      console.error('[LISTENER] Events listener error:', error);
      res.write(`data: ${JSON.stringify([])}\n\n`);
      res.end();
    }
  });

  app.get('/api/listen/staff', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
      const staff = await storage.getStaff();
      res.write(`data: ${JSON.stringify(staff)}\n\n`);
      
      const clientId = `staff-${Date.now()}-${Math.random()}`;
      listenerManager.registerClient('staff', res, clientId);
    } catch (error) {
      console.error('[LISTENER] Staff listener error:', error);
      res.write(`data: ${JSON.stringify([])}\n\n`);
      res.end();
    }
  });

  app.get('/api/listen/floors', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
      const floors = await storage.getFloors();
      res.write(`data: ${JSON.stringify(floors)}\n\n`);
      
      const clientId = `floors-${Date.now()}-${Math.random()}`;
      listenerManager.registerClient('floors', res, clientId);
    } catch (error) {
      console.error('[LISTENER] Floors listener error:', error);
      res.write(`data: ${JSON.stringify([])}\n\n`);
      res.end();
    }
  });

  app.get('/api/listen/rooms', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
      const rooms = await storage.getRooms();
      res.write(`data: ${JSON.stringify(rooms)}\n\n`);
      
      const clientId = `rooms-${Date.now()}-${Math.random()}`;
      listenerManager.registerClient('rooms', res, clientId);
    } catch (error) {
      console.error('[LISTENER] Rooms listener error:', error);
      res.write(`data: ${JSON.stringify([])}\n\n`);
      res.end();
    }
  });

  app.get('/api/listen/walkpaths', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
      const walkpaths = await storage.getWalkpaths();
      res.write(`data: ${JSON.stringify(walkpaths)}\n\n`);
      
      const clientId = `walkpaths-${Date.now()}-${Math.random()}`;
      listenerManager.registerClient('walkpaths', res, clientId);
    } catch (error) {
      console.error('[LISTENER] Walkpaths listener error:', error);
      res.write(`data: ${JSON.stringify([])}\n\n`);
      res.end();
    }
  });

  app.get('/api/listen/drivepaths', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
      const drivepaths = await storage.getDrivepaths();
      res.write(`data: ${JSON.stringify(drivepaths)}\n\n`);
      
      const clientId = `drivepaths-${Date.now()}-${Math.random()}`;
      listenerManager.registerClient('drivepaths', res, clientId);
    } catch (error) {
      console.error('[LISTENER] Drivepaths listener error:', error);
      res.write(`data: ${JSON.stringify([])}\n\n`);
      res.end();
    }
  });

  app.get('/api/listen/pwd-paths', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
      const pwdPaths = await storage.getPwdPaths();
      res.write(`data: ${JSON.stringify(pwdPaths)}\n\n`);
      
      const clientId = `pwd-paths-${Date.now()}-${Math.random()}`;
      listenerManager.registerClient('pwd-paths', res, clientId);
    } catch (error) {
      console.error('[LISTENER] PWD-paths listener error:', error);
      res.write(`data: ${JSON.stringify([])}\n\n`);
      res.end();
    }
  });

  app.get('/api/listen/indoor-nodes', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
      const indoorNodes = await storage.getIndoorNodes();
      res.write(`data: ${JSON.stringify(indoorNodes)}\n\n`);
      
      const clientId = `indoor-nodes-${Date.now()}-${Math.random()}`;
      listenerManager.registerClient('indoor-nodes', res, clientId);
    } catch (error) {
      console.error('[LISTENER] Indoor-nodes listener error:', error);
      res.write(`data: ${JSON.stringify([])}\n\n`);
      res.end();
    }
  });

  app.get('/api/listen/room-paths', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
      const roomPaths = await storage.getRoomPaths();
      res.write(`data: ${JSON.stringify(roomPaths)}\n\n`);
      
      const clientId = `room-paths-${Date.now()}-${Math.random()}`;
      listenerManager.registerClient('room-paths', res, clientId);
    } catch (error) {
      console.error('[LISTENER] Room-paths listener error:', error);
      res.write(`data: ${JSON.stringify([])}\n\n`);
      res.end();
    }
  });

  app.get('/api/listen/settings', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
      const settings = await storage.getSettings();
      res.write(`data: ${JSON.stringify(settings)}\n\n`);
      
      const clientId = `settings-${Date.now()}-${Math.random()}`;
      listenerManager.registerClient('settings', res, clientId);
    } catch (error) {
      console.error('[LISTENER] Settings listener error:', error);
      res.write(`data: ${JSON.stringify([])}\n\n`);
      res.end();
    }
  });

  app.get('/api/listen/kiosk-uptime', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
      const uptimes = await storage.getAllKioskUptimes();
      res.write(`data: ${JSON.stringify(uptimes)}\n\n`);
      
      const clientId = `kiosk-uptime-${Date.now()}-${Math.random()}`;
      listenerManager.registerClient('kiosk-uptime', res, clientId);
    } catch (error) {
      console.error('[LISTENER] Kiosk-uptime listener error:', error);
      res.write(`data: ${JSON.stringify([])}\n\n`);
      res.end();
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
