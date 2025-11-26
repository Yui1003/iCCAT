import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// POI Types enum
export const poiTypes = [
  "Building",
  "Gate",
  "Canteen",
  "Food Stall",
  "Library",
  "Student Lounge",
  "Car Parking",
  "Motorcycle Parking",
  "Comfort Room",
  "Lecture Hall / Classroom",
  "Administrative Office",
  "Residence Hall / Dormitory",
  "Health Services / Clinic",
  "Gym / Sports Facility",
  "Auditorium / Theater",
  "Laboratory",
  "Faculty Lounge / Staff Room",
  "Study Area",
  "Bookstore",
  "ATM",
  "Chapel / Prayer Room",
  "Green Space / Courtyard",
  "Bus Stop / Shuttle Stop",
  "Bike Parking",
  "Security Office / Campus Police",
  "Waste / Recycling Station",
  "Water Fountain",
  "Print/Copy Center",
  "Other"
] as const;

export type POIType = typeof poiTypes[number];

// POI type subsets for feature gating
export const buildingDepartmentTypes = new Set<POIType>(["Building"]);

export const floorPlanEligibleTypes = new Set<POIType>([
  "Building",
  "Library",
  "Canteen",
  "Lecture Hall / Classroom",
  "Administrative Office",
  "Health Services / Clinic",
  "Gym / Sports Facility",
  "Laboratory"
]);

export const staffAllowedPOITypes = new Set<POIType>([
  "Building",
  "Security Office / Campus Police",
  "Gym / Sports Facility",
  "Library",
  "Administrative Office",
  "Health Services / Clinic"
]);

export const descriptionOnlyTypes = new Set<POIType>([
  "Gate",
  "Food Stall",
  "Student Lounge",
  "Car Parking",
  "Motorcycle Parking",
  "Bike Parking",
  "Comfort Room",
  "Auditorium / Theater",
  "Faculty Lounge / Staff Room",
  "Study Area",
  "Bookstore",
  "ATM",
  "Green Space / Courtyard",
  "Bus Stop / Shuttle Stop",
  "Waste / Recycling Station",
  "Water Fountain",
  "Print/Copy Center",
  "Other"
]);

// Helper predicates for POI type checking
export const canHaveDepartments = (type: POIType): boolean => buildingDepartmentTypes.has(type);
export const canHaveFloorPlan = (type: POIType): boolean => floorPlanEligibleTypes.has(type);
export const canHaveStaff = (type: POIType): boolean => staffAllowedPOITypes.has(type);
export const isDescriptionOnly = (type: POIType): boolean => descriptionOnlyTypes.has(type);

// Kiosk location constant - "You are Here" marker
export const KIOSK_LOCATION = {
  id: 'kiosk',
  name: 'Your Location (Kiosk)',
  lat: 14.403115555479292,
  lng: 120.86635977029803,
  type: 'Kiosk',
  description: null,
  departments: null,
  image: null,
  markerIcon: null
} as const;

// Buildings table
export const buildings = pgTable("buildings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull().default("Building"),
  description: text("description"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  departments: text("departments").array(),
  image: text("image"),
  markerIcon: text("marker_icon").default("building"),
  polygon: jsonb("polygon"), // Array of {lat, lng} objects for building boundary/area
  polygonColor: text("polygon_color").default("#FACC15"), // Hex color for polygon highlight
});

export const insertBuildingSchema = createInsertSchema(buildings).omit({ id: true });
export type InsertBuilding = z.infer<typeof insertBuildingSchema>;
export type Building = typeof buildings.$inferSelect;

// Floors table
export const floors = pgTable("floors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  buildingId: varchar("building_id").notNull(),
  floorNumber: integer("floor_number").notNull(),
  floorName: text("floor_name"),
  floorPlanImage: text("floor_plan_image"),
  pixelToMeterScale: real("pixel_to_meter_scale").default(0.05), // Conversion factor: meters per pixel (default: 1 pixel = 0.05 meters)
  floorPlanWidth: integer("floor_plan_width"), // Width of floor plan image in pixels
  floorPlanHeight: integer("floor_plan_height"), // Height of floor plan image in pixels
});

export const insertFloorSchema = createInsertSchema(floors).omit({ id: true });
export type InsertFloor = z.infer<typeof insertFloorSchema>;
export type Floor = typeof floors.$inferSelect;

// Rooms table
export const rooms = pgTable("rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  floorId: varchar("floor_id").notNull(),
  buildingId: varchar("building_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // classroom, office, lab, etc.
  description: text("description"),
  x: real("x").notNull(), // X position on floor plan
  y: real("y").notNull(), // Y position on floor plan
});

export const insertRoomSchema = createInsertSchema(rooms).omit({ id: true });
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;

// Staff table
export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  position: text("position"),
  department: text("department"),
  buildingId: varchar("building_id"),
  floorId: varchar("floor_id"),
  roomId: varchar("room_id"),
  email: text("email"),
  phone: text("phone"),
  photo: text("photo"),
});

