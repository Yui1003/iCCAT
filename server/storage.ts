import { randomUUID } from "crypto";
import { db } from "./db";
import { readFileSync } from "fs";
import { join } from "path";
import type {
  Building, InsertBuilding,
  Floor, InsertFloor,
  Room, InsertRoom,
  Staff, InsertStaff,
  Event, InsertEvent,
  Walkpath, InsertWalkpath,
  Drivepath, InsertDrivepath,
  AdminUser, InsertAdminUser,
  Setting, InsertSetting,
  Feedback, InsertFeedback,
  SavedRoute, InsertSavedRoute
} from "@shared/schema";
import type { AnalyticsEvent, AnalyticsSummary } from "@shared/analytics-schema";
import { AnalyticsEventType } from "@shared/analytics-schema";

let usingFallback = false;
let fallbackData: any = null;
// TEMPORARY: Force fallback mode to use data.json for this Replit session (Firebase quota exceeded)
const FORCE_FALLBACK_MODE = true;

// In-memory storage for savedRoutes (used when Firebase is not available)
const savedRoutesMemory = new Map<string, SavedRoute>();

// In-memory analytics cache (Firestore is source of truth)
const analyticsMemory = new Map<AnalyticsEventType, { events: AnalyticsEvent[] }>();

function loadFallbackData() {
  if (fallbackData) return fallbackData;
  
  try {
    const dataPath = join(process.cwd(), 'data.json');
    fallbackData = JSON.parse(readFileSync(dataPath, 'utf8'));
    
    if (!usingFallback) {
      usingFallback = true;
      console.warn('⚠️ FALLBACK MODE ACTIVATED: Using data.json because Firestore connection failed');
      console.warn('⚠️ Please check your Firebase configuration and serviceAccountKey.json');
    }
    
    return fallbackData;
  } catch (error) {
    console.error('❌ Failed to load fallback data from data.json:', error);
    return { buildings: [], floors: [], rooms: [], staff: [], events: [], walkpaths: [], drivepaths: [], admins: [], settings: [] };
  }
}

export interface IStorage {
  getBuildings(): Promise<Building[]>;
  getBuilding(id: string): Promise<Building | undefined>;
  createBuilding(building: InsertBuilding): Promise<Building>;
  updateBuilding(id: string, building: InsertBuilding): Promise<Building | undefined>;
  deleteBuilding(id: string): Promise<boolean>;

  getFloors(): Promise<Floor[]>;
  getFloor(id: string): Promise<Floor | undefined>;
  getFloorsByBuilding(buildingId: string): Promise<Floor[]>;
  createFloor(floor: InsertFloor): Promise<Floor>;
  updateFloor(id: string, floor: InsertFloor): Promise<Floor | undefined>;
  deleteFloor(id: string): Promise<boolean>;

  getRooms(): Promise<Room[]>;
  getRoom(id: string): Promise<Room | undefined>;
  getRoomsByFloor(floorId: string): Promise<Room[]>;
  getRoomsByBuilding(buildingId: string): Promise<Room[]>;
  createRoom(room: InsertRoom): Promise<Room>;
  updateRoom(id: string, room: InsertRoom): Promise<Room | undefined>;
  deleteRoom(id: string): Promise<boolean>;

  getStaff(): Promise<Staff[]>;
  getStaffMember(id: string): Promise<Staff | undefined>;
  getStaffByBuilding(buildingId: string): Promise<Staff[]>;
  createStaff(staff: InsertStaff): Promise<Staff>;
  updateStaff(id: string, staff: InsertStaff): Promise<Staff | undefined>;
  deleteStaff(id: string): Promise<boolean>;

