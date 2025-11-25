# CVSU CCAT Campus Navigation App

## Overview
The CVSU CCAT Campus Navigation App is a comprehensive web application designed for campus wayfinding and navigation. It features interactive maps, multi-phase route navigation with color-coded paths and ETA calculations, and tools for administrators to manage content, collect feedback, and track analytics. The application supports both kiosk and mobile QR-code versions, aims to provide an intuitive user experience, and includes offline capabilities. It is deployed on Render with a Firebase backend.

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

### Feature Specifications
- **Campus Maps**: Interactive, multi-zoom level (up to 22), stable tile loading, visualization of existing paths.
- **Admin Tools**: Search and filter for events, buildings, and paths; robust analytics dashboard with visual charts; CSV/JSON export of analytics data; data reset functionality.
- **Navigation**: Multi-phase route generation, color-coded paths, ETA display.
- **Analytics**: Tracks interface actions, loading speeds, route generation; offline data queuing and syncing; Firebase persistence.
- **Data Export**: Formatted CSV with Philippine Timezone and separate date/time columns; JSON export.

### System Design Choices
- **Client-side Performance**: Utilizes React Query for data fetching and caching, and measures actual performance durations for analytics rather than hardcoded values.
- **Backend Persistence**: Firebase Firestore is used for reliable data storage, ensuring data integrity across server restarts.
- **Offline Resilience**: Implements mechanisms to queue and sync data collected while offline, preventing data loss.
- **Modularity**: Codebase is structured with clear separation of concerns (client, server, shared), and dedicated libraries for analytics tracking and ETA calculation.

## Recent Changes
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