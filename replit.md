# CVSU CCAT Campus Navigation App

## Overview
The CVSU CCAT Campus Navigation App is a web application designed for comprehensive campus wayfinding. It offers interactive maps, multi-phase, color-coded route navigation with estimated time of arrival (ETA), and robust administrative tools for content management, user feedback, and analytics. The application supports access via kiosks and mobile QR codes, provides an intuitive user experience, includes offline capabilities, and is deployed on Render with a Firebase backend. Its primary purpose is to enhance campus navigation efficiency and user experience.

## User Preferences
- Touchscreen optimized (48px+ touch targets)
- Firebase/Render deployment ready
- No session ID complexity (simplified design)
- Export/reset buttons intact and functional
- Charts for data visualization but NOT in exports
- REAL-TIME UPDATES REQUIRED - 5-second refetch interval for live admin changes

## System Architecture

### UI/UX Decisions
The application features interactive campus maps that support path drawing, navigation, and building boundary definition. It includes enhanced zoom capabilities (up to 22 for path drawing, 21 for navigation and polygon drawing) and stable tile loading. Admin maps visually distinguish between walkpaths (green dashed) and drivepaths (blue dashed). Admin interfaces incorporate search and filtering functionalities for Events, Buildings, and Paths. Navigation during routes highlights building polygons for start (green), destination (red), parking (blue), and waypoints (amber).

### Technical Implementations
The system monitors interface action response times, loading speeds for maps/images/menus, and route-generation speed. Real-time analytics data is collected, persisted to Firestore, and displayed on an admin dashboard using interactive Recharts (Bar, Pie, Line charts). Offline data collection queues events locally and synchronizes upon reconnection. CSV exports are formatted with correct date/time and Philippine timezone handling. ETA calculations utilize predefined speeds for walking and driving. Mobile indoor navigation distances are not displayed due to the use of floor plans as images without real coordinates.

### Pathfinding Architecture
The pathfinding system employs a manual connection model where administrators define connections between path waypoints. Dijkstra's algorithm is used to find the shortest path, which then expands to trace the complete manually-created routes. Connections are established path-to-path via overlapping waypoints and building-to-path by clicking building markers.

### Accessible Navigation Fallback
If an accessible path to a requested destination is unavailable, the system automatically identifies the nearest accessible building. The user is informed via a dialog that the original destination is unreachable via accessible routes and is offered navigation to the nearest accessible alternative.

### Feature Specifications
- **Campus Maps**: Interactive, multi-zoom, stable tile loading, visualization of paths.
- **Admin Tools**: Search, filter, robust analytics dashboard, CSV/JSON export, data reset, kiosk device record deletion.
- **Path Drawing**: Clickable building markers and waypoints for path creation and connection.
- **Navigation**: Multi-phase route generation, color-coded paths, ETA display, PWD-friendly and PWD-only paths, automatic fallback for accessible routes.
- **Analytics**: Tracks interface actions, loading speeds, route generation; offline data queuing/syncing; Firebase persistence; mobile navigation usage tracking.
- **Data Export**: Formatted CSV with Philippine Timezone; JSON export.
- **Multi-Floor Navigation**: Generic floor-agnostic algorithm, dynamic floor sequencing, automatic stairway connection logic, independent path calculation per floor.
- **Two-Phase Indoor Navigation**: Outdoor phase to building entrance, indoor phase for turn-by-turn navigation on floor plans.
- **Parking Selection**: User-selectable parking locations for driving routes, dynamically adjusting multi-phase routes. When starting from the kiosk location (non-driveable), users must select where their vehicle is parked. The system generates multi-phase routes: walk from kiosk to parking, drive to destination parking, walk to final destination.
- **Kiosk Uptime Monitoring**: Three-status system (Active, Standby, Inactive) with continuous heartbeats and server-side stale device detection; excludes mobile devices.
- **Interactive Walkthrough**: First-time user guide with 5 steps covering key features.

### System Design Choices
- **Client-side Performance**: React Query for data fetching/caching.
- **Backend Persistence**: Firebase Firestore.
- **Offline Resilience**: Mechanisms for data queuing and syncing.
- **Modularity**: Clear separation of concerns in codebase.
- **Pathfinding Purity**: Zero automatic node merging for precise route control.
- **Accessibility First**: Fallback routing ensures navigation options for accessible-mode users.
- **Service Worker Optimization**: Caching essential map tiles upfront.
- **Image Proxy System**: Routes all external images through a proxy to bypass CORS and enable offline caching.

## Recent Changes (December 2024)
- **Two-Step Parking Selection Flow**: Implemented user-selectable parking for both origin AND destination in driving mode. Users now choose where their vehicle is parked (origin) and where they want to park at the destination (Step 1 → Step 2 flow). System skips destination parking selection if destination is already a parking lot or gate.
- **State Management for Parking Flow**: Added `drivingParkingMode` ('origin' | 'destination' | null) and `selectedDestinationParking` state variables to track the two-step parking selection process.
- **Route Generation Updates**: Updated `generateKioskDepartureRoute` and `generateBuildingDepartureRoute` to accept optional `userSelectedDestParking` parameter instead of auto-selecting nearest parking.
- **Type Fixes**: Added 'accessible' to travel mode union types in staff.tsx and events.tsx to fix pre-existing type errors.
- **Fixed LSP Errors**: Resolved type mismatches in navigation.tsx by using correct types (`RouteStep` instead of `NavigationStep`) and proper functions (`findNearestParkingByType`, `calculateRouteClientSide`)
- **Kiosk Parking Selection**: Added `generateKioskDepartureRoute()` function to handle multi-phase routes when starting from the kiosk location
- **Route Building Improvements**: Updated `handleParkingSelection` to properly distinguish between kiosk and building starting points for waypoint-based routes
- **Waypoint Driving Mode**: Implemented intelligent parking selection for driving mode with waypoints. Gate starts prompt only for waypoint parking; building starts prompt for both origin and destination parking via multi-phase flow ('origin' → 'waypoint' modes)
- **generateWaypointDrivingRoute Function**: New comprehensive route generator for driving with waypoints supporting walk-drive-walk-walk-drive segments
- **Auto-generate URL Parameter Updates**: Updated auto-generate flow from staff/events pages to handle driving mode with waypoints via parking selection prompts

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