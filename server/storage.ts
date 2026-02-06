import { randomUUID } from "crypto";
import { db } from "./db";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type {
  Building, InsertBuilding,
  Floor, InsertFloor,
  Room, InsertRoom,
  Staff, InsertStaff,
  Event, InsertEvent,
  Walkpath, InsertWalkpath,
  Drivepath, InsertDrivepath,
  PwdPath, InsertPwdPath,
  AdminUser, InsertAdminUser,
  Setting, InsertSetting,
  Feedback, InsertFeedback,
  SavedRoute, InsertSavedRoute,
  IndoorNode, InsertIndoorNode,
  RoomPath, InsertRoomPath,
  KioskUptime, InsertKioskUptime,
  RoutePhase
} from "@shared/schema";
import type { AnalyticsEvent, AnalyticsSummary } from "@shared/analytics-schema";
import { AnalyticsEventType } from "@shared/analytics-schema";

let usingFallback = false;
let fallbackData: any = null;
// Set to false to use Firebase, true to use data.json fallback
const FORCE_FALLBACK_MODE = false;

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
    return { buildings: [], floors: [], rooms: [], staff: [], events: [], walkpaths: [], drivepaths: [], admins: [], settings: [], indoorNodes: [], roomPaths: [] };
  }
}

function saveFallbackData() {
  if (!fallbackData) return;
  
  try {
    const dataPath = join(process.cwd(), 'data.json');
    writeFileSync(dataPath, JSON.stringify(fallbackData, null, 2), 'utf8');
    console.log('✅ Fallback data saved to data.json');
  } catch (error) {
    console.error('❌ Failed to save fallback data to data.json:', error);
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

  // PWD Paths - wheelchair-accessible paths
  getPwdPaths(): Promise<PwdPath[]>;
  getPwdPath(id: string): Promise<PwdPath | undefined>;
  createPwdPath(pwdPath: InsertPwdPath): Promise<PwdPath>;
  updatePwdPath(id: string, pwdPath: InsertPwdPath): Promise<PwdPath | undefined>;
  deletePwdPath(id: string): Promise<boolean>;

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
  getMobileNavigationCount(): Promise<number>;
  resetAnalytics(): Promise<void>;

  exportToJSON(): Promise<void>;

  // Indoor Nodes - for indoor navigation
  getIndoorNodes(): Promise<IndoorNode[]>;
  getIndoorNode(id: string): Promise<IndoorNode | undefined>;
  getIndoorNodesByFloor(floorId: string): Promise<IndoorNode[]>;
  createIndoorNode(node: InsertIndoorNode): Promise<IndoorNode>;
  updateIndoorNode(id: string, node: InsertIndoorNode): Promise<IndoorNode | undefined>;
  deleteIndoorNode(id: string): Promise<boolean>;

  // Room Paths - for indoor navigation paths
  getRoomPaths(): Promise<RoomPath[]>;
  getRoomPath(id: string): Promise<RoomPath | undefined>;
  getRoomPathsByFloor(floorId: string): Promise<RoomPath[]>;
  createRoomPath(path: InsertRoomPath): Promise<RoomPath>;
  updateRoomPath(id: string, path: InsertRoomPath): Promise<RoomPath | undefined>;
  deleteRoomPath(id: string): Promise<boolean>;

  // Kiosk Uptime - for tracking per-device uptime
  getKioskUptime(deviceId: string): Promise<KioskUptime | undefined>;
  startKioskSession(deviceId: string, appVersion?: string): Promise<KioskUptime>;
  updateKioskHeartbeat(deviceId: string, status: string, totalRequests: number, successfulRequests: number, uptimePercentage: number): Promise<KioskUptime | undefined>;
  endKioskSession(deviceId: string, totalRequests: number, successfulRequests: number, uptimePercentage: number): Promise<KioskUptime | undefined>;
  getAllKioskUptimes(): Promise<KioskUptime[]>;
  deleteAllKioskUptimes(): Promise<void>;
  deleteKioskUptime(id: string): Promise<boolean>;
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
      const building = { 
        ...insertBuilding, 
        id, 
        markerIcon: insertBuilding.markerIcon || "building",
        nodeLat: insertBuilding.nodeLat ?? null,
        nodeLng: insertBuilding.nodeLng ?? null
      } as Building;
      await db.collection('buildings').doc(id).set(building);
      return building;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot create building in fallback mode');
    }
  }

  async updateBuilding(id: string, insertBuilding: InsertBuilding): Promise<Building | undefined> {
    try {
      const building = { 
        ...insertBuilding, 
        id, 
        markerIcon: insertBuilding.markerIcon || "building",
        nodeLat: insertBuilding.nodeLat ?? null,
        nodeLng: insertBuilding.nodeLng ?? null
      } as Building;
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
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      const id = randomUUID();
      const floor = { ...insertFloor, id } as Floor;
      if (!data.floors) data.floors = [];
      data.floors.push(floor);
      saveFallbackData();
      return floor;
    }
    try {
      const id = randomUUID();
      const floor = { ...insertFloor, id } as Floor;
      await db.collection('floors').doc(id).set(floor);
      return floor;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot create floor');
    }
  }

  async updateFloor(id: string, insertFloor: InsertFloor): Promise<Floor | undefined> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      const floor = { ...insertFloor, id } as Floor;
      const index = data.floors?.findIndex((f: Floor) => f.id === id);
      if (index !== undefined && index >= 0) {
        data.floors[index] = floor;
      } else {
        if (!data.floors) data.floors = [];
        data.floors.push(floor);
      }
      saveFallbackData();
      return floor;
    }
    try {
      const floor = { ...insertFloor, id } as Floor;
      await db.collection('floors').doc(id).set(floor);
      return floor;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot update floor');
    }
  }

  async deleteFloor(id: string): Promise<boolean> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      const index = data.floors?.findIndex((f: Floor) => f.id === id);
      if (index !== undefined && index >= 0) {
        data.floors.splice(index, 1);
        saveFallbackData();
        return true;
      }
      return false;
    }
    try {
      await db.collection('floors').doc(id).delete();
      return true;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot delete floor');
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

  // PWD Paths - wheelchair-accessible paths
  async getPwdPaths(): Promise<PwdPath[]> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      return data.pwdPaths || [];
    }
    try {
      const snapshot = await db.collection('pwdPaths').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PwdPath));
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.pwdPaths || [];
    }
  }

  async getPwdPath(id: string): Promise<PwdPath | undefined> {
    try {
      const doc = await db.collection('pwdPaths').doc(id).get();
      if (!doc.exists) return undefined;
      return { id: doc.id, ...doc.data() } as PwdPath;
    } catch (error) {
      console.error('Firestore error, using fallback:', error);
      const data = loadFallbackData();
      return data.pwdPaths?.find((p: PwdPath) => p.id === id);
    }
  }

  async createPwdPath(insertPwdPath: InsertPwdPath): Promise<PwdPath> {
    try {
      const id = randomUUID();
      const pwdPath = { ...insertPwdPath, id } as PwdPath;
      await db.collection('pwdPaths').doc(id).set(pwdPath);
      return pwdPath;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot create PWD path in fallback mode');
    }
  }

  async updatePwdPath(id: string, insertPwdPath: InsertPwdPath): Promise<PwdPath | undefined> {
    try {
      const pwdPath = { ...insertPwdPath, id } as PwdPath;
      await db.collection('pwdPaths').doc(id).set(pwdPath);
      return pwdPath;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot update PWD path in fallback mode');
    }
  }

  async deletePwdPath(id: string): Promise<boolean> {
    try {
      await db.collection('pwdPaths').doc(id).delete();
      return true;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot delete PWD path in fallback mode');
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
      const waypoints = Array.isArray(route.waypoints) ? (route.waypoints as string[]) : [];
      const phases = Array.isArray(route.phases) ? (route.phases as RoutePhase[]) : [];
      const savedRoute: SavedRoute = { 
        id,
        startId: route.startId,
        endId: route.endId,
        waypoints,
        mode: route.mode,
        vehicleType: route.vehicleType ?? null,
        phases,
        createdAt: new Date(),
        expiresAt: route.expiresAt ?? null,
        // Indoor navigation fields
        destinationRoomId: route.destinationRoomId ?? null,
        destinationBuildingId: route.destinationBuildingId ?? null,
        destinationFloorId: route.destinationFloorId ?? null,
        destinationRoomName: route.destinationRoomName ?? null
      };
      await db.collection('savedRoutes').doc(id).set(savedRoute);
      return savedRoute;
    } catch (error) {
      console.error('Firestore error, using in-memory storage:', error);
      // Fallback to in-memory storage
      const id = randomUUID();
      const waypoints = Array.isArray(route.waypoints) ? (route.waypoints as string[]) : [];
      const phases = Array.isArray(route.phases) ? (route.phases as RoutePhase[]) : [];
      const savedRoute: SavedRoute = { 
        id,
        startId: route.startId,
        endId: route.endId,
        waypoints,
        mode: route.mode,
        vehicleType: route.vehicleType ?? null,
        phases,
        createdAt: new Date(),
        expiresAt: route.expiresAt ?? null,
        // Indoor navigation fields
        destinationRoomId: route.destinationRoomId ?? null,
        destinationBuildingId: route.destinationBuildingId ?? null,
        destinationFloorId: route.destinationFloorId ?? null,
        destinationRoomName: route.destinationRoomName ?? null
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
      
      for (const [eventType, events] of Array.from(eventsByType)) {
        if (events.length === 0) continue;

        const responseTimes = events.map((e: AnalyticsEvent) => e.responseTime);
        const averageResponseTime = responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length;
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
      for (const [eventType, events] of Array.from(eventsByType)) {
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

  async getMobileNavigationCount(): Promise<number> {
    try {
      // Count all INTERFACE_ACTION events with action 'mobile_navigation_opened'
      const snapshot = await db.collection('analytics')
        .where('eventType', '==', AnalyticsEventType.INTERFACE_ACTION)
        .get();
      
      let count = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.metadata && data.metadata.action === 'mobile_navigation_opened') {
          count++;
        }
      });
      
      return count;
    } catch (error) {
      console.error('Error getting mobile navigation count from Firestore:', error);
      return 0;
    }
  }

  async resetAnalytics(): Promise<void> {
    try {
      const batch = db.batch();
      
      // Delete all analytics events
      const analyticsSnapshot = await db.collection('analytics').get();
      analyticsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Delete all kiosk uptime records
      const kioskSnapshot = await db.collection('kioskUptimes').get();
      kioskSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      analyticsMemory.clear();
      console.log('[Analytics] All analytics data and kiosk uptime records cleared from Firestore');
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

  // Indoor Nodes (Firebase collection: indoor_nodes)
  async getIndoorNodes(): Promise<IndoorNode[]> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      return data.indoorNodes || [];
    }
    try {
      const snapshot = await db.collection('indoor_nodes').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IndoorNode));
    } catch (error) {
      console.error('Firestore error for indoor_nodes:', error);
      const data = loadFallbackData();
      return data.indoorNodes || [];
    }
  }

  async getIndoorNode(id: string): Promise<IndoorNode | undefined> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      return (data.indoorNodes || []).find((n: IndoorNode) => n.id === id);
    }
    try {
      const doc = await db.collection('indoor_nodes').doc(id).get();
      if (!doc.exists) return undefined;
      return { id: doc.id, ...doc.data() } as IndoorNode;
    } catch (error) {
      console.error('Firestore error:', error);
      const data = loadFallbackData();
      return (data.indoorNodes || []).find((n: IndoorNode) => n.id === id);
    }
  }

  async getIndoorNodesByFloor(floorId: string): Promise<IndoorNode[]> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      return (data.indoorNodes || []).filter((n: IndoorNode) => n.floorId === floorId);
    }
    try {
      const snapshot = await db.collection('indoor_nodes').where('floorId', '==', floorId).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IndoorNode));
    } catch (error) {
      console.error('Firestore error:', error);
      const data = loadFallbackData();
      return (data.indoorNodes || []).filter((n: IndoorNode) => n.floorId === floorId);
    }
  }

  async createIndoorNode(node: InsertIndoorNode): Promise<IndoorNode> {
    const id = randomUUID();
    const newNode: IndoorNode = { 
      id, 
      ...node,
      label: node.label ?? null,
      description: node.description ?? null
    } as IndoorNode;
    
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      if (!data.indoorNodes) data.indoorNodes = [];
      data.indoorNodes.push(newNode);
      saveFallbackData();
      return newNode;
    }
    
    try {
      await db.collection('indoor_nodes').doc(id).set(newNode);
      return newNode;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot create indoor node');
    }
  }

  async updateIndoorNode(id: string, node: InsertIndoorNode): Promise<IndoorNode | undefined> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      const index = (data.indoorNodes || []).findIndex((n: IndoorNode) => n.id === id);
      if (index === -1) return undefined;
      const updatedNode: IndoorNode = { 
        id, 
        ...node,
        label: node.label ?? null,
        description: node.description ?? null
      } as IndoorNode;
      data.indoorNodes[index] = updatedNode;
      saveFallbackData();
      return updatedNode;
    }
    
    try {
      const docRef = db.collection('indoor_nodes').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return undefined;
      await docRef.update(node as any);
      return { 
        id, 
        ...node,
        label: node.label ?? null,
        description: node.description ?? null
      } as IndoorNode;
    } catch (error) {
      console.error('Firestore error:', error);
      return undefined;
    }
  }

  async deleteIndoorNode(id: string): Promise<boolean> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      const index = (data.indoorNodes || []).findIndex((n: IndoorNode) => n.id === id);
      if (index === -1) return false;
      data.indoorNodes.splice(index, 1);
      saveFallbackData();
      return true;
    }
    
    try {
      await db.collection('indoor_nodes').doc(id).delete();
      return true;
    } catch (error) {
      console.error('Firestore error:', error);
      return false;
    }
  }

  // Room Paths (Firebase collection: room_paths)
  async getRoomPaths(): Promise<RoomPath[]> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      return data.roomPaths || [];
    }
    try {
      const snapshot = await db.collection('room_paths').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoomPath));
    } catch (error) {
      console.error('Firestore error for room_paths:', error);
      const data = loadFallbackData();
      return data.roomPaths || [];
    }
  }

  async getRoomPath(id: string): Promise<RoomPath | undefined> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      return (data.roomPaths || []).find((p: RoomPath) => p.id === id);
    }
    try {
      const doc = await db.collection('room_paths').doc(id).get();
      if (!doc.exists) return undefined;
      return { id: doc.id, ...doc.data() } as RoomPath;
    } catch (error) {
      console.error('Firestore error:', error);
      const data = loadFallbackData();
      return (data.roomPaths || []).find((p: RoomPath) => p.id === id);
    }
  }

  async getRoomPathsByFloor(floorId: string): Promise<RoomPath[]> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      return (data.roomPaths || []).filter((p: RoomPath) => p.floorId === floorId);
    }
    try {
      const snapshot = await db.collection('room_paths').where('floorId', '==', floorId).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoomPath));
    } catch (error) {
      console.error('Firestore error:', error);
      const data = loadFallbackData();
      return (data.roomPaths || []).filter((p: RoomPath) => p.floorId === floorId);
    }
  }

  async createRoomPath(path: InsertRoomPath): Promise<RoomPath> {
    const id = randomUUID();
    const newPath: RoomPath = { 
      id, 
      ...path,
      name: path.name ?? null
    } as RoomPath;
    
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      if (!data.roomPaths) data.roomPaths = [];
      data.roomPaths.push(newPath);
      saveFallbackData();
      return newPath;
    }
    
    try {
      await db.collection('room_paths').doc(id).set(newPath);
      return newPath;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot create room path');
    }
  }

  async updateRoomPath(id: string, path: InsertRoomPath): Promise<RoomPath | undefined> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      const index = (data.roomPaths || []).findIndex((p: RoomPath) => p.id === id);
      if (index === -1) return undefined;
      const updatedPath: RoomPath = { 
        id, 
        ...path,
        name: path.name ?? null
      } as RoomPath;
      data.roomPaths[index] = updatedPath;
      saveFallbackData();
      return updatedPath;
    }
    
    try {
      const docRef = db.collection('room_paths').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return undefined;
      await docRef.update(path as any);
      return { 
        id, 
        ...path,
        name: path.name ?? null
      } as RoomPath;
    } catch (error) {
      console.error('Firestore error:', error);
      return undefined;
    }
  }

  async deleteRoomPath(id: string): Promise<boolean> {
    if (FORCE_FALLBACK_MODE) {
      const data = loadFallbackData();
      const index = (data.roomPaths || []).findIndex((p: RoomPath) => p.id === id);
      if (index === -1) return false;
      data.roomPaths.splice(index, 1);
      saveFallbackData();
      return true;
    }
    
    try {
      await db.collection('room_paths').doc(id).delete();
      return true;
    } catch (error) {
      console.error('Firestore error:', error);
      return false;
    }
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

  // Kiosk Uptime - per-device tracking
  async getKioskUptime(deviceId: string): Promise<KioskUptime | undefined> {
    try {
      const doc = await db.collection('kioskUptimes').doc(deviceId).get();
      if (!doc.exists) return undefined;
      return { id: doc.id, ...doc.data() } as KioskUptime;
    } catch (error) {
      console.error('Firestore error:', error);
      return undefined;
    }
  }

  async startKioskSession(deviceId: string, appVersion?: string): Promise<KioskUptime> {
    try {
      const now = new Date();
      const uptimeData: any = {
        deviceId,
        sessionStart: now,
        lastHeartbeat: now,
        totalRequests: 0,
        successfulRequests: 0,
        uptimePercentage: 100,
        status: 'active',
        sessionEnd: null,
      };
      if (appVersion) {
        uptimeData.appVersion = appVersion;
      }
      await db.collection('kioskUptimes').doc(deviceId).set(uptimeData);
      return { id: deviceId, ...uptimeData } as KioskUptime;
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Cannot start kiosk session');
    }
  }

  async updateKioskHeartbeat(deviceId: string, status: string, totalRequests: number, successfulRequests: number, uptimePercentage: number): Promise<KioskUptime | undefined> {
    try {
      const now = new Date();
      const docRef = db.collection('kioskUptimes').doc(deviceId);
      const existingDoc = await docRef.get();
      
      // Safeguard: Only update if the document exists (session was properly started)
      // This prevents orphaned records with missing sessionStart
      if (!existingDoc.exists) {
        console.warn(`[KIOSK-UPTIME] Heartbeat rejected: No session found for device ${deviceId}. Device must call /start first.`);
        return undefined;
      }
      
      // Update heartbeat with status - this reactivates the session when returning from standby
      // Session continues running during standby, only ends when app is closed
      await docRef.set({
        status: status, // 'active' or 'standby' from client
        totalRequests,
        successfulRequests,
        uptimePercentage,
        lastHeartbeat: now,
        sessionEnd: null, // Clear session end when heartbeat received (session still active)
      }, { merge: true });
      const doc = await docRef.get();
      console.log(`[KIOSK-UPTIME] Heartbeat received for ${deviceId}, status: ${status}`);
      return { id: doc.id, ...doc.data() } as KioskUptime;
    } catch (error) {
      console.error('Firestore error:', error);
      return undefined;
    }
  }

  async endKioskSession(deviceId: string, totalRequests: number, successfulRequests: number, uptimePercentage: number): Promise<KioskUptime | undefined> {
    try {
      const now = new Date();
      await db.collection('kioskUptimes').doc(deviceId).set({
        status: 'inactive',
        totalRequests,
        successfulRequests,
        uptimePercentage,
        lastHeartbeat: now,
        sessionEnd: now,
      }, { merge: true });
      console.log(`[KIOSK-UPTIME] Session ended for ${deviceId}, status: inactive`);
      const doc = await db.collection('kioskUptimes').doc(deviceId).get();
      return { id: doc.id, ...doc.data() } as KioskUptime;
    } catch (error) {
      console.error('Firestore error:', error);
      return undefined;
    }
  }

  async getAllKioskUptimes(): Promise<KioskUptime[]> {
    try {
      const snapshot = await db.collection('kioskUptimes').get();
      const now = new Date();
      const STALE_TIMEOUT_MS = 60000; // 60 seconds - if no heartbeat in this time, mark as inactive
      
      const uptimes: KioskUptime[] = [];
      const staleDevices: string[] = [];
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const uptime = { id: doc.id, ...data } as KioskUptime;
        
        // Check if device is active/standby but hasn't sent heartbeat recently
        // Both active and standby should send heartbeats, only inactive means app closed
        if ((uptime.status === 'active' || uptime.status === 'standby') && uptime.lastHeartbeat) {
          const lastHeartbeatTime = uptime.lastHeartbeat instanceof Date 
            ? uptime.lastHeartbeat 
            : (uptime.lastHeartbeat as any).toDate ? (uptime.lastHeartbeat as any).toDate() : new Date(uptime.lastHeartbeat);
          
          const timeSinceHeartbeat = now.getTime() - lastHeartbeatTime.getTime();
          
          if (timeSinceHeartbeat > STALE_TIMEOUT_MS) {
            // Mark as stale - will update in database
            staleDevices.push(doc.id);
            uptime.status = 'inactive';
            uptime.sessionEnd = now;
            console.log(`[KIOSK-UPTIME] Device ${doc.id} marked inactive (no heartbeat for ${Math.round(timeSinceHeartbeat / 1000)}s)`);
          }
        }
        
        uptimes.push(uptime);
      }
      
      // Update stale devices in database (batch update)
      if (staleDevices.length > 0) {
        const batch = db.batch();
        for (const deviceId of staleDevices) {
          const docRef = db.collection('kioskUptimes').doc(deviceId);
          batch.update(docRef, {
            status: 'inactive',
            sessionEnd: now,
          });
        }
        await batch.commit();
        console.log(`[KIOSK-UPTIME] Batch updated ${staleDevices.length} stale devices to inactive`);
      }
      
      return uptimes;
    } catch (error) {
      console.error('Firestore error:', error);
      return [];
    }
  }

  async deleteAllKioskUptimes(): Promise<void> {
    try {
      const snapshot = await db.collection('kioskUptimes').get();
      const docs = snapshot.docs;
      const totalCount = docs.length;
      
      // Firestore batch operations have a limit of 500 operations per batch
      const BATCH_SIZE = 500;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = docs.slice(i, i + BATCH_SIZE);
        chunk.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }
      
      console.log(`[KIOSK-UPTIME] Deleted ${totalCount} kiosk uptime records`);
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Failed to delete kiosk uptime records');
    }
  }

  async deleteKioskUptime(id: string): Promise<boolean> {
    try {
      const doc = await db.collection('kioskUptimes').doc(id).get();
      if (!doc.exists) {
        return false;
      }
      await db.collection('kioskUptimes').doc(id).delete();
      console.log(`[KIOSK-UPTIME] Deleted kiosk uptime record: ${id}`);
      return true;
    } catch (error) {
      console.error('Firestore error deleting kiosk uptime:', error);
      throw new Error('Failed to delete kiosk uptime record');
    }
  }
}

export const storage = new DatabaseStorage();
