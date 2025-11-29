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

## Recent Changes (November 29, 2025)
- **Fixed accessible route detection logic**: Corrected pre-check logic that was incorrectly showing "No Accessible Path Available" dialog when a complete accessible path actually existed. Now:
  - If complete PWD-friendly path exists → proceeds with normal routing (no dialog)
  - If partial path exists → shows dialog with furthest reachable endpoint
  - If completely unreachable → shows dialog with navigation to nearest accessible building
- **Fixed cache loader performance**: Changed cache verification loader to close immediately when caching completes instead of waiting for full 30-second timer. Now detects cached resources every 200ms and closes as soon as all caches are populated (max ~5 seconds). Fixes issue where loader paused when browser tabs were inactive.
- **Added version display**: Added "version:1.8.1" text to homepage footer bottom right for user visibility
- **Improved accessible endpoint navigation**: Enhanced `handleNavigateToAccessibleEndpoint` with comprehensive logging and error messages. Now shows error toast if required data (start location, destination, or endpoint) is missing. Includes detailed console logging at each step.

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