export const insertStaffSchema = createInsertSchema(staff).omit({ id: true });
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staff.$inferSelect;

// Event classification enum - PostgreSQL enum type
export const eventClassificationEnum = pgEnum("event_classification", ["Event", "Announcement", "Achievement"]);

// Event classification types for TypeScript
export const eventClassifications = [
  "Event",
  "Announcement",
  "Achievement"
] as const;

export type EventClassification = typeof eventClassifications[number];

// Events table
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  date: text("date").notNull(),
  time: text("time"),
  endDate: text("end_date"),
  endTime: text("end_time"),
  location: text("location"),
  buildingId: varchar("building_id"),
  image: text("image"),
  classification: eventClassificationEnum("classification").notNull().default("Event"),
});

export const insertEventSchema = createInsertSchema(events).omit({ id: true }).extend({
  classification: z.enum(eventClassifications).default("Event"),
});
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

// Walkpaths table - multi-node polylines for walking routes
export const walkpaths = pgTable("walkpaths", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"),
  nodes: jsonb("nodes").notNull(), // Array of {lat, lng} objects
});

export const insertWalkpathSchema = createInsertSchema(walkpaths).omit({ id: true });
export type InsertWalkpath = z.infer<typeof insertWalkpathSchema>;
export type Walkpath = typeof walkpaths.$inferSelect;

// Drivepaths table - multi-node polylines for driving routes
export const drivepaths = pgTable("drivepaths", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"),
  nodes: jsonb("nodes").notNull(), // Array of {lat, lng} objects
});

export const insertDrivepathSchema = createInsertSchema(drivepaths).omit({ id: true });
export type InsertDrivepath = z.infer<typeof insertDrivepathSchema>;
export type Drivepath = typeof drivepaths.$inferSelect;

// Admin users table
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({ id: true });
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;

// Settings table - for app configuration (inactivity timeout, etc.)
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
});

export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;

// Saved routes table - for QR code navigation
export const savedRoutes = pgTable("saved_routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  startId: varchar("start_id").notNull(),
  endId: varchar("end_id").notNull(),
  waypoints: jsonb("waypoints").$type<string[]>().notNull(), // Array of building IDs for stops
  mode: text("mode").notNull(), // 'walking' or 'driving'
  vehicleType: text("vehicle_type"), // optional: 'car', 'motorcycle', 'bike'
  phases: jsonb("phases").$type<RoutePhase[]>().notNull(), // Array of RoutePhase objects
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"), // optional expiration
  // Indoor navigation fields - for room finder QR codes
  destinationRoomId: varchar("destination_room_id"), // IndoorNode ID of the destination room
  destinationBuildingId: varchar("destination_building_id"), // Building ID containing the room
  destinationFloorId: varchar("destination_floor_id"), // Floor ID where the room is located
  destinationRoomName: text("destination_room_name"), // Human-readable room name
});

export const insertSavedRouteSchema = createInsertSchema(savedRoutes).omit({ id: true, createdAt: true });
export type InsertSavedRoute = z.infer<typeof insertSavedRouteSchema>;
export type SavedRoute = typeof savedRoutes.$inferSelect;

// TypeScript interfaces for complex data structures
export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteStep {
  instruction: string;
  distance: string;
  icon: string;
}

export type VehicleType = 'car' | 'motorcycle' | 'bike';

export interface RoutePhase {
  mode: 'walking' | 'driving';
  polyline: LatLng[];
  steps: RouteStep[];
  distance: string;
  startName: string;
  endName: string;
  color: string; // Unique color for each phase
  phaseIndex: number; // Phase number (0-indexed)
  startId: string; // Building ID
  endId: string; // Building ID
}

export interface NavigationRoute {
  start: Building;
  end: Building;
  mode: 'walking' | 'driving';
  polyline: LatLng[];
  steps: RouteStep[];
  totalDistance: string;
  vehicleType?: VehicleType;
  parkingLocation?: Building;
  phases?: RoutePhase[]; // Multi-phase routes with waypoints
  waypoints?: Building[]; // Array of waypoint buildings
}

