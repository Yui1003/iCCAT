# CVSU CCAT Campus Navigation App

## Overview
The CVSU CCAT Campus Navigation App is a comprehensive web application designed for campus wayfinding and navigation. It features interactive maps, multi-phase route navigation with color-coded paths and ETA calculations, and tools for administrators to manage content, collect feedback, and track analytics. The application supports both kiosk and mobile QR-code versions, aims to provide an intuitive user experience, and includes offline capabilities. It is deployed on Render with a Firebase backend.

## Testing Environment Setup (Replit)
**IMPORTANT**: This Replit workspace is used for TESTING changes before pushing to the production app on Render.

### How It Works:
1. **Production Environment**: Deployed on Render, uses Firebase Firestore database
2. **Testing Environment (This Replit)**: Uses `data.json` as a local data source

### Current Configuration:
- `FORCE_FALLBACK_MODE = true` in `server/storage.ts` - Forces the app to use `data.json` instead of Firebase
- Data was exported from Firebase on Nov 26, 2025 using `scripts/export-firebase-data.ts`
- To refresh data from Firebase: run `npx tsx scripts/export-firebase-data.ts`
- **Data Persistence**: Changes made in fallback mode ARE persisted to `data.json` via `saveFallbackData()` function

### Before Pushing Changes to Production:
1. Set `FORCE_FALLBACK_MODE = false` in `server/storage.ts` to re-enable Firebase
2. Test with Firebase connection to ensure production compatibility
3. Push changes to your Git repository for Render deployment

## User Preferences
- Touchscreen optimized (48px+ touch targets)
- Firebase/Render deployment ready
- No session ID complexity (simplified design)
- Export/reset buttons intact and functional
- Charts for data visualization but NOT in exports

## System Architecture

### UI/UX Decisions
The application features interactive campus maps for path drawing, navigation, and building boundary definition, with enhanced zoom capabilities (up to 22 for path drawing, 21 for navigation and polygon drawing) and stable tile loading across all zoom levels. Existing paths are visualized on admin maps with distinct colors for walkpaths (green dashed) and drivepaths (blue dashed) to aid verification. Admin interfaces include search and filtering functionalities for Events, Buildings, and Paths management to improve usability.

### Technical Implementations
The system tracks three key metrics: interface action response times, loading speeds for maps/images/menus, and route-generation speed. Analytics data is collected in real-time, persisted to Firestore, and displayed on an admin dashboard using interactive Recharts visualizations (Bar, Pie, Line charts). Offline data collection queues events locally and syncs them upon reconnection. CSV exports are formatted for clarity with proper date/time and timezone handling (Philippine Time). ETA calculations for routing are based on predefined speeds for walking and driving.

### Pathfinding Architecture (Nov 25, 2025)
**Design Decision: Manual Path Control with Zero Automatic Merging**

The pathfinding system now operates on a **purely manual connection model**:

1. **User-Controlled Path Network**: 
   - Admins manually connect path waypoints by clicking on existing nodes when creating/editing paths
   - Building markers (orange) are clickable to snap paths directly to building locations
   - NO automatic node merging - paths connect ONLY where admins explicitly connect them

2. **Why No Auto-Merging?**
   - Previous 10-meter automatic node merging created false shortcuts by merging nodes from different paths
   - Users are already manually connecting nodes, making auto-merging redundant
   - Manual connections give precise control over the navigation network
   - Result: Routes follow the EXACT path network admins created, not arbitrary proximity-based connections

3. **How Pathfinding Works**:
   - Dijkstra's algorithm finds the shortest path through connected nodes (Dijkstra nodes only)
   - Route expansion: For each consecutive pair of Dijkstra nodes, ALL intermediate waypoints are included
   - Example: If Dijkstra finds [NodeA → NodeC → NodeE], the route includes [NodeA, NodeB, NodeC, NodeD, NodeE]
   - Result: Routes trace the complete manually-created paths with zero node skipping

4. **Connection Points**:
   - **Path-to-Path**: Connected by overlapping/clicking on adjacent waypoints
   - **Building-to-Path**: Connected by clicking building markers (which snap to nearest path)
   - **Path Segments**: All intermediate waypoints between connected nodes are preserved in final route

