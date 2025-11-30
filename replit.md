# CVSU CCAT Campus Navigation App

## Overview
The CVSU CCAT Campus Navigation App is a web application for campus wayfinding, offering interactive maps, multi-phase, color-coded route navigation with ETA, and administrative tools for content, feedback, and analytics. It supports kiosk and mobile QR-code access, provides an intuitive user experience, includes offline capabilities, and is deployed on Render with a Firebase backend. The project aims to provide comprehensive campus navigation.

## User Preferences
- Touchscreen optimized (48px+ touch targets)
- Firebase/Render deployment ready
- No session ID complexity (simplified design)
- Export/reset buttons intact and functional
- Charts for data visualization but NOT in exports
- REAL-TIME UPDATES REQUIRED - 5-second refetch interval for live admin changes

## System Architecture

### UI/UX Decisions
The application features interactive campus maps for path drawing, navigation, and building boundary definition, with enhanced zoom capabilities (up to 22 for path drawing, 21 for navigation and polygon drawing) and stable tile loading. Admin maps visualize existing paths with distinct colors (green dashed for walkpaths, blue dashed for drivepaths). Admin interfaces include search and filtering for Events, Buildings, and Paths.

### Technical Implementations
The system tracks interface action response times, loading speeds for maps/images/menus, and route-generation speed. Analytics data is collected in real-time, persisted to Firestore, and displayed on an admin dashboard using interactive Recharts (Bar, Pie, Line charts). Offline data collection queues events locally and syncs upon reconnection. CSV exports are formatted with proper date/time and timezone handling (Philippine Time). ETA calculations use predefined speeds for walking and driving.

### Pathfinding Architecture
The pathfinding system uses a purely manual connection model. Admins manually connect path waypoints by clicking existing nodes. There is no automatic node merging, ensuring precise control over the navigation network. Dijkstra's algorithm finds the shortest path through connected nodes, and the route expands to include all intermediate waypoints, tracing the complete manually-created paths. Connections occur path-to-path via overlapping waypoints, and building-to-path by clicking building markers.

### Accessible Navigation Fallback
When a user selects accessible mode and there is no PWD-friendly path to the requested destination, the system automatically finds the nearest building that IS reachable via accessible paths. The app displays a dialog informing the user that no accessible path exists to the original destination, and offers navigation to the nearest accessible alternative. This ensures accessibility mode users always have a viable route option.

### Feature Specifications
- **Campus Maps**: Interactive, multi-zoom level (up to 22), stable tile loading, visualization of existing paths.
- **Admin Tools**: Search and filter for events, buildings, and paths; robust analytics dashboard with visual charts; CSV/JSON export of analytics data; data reset functionality; ability to delete specific kiosk device records.
- **Path Drawing**: Building markers and existing waypoints are clickable for path creation and connection, with visual feedback on nearby elements.
- **Navigation**: Multi-phase route generation using manually-created path network, color-coded paths, ETA display.
- **Accessible Navigation**: PWD-friendly and strictly PWD-only paths for wheelchair navigation with automatic fallback to nearest accessible building when direct route unavailable.
- **Analytics**: Tracks interface actions, loading speeds, route generation; offline data queuing and syncing; Firebase persistence.
- **Data Export**: Formatted CSV with Philippine Timezone and separate date/time columns; JSON export.
- **Multi-Floor Navigation**: Generic floor-agnostic algorithm for unlimited floors, dynamic floor sequencing, automatic stairway connection logic, and independent path calculation per floor. Floor transitions properly remount UI components to prevent lingering visual artifacts.
- **Two-Phase Indoor Navigation**: Phase 1 (Outdoor) for campus map routing to building entrance, Phase 2 (Indoor) for turn-by-turn navigation on floor plans. Uses Dijkstra graph building for rooms, indoor nodes, and path waypoints, with cross-floor connections via stairways/elevators.

### System Design Choices
- **Client-side Performance**: React Query for data fetching/caching; measures actual performance durations for analytics.
- **Backend Persistence**: Firebase Firestore for reliable data storage.
- **Offline Resilience**: Mechanisms to queue and sync data collected while offline.
- **Modularity**: Codebase structured with clear separation of concerns (client, server, shared).
- **Pathfinding Purity**: Zero automatic node merging; routes reflect user's manual path creation exactly.
- **Accessibility First**: Fallback routing ensures no accessible-mode user is left without navigation options.