// Feedback table - for user feedback based on ISO 25010
export const feedbacks = pgTable("feedbacks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: integer("user_id").notNull(), // Auto-generated sequential user number
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  
  // Individual ratings (1-5) for all 35 questions
  functionalCompleteness: integer("functional_completeness").notNull(),
  functionalCorrectness: integer("functional_correctness").notNull(),
  functionalAppropriateness: integer("functional_appropriateness").notNull(),
  timeBehaviour: integer("time_behaviour").notNull(),
  resourceUtilization: integer("resource_utilization").notNull(),
  capacity: integer("capacity").notNull(),
  coExistence: integer("co_existence").notNull(),
  interoperability: integer("interoperability").notNull(),
  appropriatenessRecognizability: integer("appropriateness_recognizability").notNull(),
  learnability: integer("learnability").notNull(),
  operability: integer("operability").notNull(),
  userErrorProtection: integer("user_error_protection").notNull(),
  uiAesthetics: integer("ui_aesthetics").notNull(),
  accessibility: integer("accessibility").notNull(),
  maturity: integer("maturity").notNull(),
  availability: integer("availability").notNull(),
  faultTolerance: integer("fault_tolerance").notNull(),
  recoverability: integer("recoverability").notNull(),
  confidentiality: integer("confidentiality").notNull(),
  integrity: integer("integrity").notNull(),
  nonRepudiation: integer("non_repudiation").notNull(),
  accountability: integer("accountability").notNull(),
  authenticity: integer("authenticity").notNull(),
  modularity: integer("modularity").notNull(),
  reusability: integer("reusability").notNull(),
  analysability: integer("analysability").notNull(),
  modifiability: integer("modifiability").notNull(),
  testability: integer("testability").notNull(),
  adaptability: integer("adaptability").notNull(),
  installability: integer("installability").notNull(),
  replaceability: integer("replaceability").notNull(),
  clarityOfInstructions: integer("clarity_of_instructions").notNull(),
  comfortAndErgonomics: integer("comfort_and_ergonomics").notNull(),
  navigationIntuitiveness: integer("navigation_intuitiveness").notNull(),
  userSatisfaction: integer("user_satisfaction").notNull(),
  
  // Calculated averages per category
  avgFunctionalSuitability: real("avg_functional_suitability").notNull(),
  avgPerformanceEfficiency: real("avg_performance_efficiency").notNull(),
  avgCompatibility: real("avg_compatibility").notNull(),
  avgUsability: real("avg_usability").notNull(),
  avgReliability: real("avg_reliability").notNull(),
  avgSecurity: real("avg_security").notNull(),
  avgMaintainability: real("avg_maintainability").notNull(),
  avgPortability: real("avg_portability").notNull(),
  avgUxItems: real("avg_ux_items").notNull(),
  
  // Optional comments
  comments: text("comments"),
});

export const insertFeedbackSchema = createInsertSchema(feedbacks).omit({ 
  id: true, 
  userId: true, // Auto-generated sequentially on submission
  timestamp: true,
  avgFunctionalSuitability: true,
  avgPerformanceEfficiency: true,
  avgCompatibility: true,
  avgUsability: true,
  avgReliability: true,
  avgSecurity: true,
  avgMaintainability: true,
  avgPortability: true,
  avgUxItems: true,
});
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedbacks.$inferSelect;

// Indoor Node types for indoor navigation
export const indoorNodeTypes = [
  "room",
  "entrance", 
  "stairway",
  "elevator",
  "hallway"
] as const;

export type IndoorNodeType = typeof indoorNodeTypes[number];

// Indoor Nodes table - nodes placed on floor plans for indoor navigation
export const indoorNodes = pgTable("indoor_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  floorId: varchar("floor_id").notNull(), // Which floor this node belongs to
  type: text("type").notNull(), // room, entrance, stairway, elevator, hallway
  x: real("x").notNull(), // X position on floor plan (pixels)
  y: real("y").notNull(), // Y position on floor plan (pixels)
  roomId: varchar("room_id"), // Reference to room (required for room nodes, null for hallway/stairway/elevator)
  connectedBuildingNodeId: varchar("connected_building_node_id"), // For entrance nodes - connects to outdoor building node
  connectedFloorIds: text("connected_floor_ids").array().default([]), // For stairway/elevator - list of floor IDs this connects to
  label: text("label"), // Display name for the node
  description: text("description"), // Description for room nodes
});

export const insertIndoorNodeSchema = createInsertSchema(indoorNodes).omit({ id: true }).extend({
  roomId: z.string().nullable().optional(),
  connectedBuildingNodeId: z.string().nullable().optional(),
  connectedFloorIds: z.array(z.string()).default([]),
  description: z.string().nullable().optional(),
});
export type InsertIndoorNode = z.infer<typeof insertIndoorNodeSchema>;
export type IndoorNode = typeof indoorNodes.$inferSelect;

// Room Paths table - paths connecting nodes on floor plans for indoor navigation
export const roomPaths = pgTable("room_paths", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  floorId: varchar("floor_id").notNull(), // Which floor this path belongs to
  name: text("name"), // Path name for admin reference
  waypoints: jsonb("waypoints").notNull(), // Array of {x, y, nodeId?} - pixel coordinates on floor plan
  pathType: text("path_type").notNull().default("hallway"), // hallway, corridor
});

export const insertRoomPathSchema = createInsertSchema(roomPaths).omit({ id: true });
export type InsertRoomPath = z.infer<typeof insertRoomPathSchema>;
export type RoomPath = typeof roomPaths.$inferSelect;

// TypeScript interface for room path waypoints
export interface RoomPathWaypoint {
  x: number;
  y: number;
  nodeId?: string; // Optional reference to an IndoorNode if this waypoint connects to a node
}