  getEvents(): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: InsertEvent): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<boolean>;

  getWalkpaths(): Promise<Walkpath[]>;
  getWalkpath(id: string): Promise<Walkpath | undefined>;
  createWalkpath(walkpath: InsertWalkpath): Promise<Walkpath>;
  updateWalkpath(id: string, walkpath: InsertWalkpath): Promise<Walkpath | undefined>;
  deleteWalkpath(id: string): Promise<boolean>;

  getDrivepaths(): Promise<Drivepath[]>;
  getDrivepath(id: string): Promise<Drivepath | undefined>;
  createDrivepath(drivepath: InsertDrivepath): Promise<Drivepath>;
  updateDrivepath(id: string, drivepath: InsertDrivepath): Promise<Drivepath | undefined>;
  deleteDrivepath(id: string): Promise<boolean>;

  getAdminByUsername(username: string): Promise<AdminUser | undefined>;
  createAdmin(admin: InsertAdminUser): Promise<AdminUser>;

  getSettings(): Promise<Setting[]>;
  getSetting(key: string): Promise<Setting | undefined>;
  createSetting(setting: InsertSetting): Promise<Setting>;
  updateSetting(key: string, value: string): Promise<Setting | undefined>;

  getSavedRoute(id: string): Promise<SavedRoute | undefined>;
  createSavedRoute(route: InsertSavedRoute): Promise<SavedRoute>;

  // Analytics
  addAnalyticsEvent(event: AnalyticsEvent): Promise<void>;
  getAnalyticsSummary(): Promise<AnalyticsSummary[]>;
  getAnalyticsExport(): Promise<AnalyticsEvent[]>;
  resetAnalytics(): Promise<void>;

  exportToJSON(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Buildings
  async getBuildings(): Promise<Building[]> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      return data.buildings || [];
    }
    try {
      const snapshot = await db.collection('buildings').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Building));
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.buildings || [];
    }
  }

  async getBuilding(id: string): Promise<Building | undefined> {
    try {
      const doc = await db.collection('buildings').doc(id).get();
      if (!doc.exists) return undefined;
      return { id: doc.id, ...doc.data() } as Building;
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.buildings?.find((b: Building) => b.id === id);
    }
  }

  async createBuilding(insertBuilding: InsertBuilding): Promise<Building> {
    try {
      const id = randomUUID();
      const building = { ...insertBuilding, id, markerIcon: insertBuilding.markerIcon || "building" } as Building;
      await db.collection('buildings').doc(id).set(building);
      return building;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot create building in fallback mode');
    }
  }

  async updateBuilding(id: string, insertBuilding: InsertBuilding): Promise<Building | undefined> {
    try {
      const building = { ...insertBuilding, id, markerIcon: insertBuilding.markerIcon || "building" } as Building;
      await db.collection('buildings').doc(id).set(building);
      return building;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot update building in fallback mode');
    }
  }

  async deleteBuilding(id: string): Promise<boolean> {
    try {
      await db.collection('buildings').doc(id).delete();
      return true;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot delete building in fallback mode');
    }
  }

  // Floors
  async getFloors(): Promise<Floor[]> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      return data.floors || [];
    }
    try {
      const snapshot = await db.collection('floors').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Floor));
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.floors || [];
    }
  }

  async getFloor(id: string): Promise<Floor | undefined> {
    try {
      const doc = await db.collection('floors').doc(id).get();
      if (!doc.exists) return undefined;
      return { id: doc.id, ...doc.data() } as Floor;
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.floors?.find((f: Floor) => f.id === id);
    }
  }

  async getFloorsByBuilding(buildingId: string): Promise<Floor[]> {
    try {
      const snapshot = await db.collection('floors').where('buildingId', '==', buildingId).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Floor));
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.floors?.filter((f: Floor) => f.buildingId === buildingId) || [];
    }
  }

  async createFloor(insertFloor: InsertFloor): Promise<Floor> {
    try {
      const id = randomUUID();
      const floor = { ...insertFloor, id } as Floor;
      await db.collection('floors').doc(id).set(floor);
      return floor;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot create floor in fallback mode');
    }
  }

  async updateFloor(id: string, insertFloor: InsertFloor): Promise<Floor | undefined> {
    try {
      const floor = { ...insertFloor, id } as Floor;
      await db.collection('floors').doc(id).set(floor);
      return floor;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot update floor in fallback mode');
    }
  }

  async deleteFloor(id: string): Promise<boolean> {
    try {
      await db.collection('floors').doc(id).delete();
      return true;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot delete floor in fallback mode');
    }
  }

  // Rooms
  async getRooms(): Promise<Room[]> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      return data.rooms || [];
    }
    try {
      const snapshot = await db.collection('rooms').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.rooms || [];
    }
  }

  async getRoom(id: string): Promise<Room | undefined> {
    try {
      const doc = await db.collection('rooms').doc(id).get();
      if (!doc.exists) return undefined;
      return { id: doc.id, ...doc.data() } as Room;
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.rooms?.find((r: Room) => r.id === id);
    }
  }

  async getRoomsByFloor(floorId: string): Promise<Room[]> {
    try {
      const snapshot = await db.collection('rooms').where('floorId', '==', floorId).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.rooms?.filter((r: Room) => r.floorId === floorId) || [];
    }
  }

  async getRoomsByBuilding(buildingId: string): Promise<Room[]> {
    try {
      const snapshot = await db.collection('rooms').where('buildingId', '==', buildingId).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.rooms?.filter((r: Room) => r.buildingId === buildingId) || [];
    }
  }

  async createRoom(insertRoom: InsertRoom): Promise<Room> {
    try {
      const id = randomUUID();
      const room = { ...insertRoom, id } as Room;
      await db.collection('rooms').doc(id).set(room);
      return room;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot create room in fallback mode');
    }
  }

  async updateRoom(id: string, insertRoom: InsertRoom): Promise<Room | undefined> {
    try {
      const room = { ...insertRoom, id } as Room;
      await db.collection('rooms').doc(id).set(room);
      return room;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot update room in fallback mode');
    }
  }

  async deleteRoom(id: string): Promise<boolean> {
    try {
      await db.collection('rooms').doc(id).delete();
      return true;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot delete room in fallback mode');
    }
  }

  // Staff
  async getStaff(): Promise<Staff[]> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      return data.staff || [];
    }
    try {
      const snapshot = await db.collection('staff').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.staff || [];
    }
  }

  async getStaffMember(id: string): Promise<Staff | undefined> {
    try {
      const doc = await db.collection('staff').doc(id).get();
      if (!doc.exists) return undefined;
      return { id: doc.id, ...doc.data() } as Staff;
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.staff?.find((s: Staff) => s.id === id);
    }
  }

  async getStaffByBuilding(buildingId: string): Promise<Staff[]> {
    try {
      const snapshot = await db.collection('staff').where('buildingId', '==', buildingId).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.staff?.filter((s: Staff) => s.buildingId === buildingId) || [];
    }
  }

  async createStaff(insertStaff: InsertStaff): Promise<Staff> {
    try {
      const id = randomUUID();
      const staffMember = { ...insertStaff, id } as Staff;
      await db.collection('staff').doc(id).set(staffMember);
      return staffMember;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot create staff in fallback mode');
    }
  }

  async updateStaff(id: string, insertStaff: InsertStaff): Promise<Staff | undefined> {
    try {
      const staffMember = { ...insertStaff, id } as Staff;
      await db.collection('staff').doc(id).set(staffMember);
      return staffMember;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot update staff in fallback mode');
    }
  }

  async deleteStaff(id: string): Promise<boolean> {
    try {
      await db.collection('staff').doc(id).delete();
      return true;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot delete staff in fallback mode');
    }
  }

  // Events
  async getEvents(): Promise<Event[]> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      return data.events || [];
    }
    try {
      const snapshot = await db.collection('events').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.events || [];
    }
  }

  async getEvent(id: string): Promise<Event | undefined> {
    try {
      const doc = await db.collection('events').doc(id).get();
      if (!doc.exists) return undefined;
      return { id: doc.id, ...doc.data() } as Event;
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.events?.find((e: Event) => e.id === id);
    }
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    try {
      const id = randomUUID();
      const event = { ...insertEvent, id, classification: insertEvent.classification || "Event" } as Event;
      await db.collection('events').doc(id).set(event);
      return event;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot create event in fallback mode');
    }
  }

  async updateEvent(id: string, insertEvent: InsertEvent): Promise<Event | undefined> {
    try {
      const event = { ...insertEvent, id, classification: insertEvent.classification || "Event" } as Event;
      await db.collection('events').doc(id).set(event);
      return event;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot update event in fallback mode');
    }
  }

  async deleteEvent(id: string): Promise<boolean> {
    try {
      await db.collection('events').doc(id).delete();
      return true;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot delete event in fallback mode');
    }
  }

  // Walkpaths
  async getWalkpaths(): Promise<Walkpath[]> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      return data.walkpaths || [];
    }
    try {
      const snapshot = await db.collection('walkpaths').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Walkpath));
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.walkpaths || [];
    }
  }

  async getWalkpath(id: string): Promise<Walkpath | undefined> {
    try {
      const doc = await db.collection('walkpaths').doc(id).get();
      if (!doc.exists) return undefined;
      return { id: doc.id, ...doc.data() } as Walkpath;
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.walkpaths?.find((w: Walkpath) => w.id === id);
    }
  }

  async createWalkpath(insertWalkpath: InsertWalkpath): Promise<Walkpath> {
    try {
      const id = randomUUID();
      const walkpath = { ...insertWalkpath, id } as Walkpath;
      await db.collection('walkpaths').doc(id).set(walkpath);
      return walkpath;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot create walkpath in fallback mode');
    }
  }

  async updateWalkpath(id: string, insertWalkpath: InsertWalkpath): Promise<Walkpath | undefined> {
    try {
      const walkpath = { ...insertWalkpath, id } as Walkpath;
      await db.collection('walkpaths').doc(id).set(walkpath);
      return walkpath;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot update walkpath in fallback mode');
    }
  }

  async deleteWalkpath(id: string): Promise<boolean> {
    try {
      await db.collection('walkpaths').doc(id).delete();
      return true;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot delete walkpath in fallback mode');
    }
  }

  // Drivepaths
  async getDrivepaths(): Promise<Drivepath[]> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      return data.drivepaths || [];
    }
    try {
      const snapshot = await db.collection('drivepaths').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Drivepath));
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.drivepaths || [];
    }
  }

  async getDrivepath(id: string): Promise<Drivepath | undefined> {
    try {
      const doc = await db.collection('drivepaths').doc(id).get();
      if (!doc.exists) return undefined;
      return { id: doc.id, ...doc.data() } as Drivepath;
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.drivepaths?.find((d: Drivepath) => d.id === id);
    }
  }

  async createDrivepath(insertDrivepath: InsertDrivepath): Promise<Drivepath> {
    try {
      const id = randomUUID();
      const drivepath = { ...insertDrivepath, id } as Drivepath;
      await db.collection('drivepaths').doc(id).set(drivepath);
      return drivepath;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot create drivepath in fallback mode');
    }
  }

  async updateDrivepath(id: string, insertDrivepath: InsertDrivepath): Promise<Drivepath | undefined> {
    try {
      const drivepath = { ...insertDrivepath, id } as Drivepath;
      await db.collection('drivepaths').doc(id).set(drivepath);
      return drivepath;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot update drivepath in fallback mode');
    }
  }

  async deleteDrivepath(id: string): Promise<boolean> {
    try {
      await db.collection('drivepaths').doc(id).delete();
      return true;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot delete drivepath in fallback mode');
    }
  }

  // Admin
  async getAdminByUsername(username: string): Promise<AdminUser | undefined> {
    try {
      const snapshot = await db.collection('admins').where('username', '==', username).get();
      if (snapshot.empty) return undefined;
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as AdminUser;
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.admins?.find((a: AdminUser) => a.username === username);
    }
  }

  async createAdmin(insertAdmin: InsertAdminUser): Promise<AdminUser> {
    try {
      const id = randomUUID();
      const admin: AdminUser = { ...insertAdmin, id };
      await db.collection('admins').doc(id).set(admin);
      return admin;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot create admin in fallback mode');
    }
  }

  // Settings
  async getSettings(): Promise<Setting[]> {
    try {
      const snapshot = await db.collection('settings').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Setting));
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.settings || [];
    }
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    try {
      const snapshot = await db.collection('settings').where('key', '==', key).get();
      if (snapshot.empty) return undefined;
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Setting;
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.settings?.find((s: Setting) => s.key === key);
    }
  }

  async createSetting(insertSetting: InsertSetting): Promise<Setting> {
    try {
      const id = randomUUID();
      const setting: Setting = { 
        ...insertSetting, 
        id,
        description: insertSetting.description ?? null
      };
      await db.collection('settings').doc(id).set(setting);
      return setting;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot create setting in fallback mode');
    }
  }

  async updateSetting(key: string, value: string): Promise<Setting | undefined> {
    try {
      const existing = await this.getSetting(key);
      if (!existing) {
        return undefined;
      }
      const updated: Setting = { 
        id: existing.id,
        key: existing.key,
        value,
        description: existing.description ?? null
      };
      await db.collection('settings').doc(existing.id).set(updated);
      return updated;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot update setting in fallback mode');
    }
  }

  // Saved Routes
  async getSavedRoute(id: string): Promise<SavedRoute | undefined> {
    try {
      const doc = await db.collection('savedRoutes').doc(id).get();
      if (!doc.exists) {
        return undefined;
      }
      return { id: doc.id, ...doc.data() } as SavedRoute;
    } catch (error) {
      console.error('Firestore error, checking in-memory storage:', error);
      // Fallback to in-memory storage
      return savedRoutesMemory.get(id);
    }
  }

  async createSavedRoute(route: InsertSavedRoute): Promise<SavedRoute> {
    try {
      const id = randomUUID();
      const savedRoute: SavedRoute = { 
        id,
        startId: route.startId,
        endId: route.endId,
        waypoints: Array.isArray(route.waypoints) ? route.waypoints : [],
        mode: route.mode,
        vehicleType: route.vehicleType ?? null,
        phases: route.phases,
        createdAt: new Date(),
        expiresAt: route.expiresAt ?? null
      };
      await db.collection('savedRoutes').doc(id).set(savedRoute);
      return savedRoute;
    } catch (error) {
      console.error('Firestore error, using in-memory storage:', error);
      // Fallback to in-memory storage
      const id = randomUUID();
      const savedRoute: SavedRoute = { 
        id,
        startId: route.startId,
        endId: route.endId,
        waypoints: Array.isArray(route.waypoints) ? route.waypoints : [],
        mode: route.mode,
        vehicleType: route.vehicleType ?? null,
        phases: route.phases,
        createdAt: new Date(),
        expiresAt: route.expiresAt ?? null
      };
      savedRoutesMemory.set(id, savedRoute);
      console.log('Route saved to in-memory storage with ID:', id);
      return savedRoute;
    }
  }

  // Analytics - Persisted to Firestore (source of truth)
  async addAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
    try {
      const id = randomUUID();
      const eventWithId = { ...event, id };
      
      // Save to Firestore (persisted - survives server restart)
      await db.collection('analytics').doc(id).set(eventWithId);
      
      // Update in-memory cache for quick access
      if (!analyticsMemory.has(event.eventType)) {
        analyticsMemory.set(event.eventType, { events: [] });
      }
      const typeData = analyticsMemory.get(event.eventType)!;
      typeData.events.push(eventWithId);
      
      console.log(`[Analytics] Event persisted to Firestore: ${event.eventType} (${event.responseTime}ms)`);
    } catch (error) {
      console.error('Error adding analytics event to Firestore:', error);
    }
  }

  async getAnalyticsSummary(): Promise<AnalyticsSummary[]> {
    try {
      // Fetch all events from Firestore for accurate aggregation
      const snapshot = await db.collection('analytics').get();
      const allEvents = snapshot.docs.map(doc => doc.data() as AnalyticsEvent);
      
      // Group by event type and calculate statistics
      const eventsByType = new Map<AnalyticsEventType, AnalyticsEvent[]>();
      
      for (const event of allEvents) {
        if (!eventsByType.has(event.eventType)) {
          eventsByType.set(event.eventType, []);
        }
        eventsByType.get(event.eventType)!.push(event);
      }

      const summaries: AnalyticsSummary[] = [];
      
      for (const [eventType, events] of eventsByType) {
        if (events.length === 0) continue;

        const responseTimes = events.map(e => e.responseTime);
        const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        const minResponseTime = Math.min(...responseTimes);
        const maxResponseTime = Math.max(...responseTimes);

        summaries.push({
          eventType,
          totalCount: events.length,
          averageResponseTime,
          minResponseTime,
          maxResponseTime,
          lastUpdated: Date.now()
        });
      }

      // Update in-memory cache
      analyticsMemory.clear();
      for (const [eventType, events] of eventsByType) {
        analyticsMemory.set(eventType, { events });
      }

      return summaries;
    } catch (error) {
      console.error('Error retrieving analytics summary from Firestore:', error);
      return [];
    }
  }

  async getAnalyticsExport(): Promise<AnalyticsEvent[]> {
    try {
      // Export all events from Firestore
      const snapshot = await db.collection('analytics').get();
      return snapshot.docs.map(doc => doc.data() as AnalyticsEvent);
    } catch (error) {
      console.error('Error exporting analytics from Firestore:', error);
      return [];
    }
  }

  async resetAnalytics(): Promise<void> {
    try {
      const snapshot = await db.collection('analytics').get();
      const batch = db.batch();
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      analyticsMemory.clear();
      console.log('[Analytics] All analytics data cleared from Firestore');
    } catch (error) {
      console.error('Error resetting analytics:', error);
      // Clear in-memory cache on error (graceful fallback)
      analyticsMemory.clear();
      console.log('[Analytics] Cleared in-memory analytics cache');
    }
  }

  async exportToJSON(): Promise<void> {
    console.log('Export to JSON skipped - Firestore is the source of truth');
  }

  // Feedback
  async getFeedbacks(): Promise<Feedback[]> {
    try {
      const snapshot = await db.collection('feedbacks').orderBy('timestamp', 'desc').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Feedback));
    } catch (error) {
      console.error('Firestore error for feedbacks:', error);
      return [];
    }
  }

  async clearAllFeedback(): Promise<void> {
    try {
      const snapshot = await db.collection('feedbacks').get();
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`Cleared ${snapshot.docs.length} feedback records`);
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot clear feedback');
    }
  }

  async createFeedback(insertFeedback: InsertFeedback): Promise<Feedback> {
    try {
      const id = randomUUID();
      
      // Auto-generate sequential user number
      const allFeedbacks = await this.getFeedbacks();
      const maxUserId = allFeedbacks.length > 0
        ? Math.max(...allFeedbacks.map(f => f.userId))
        : 0;
      const userId = maxUserId + 1;
      
      // Calculate category averages
      const avgFunctionalSuitability = (
        insertFeedback.functionalCompleteness +
        insertFeedback.functionalCorrectness +
        insertFeedback.functionalAppropriateness
      ) / 3;
      
      const avgPerformanceEfficiency = (
        insertFeedback.timeBehaviour +
        insertFeedback.resourceUtilization +
        insertFeedback.capacity
      ) / 3;
      
      const avgCompatibility = (
        insertFeedback.coExistence +
        insertFeedback.interoperability
      ) / 2;
      
      const avgUsability = (
        insertFeedback.appropriatenessRecognizability +
        insertFeedback.learnability +
        insertFeedback.operability +
        insertFeedback.userErrorProtection +
        insertFeedback.uiAesthetics +
        insertFeedback.accessibility
      ) / 6;
      
      const avgReliability = (
        insertFeedback.maturity +
        insertFeedback.availability +
        insertFeedback.faultTolerance +
        insertFeedback.recoverability
      ) / 4;
      
      const avgSecurity = (
        insertFeedback.confidentiality +
        insertFeedback.integrity +
        insertFeedback.nonRepudiation +
        insertFeedback.accountability +
        insertFeedback.authenticity
      ) / 5;
      
      const avgMaintainability = (
        insertFeedback.modularity +
        insertFeedback.reusability +
        insertFeedback.analysability +
        insertFeedback.modifiability +
        insertFeedback.testability
      ) / 5;
      
      const avgPortability = (
        insertFeedback.adaptability +
        insertFeedback.installability +
        insertFeedback.replaceability
      ) / 3;
      
      const avgUxItems = (
        insertFeedback.clarityOfInstructions +
        insertFeedback.comfortAndErgonomics +
        insertFeedback.navigationIntuitiveness +
        insertFeedback.userSatisfaction
      ) / 4;
      
      const feedback: Feedback = {
        id,
        userId,
        ...insertFeedback,
        comments: insertFeedback.comments ?? null,
        timestamp: new Date(),
        avgFunctionalSuitability,
        avgPerformanceEfficiency,
        avgCompatibility,
        avgUsability,
        avgReliability,
        avgSecurity,
        avgMaintainability,
        avgPortability,
        avgUxItems
      };
      
      await db.collection('feedbacks').doc(id).set(feedback);
      return feedback;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot create feedback');
    }
  }
}

export const storage = new DatabaseStorage();
