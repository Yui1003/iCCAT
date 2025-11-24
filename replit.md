# CVSU CCAT Campus Navigation App

## Project Overview
Comprehensive campus wayfinding/navigation web application with kiosk and mobile QR-code versions. Features interactive campus maps, multi-phase route navigation with color-coded paths, ETA calculations, admin management tools, feedback collection, analytics tracking, and offline support. Deployed on Render with Firebase backend; Replit used for testing before production deployment.

## Recent Changes (Nov 24, 2025)

### Analytics System Implementation ✅
- **Admin Analytics Dashboard**: New dedicated page at `/admin/analytics` for monitoring kiosk performance
- **Performance Metrics Tracked**:
  - Interface action response times (button clicks, searches)
  - Map loading speeds
  - Image loading times
  - Menu rendering performance
  - Route generation speed
  - Navigation start times
  - Page view metrics

- **Features**:
  - Real-time data collection when kiosk is online
  - Offline disclaimer warning (data NOT collected while offline)
  - Reset button to clear all analytics data
  - Performance statistics: Total events, average/min/max response times
  - Last updated timestamp for each metric
  - Online/offline status indicator

- **Architecture**:
  - **Client-side**: `analytics-tracker.ts` - tracks metrics and queues events when offline
  - **Backend**: Storage interface for analytics CRUD operations
  - **API Routes**: 
    - `POST /api/analytics` - Log performance events
    - `GET /api/admin/analytics` - Retrieve analytics summary
    - `POST /api/admin/analytics/reset` - Clear all data
  - **Database**: In-memory storage (in-memory Map) with aggregated statistics

### Previous: ETA System ✅
- Response time displays for point-to-point routing
- Clock icon with ETA in Route Details card
- Walking: 1.4 m/s, Driving: 10 m/s
- Minutes rounded up for display
- ETA shows in: Get Directions Dialog, Route Details, phases, multi-phase routes

## User Preferences
- N/A (awaiting first preferences)

## Project Architecture

### Directory Structure
```
client/
  src/
    lib/
      analytics-tracker.ts    # Client-side performance tracking utility
      eta-calculator.ts       # ETA calculation logic
      queryClient.ts          # React Query setup
    pages/
      admin-analytics.tsx     # Analytics dashboard page
      navigation.tsx          # Main kiosk navigation UI
      [other admin pages]
    components/
      admin-layout.tsx        # Admin sidebar with analytics link
      get-directions-dialog.tsx
      [UI components]

shared/
  analytics-schema.ts         # Analytics Zod schemas & types
  schema.ts                   # Main data models

server/
  storage.ts                  # Analytics storage interface & implementation
  routes.ts                   # Analytics API endpoints
  db.ts                       # Firebase connection
  pathfinding.ts
```

### Key Files for Analytics
1. **shared/analytics-schema.ts** - Defines:
   - `AnalyticsEventType` enum (INTERFACE_ACTION, MAP_LOAD, IMAGE_LOAD, etc.)
   - `analyticsEventSchema` - Event structure with responseTime in ms
   - `analyticsSummary` - Aggregated statistics per event type

2. **client/src/lib/analytics-tracker.ts** - Exports:
   - `trackEvent(eventType, responseTimeMs, metadata)` - Log a single event
   - `measurePerformance<T>(eventType, fn, metadata)` - Measure function execution time
   - `flushEvents()` - Send queued events when coming online
   - `isAnalyticsAvailable()` - Check if online

3. **client/src/pages/admin-analytics.tsx** - UI with:
   - Online/offline status indicator
   - Offline disclaimer (orange alert)
   - Reset data button with confirmation
   - Analytics cards showing: total count, avg/min/max response times
   - Info box explaining tracked metrics

4. **server/storage.ts** - Methods:
   - `addAnalyticsEvent(event)` - Store event in memory
   - `getAnalyticsSummary()` - Aggregate stats by event type
   - `resetAnalytics()` - Clear all data

5. **server/routes.ts** - Endpoints:
   - `POST /api/analytics` - Receive tracking data from client
   - `GET /api/admin/analytics` - Fetch summary for dashboard
   - `POST /api/admin/analytics/reset` - Clear analytics

## How Analytics Work

### Data Collection Flow
```
User interacts with kiosk
    ↓
Client measures performance (e.g., 245ms for map load)
    ↓
Is kiosk online?
    ├─ YES → Send to backend immediately
    └─ NO  → Queue locally, show offline disclaimer
    ↓
Backend aggregates events by type
    ↓
Admin views in Analytics Dashboard
    ↓
Can reset/clear all data
```

### Admin Monitoring Process
1. **Access Analytics**: Admin → Sidebar → Analytics
2. **View Metrics**: Dashboard shows performance cards for each event type
3. **Monitor Performance**: Track average response times, identify bottlenecks
4. **Check Status**: Green "Analytics Active" = data being collected
5. **Reset Data**: Click "Reset All Data" button to clear counts for new test session

### Offline Behavior
- **While Offline**: Orange alert banner shows "Analytics data collection is disabled"
- **Locally Queued**: Events stored in memory queue
- **Auto-sync**: When connection restored, all queued events sent automatically
- **Data Accuracy**: Only data collected online is analyzed (ensures research accuracy)

## Current Implementation Status

### ✅ Completed
- Analytics schema and types
- Client-side performance tracking utility
- Backend storage interface and implementation
- Analytics API endpoints (3 routes)
- Admin Analytics dashboard page
- Online/offline status detection
- Offline disclaimer alert
- Reset button with confirmation
- Analytics sidebar link in admin layout
- Route registration in App.tsx
- Full integration with existing kiosk

### 🔄 Ready for Use
- Researchers can now:
  - Monitor real-time kiosk performance
  - Track interface action speeds
  - Measure map/image loading times
  - See route generation performance
  - Collect data over test sessions
  - Reset data between tests
  - Ensure data accuracy (no offline data)

## ETA System Details
- **Speeds**: Walking 1.4 m/s, Driving 10 m/s
- **Display**: Shows "1 min", "45 sec", "< 1 min" format
- **Locations**: Get Directions Dialog, Route Details card, individual phases
- **Clock Icon**: Lucide React Clock icon (w-4 h-4, text-primary)

## Build & Deployment
- Build: `npm run build` (20-23s, ~1MB bundle)
- Dev Server: `npm run dev` (Vite + Express)
- Deployed on: Render (Firebase backend)
- Testing: Replit before production push

## Tech Stack
- Frontend: React 18, TypeScript, Tailwind CSS, Vite, wouter, TanStack Query
- Backend: Express, Node.js
- Database: Firebase (Firestore)
- UI: Shadcn components, Lucide icons
- Validation: Zod
- ORM: Drizzle (schemas only, Firebase used for persistence)