### Feature Specifications
- **Campus Maps**: Interactive, multi-zoom level (up to 22), stable tile loading, visualization of existing paths.
- **Admin Tools**: Search and filter for events, buildings, and paths; robust analytics dashboard with visual charts; CSV/JSON export of analytics data; data reset functionality.
- **Path Drawing**: 
  - Building markers (orange) visible and clickable to add path waypoints
  - Existing waypoints (gray dots) from other paths clickable to connect
  - Visual feedback showing number of buildings, waypoints, and nearby path segments
- **Navigation**: Multi-phase route generation using manually-created path network, color-coded paths, ETA display.
- **Analytics**: Tracks interface actions, loading speeds, route generation; offline data queuing and syncing; Firebase persistence.
- **Data Export**: Formatted CSV with Philippine Timezone and separate date/time columns; JSON export.

### System Design Choices
- **Client-side Performance**: Utilizes React Query for data fetching and caching, and measures actual performance durations for analytics rather than hardcoded values.
- **Backend Persistence**: Firebase Firestore is used for reliable data storage, ensuring data integrity across server restarts.
- **Offline Resilience**: Implements mechanisms to queue and sync data collected while offline, preventing data loss.
- **Modularity**: Codebase is structured with clear separation of concerns (client, server, shared), and dedicated libraries for analytics tracking and ETA calculation.
- **Pathfinding Purity**: Zero automatic node merging; routes reflect user's manual path creation exactly.

## Recent Changes
- **Complete Two-Phase Indoor Navigation (Nov 26, 2025 - VERIFIED WORKING)**:
  - **Phase 1 (Outdoor)**: Campus map routing from user location to building entrance
  - **Phase 2 (Indoor)**: Floor plan with turn-by-turn indoor navigation
  - **Schema**: IndoorNode (entrance, stairway, elevator, room, hallway), RoomPath, Room, Floor
  - **Dijkstra Graph Building**:
    - Creates nodes for all rooms, indoor nodes, and path waypoints
    - Waypoints at same coordinates automatically merge (prevents false shortcuts)
    - Rooms/nodes bridge to nearest waypoint on each path network
    - Stairways/elevators connect across floors via connectedFloorIds
  - **Pathfinding Algorithm** (Verified Nov 26):
    - Dijkstra finds shortest path through node network
    - Full waypoint extraction from edges (shows complete drawn path, not shortcuts)
    - 18 iterations for 20 nodes across 4 paths = excellent performance
    - Successfully routes through 13+ waypoints with proper directions
  - **Multi-Floor Support**:
    - Each floor processed independently (no cross-floor interference)
    - Stairway nodes automatically connect floors via connectedFloorIds array
    - Scales safely for 5-20 floors with 3-10 rooms per floor
  - **Testing**: Kitchen navigation on Ground Floor verified with complete waypoint visualization

- **Pathfinding - Automatic Node Merging Disabled (Nov 25, 2025)**:
  - Issue: Routes were skipping path waypoints due to 10-meter automatic node merging creating false shortcuts
  - Root Cause: Auto-merging was connecting nodes from different paths that users never explicitly connected
  - Solution: Removed `mergeNearbyNodes()` function entirely
  - Result: Routes now follow EXACTLY the paths users manually created and connected
  - Verification: Pathfinding trace now matches user-drawn walkpath exactly with no diagonal shortcuts

- **All Campus Maps - Tile Loading & Performance (OPTIMIZED)**: 
  - **Campus Navigation Map**: 
    - Issue: Tiles weren't loading on initial render; users had to zoom out then zoom in to see tiles
    - Root Cause: `setMaxBounds()` bounds constraint was applied immediately, blocking tile loading
    - Solutions Applied:
      1. Delayed bounds constraint to 350ms to allow tiles to fully render first
      2. ResizeObserver for container resize handling
      3. requestAnimationFrame for immediate next paint (critical)
      4. Streamlined invalidateSize() calls: 75ms and 250ms delays (reduced from 4 to 2 calls)
      5. **Increased max zoom from 20.5 to 21** for better detail viewing
    - Performance: Map load time now **101ms** (extremely fast)
  - **Building Boundary Map (Polygon Drawing)**:
    - Applied identical tile loading optimizations as campus navigation map
    - Removed `subdomains` parameter that was interfering with tile loading
    - Added ResizeObserver, requestAnimationFrame, and optimized invalidateSize calls
    - **Increased max zoom from 20.5 to 21** for precise polygon drawing
  - **Result**: All maps now load tiles smoothly on initial render without delays; max zoom 21 provides enhanced detail for all map types

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