### Caching and Image Handling
- **Service Worker Optimization**: Essential map tiles (zoom 17-18) cached upfront, extra zoom levels (16, 19) cached in background for faster initial load.
- **Image Proxy System**: All external images (Firebase Storage, third-party URLs) routed through `/api/proxy-image` endpoint to bypass CORS restrictions.
- **ProxiedImage Component**: Reusable component (`client/src/components/proxied-image.tsx`) automatically handles image proxying for consistent offline caching.
- **Precaching Strategy**: Images detected from API responses are pre-fetched through the proxy and cached for offline availability.
- **Cache Verification**: Loader (`cache-verification-loader.tsx`) waits for critical resources before showing app, ensuring offline readiness.

## Recent Changes (November 30, 2025)
- **FIXED: Mobile indoor navigation distance display**:
  - Removed distance display (e.g., "8 m") from indoor navigation turn-by-turn steps on mobile
  - Reason: Floorplans are just images without real coordinates, so distances are not accurate
  - Now matches kiosk behavior which doesn't show distance for indoor navigation

- **FIXED: Mobile devices registering as kiosks**:
  - Added mobile device detection (`isMobileDevice()`) in `use-kiosk-uptime.ts`
  - Detects phones/tablets via user agent, touch capability, and screen size
  - Mobile devices are now completely excluded from kiosk uptime monitoring
  - Prevents QR code scans from cluttering the kiosk uptime dashboard

- **FIXED: Kiosk uptime not updating when tab closed**:
  - Replaced async fetch with `navigator.sendBeacon()` for reliable session end on tab close
  - Added `pagehide` event listener as additional coverage
  - Session end is now sent reliably even when browser closes quickly

- **ADDED: Server-side stale device detection**:
  - `getAllKioskUptimes()` now checks for stale heartbeats (>60 seconds without heartbeat)
  - Automatically marks stale devices as inactive with batch database updates
  - Serves as backup when client-side sendBeacon fails
  - Logs which devices were marked inactive and why

## Recent Changes (November 29, 2025)
- **ADDED: Interactive Walkthrough/Guide Feature**:
  - Created comprehensive walkthrough component (`client/src/components/walkthrough.tsx`) with 5 interactive steps
  - Steps cover: Welcome/Home, Campus Navigation, Events & Announcements, Staff Directory, and Completion
  - Visual previews use actual shadcn Card and Button components for UI consistency
  - Each step includes feature highlights with icons and helpful tips
  - Added "How to Use" button in landing page header for easy access
  - Auto-shows for first-time visitors (localStorage-based detection)
  - Proper accessibility support with DialogTitle and DialogDescription for screen readers

- **FIXED: Floor plan lingering path artifacts**:
  - Issue: When navigating between floors, path from previous floor lingered at bottom-right corner as unknown dotted line
  - Root Cause: Canvas drawing code plotted waypoints outside visible canvas bounds; canvas wasn't filtering coordinates
  - Solution: Added bounds checking in `floor-plan-viewer.tsx` - only draws path waypoints within canvas bounds + safe margin (±100px)
  - Result: Paths now properly clear when floor changes, no more lingering artifacts at screen edges
  
- **ADDED: Mobile Navigation Usage Tracking & Analytics**:
  - Tracks when users ACTUALLY open mobile navigation after scanning QR code (not just button clicks)
  - When mobile-navigation page loads (`/navigate/:routeId`), logs `mobile_navigation_opened` event
  - Admin analytics dashboard counts mobile usage under "Interface Actions (incl. Mobile Navigation Usage)"
  - CSV export includes `Mobile_Navigation_Usage` column marking each mobile nav session
  - Summary line in CSV shows total count of actual mobile navigation uses
  - Tracks which users accessed accessible endpoint fallback routes on mobile

- **IMPROVED: Accurate mobile metrics**:
  - Previous approach tracked button clicks (inaccurate - includes users who clicked but didn't scan)
  - New approach tracks actual `/navigate/*` page loads (accurate - only counts real mobile usage)
  - Mobile usage data now reliable for understanding how many users actually used QR to navigate

- **Previous: CRITICAL FIX - Accessible mode detection**:
  - `findShortestPath()` validates closest end node is truly connected (within 1m) to building
  - Prevents fake routes showing for unreachable buildings like DMS TCR 1-3 (17m away)
  - Correctly triggers fallback dialog when no actual PWD path exists to destination

## External Dependencies
- **Frontend Framework**: React 18
- **Styling**: Tailwind CSS
- **Routing**: wouter
- **State Management/Data Fetching**: TanStack Query
- **Charting Library**: Recharts (BarChart, PieChart, LineChart)
- **UI Components**: Shadcn UI, Lucide icons
- **Backend Framework**: Express, Node.js
- **Database**: Firebase (Firestore)
- **Validation**: Zod
- **Mapping**: Leaflet with OpenStreetMap tiles
