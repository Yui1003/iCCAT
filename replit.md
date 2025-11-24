# iCCAT Smart Campus Information Kiosk

## Overview
iCCAT (Interactive Campus Companion and Assistance Terminal) is a full-stack web application designed as an **offline-first** smart kiosk system for Cavite State University's CCAT Campus. Its primary purpose is to provide interactive campus navigation, wayfinding, staff directory, and event information through a touch-optimized interface for public kiosk deployment. The system includes public-facing modules and a comprehensive admin panel for content management, built with complete offline capability including client-side pathfinding and embedded baseline datasets.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework & Build System:** React 18 with TypeScript, Vite, Wouter for routing, SPA architecture.
- **UI Component System:** Shadcn/ui (Radix UI primitives), Material Design principles (48px tap targets), Tailwind CSS, Roboto font family.
- **State Management:** TanStack Query for server state, local React state for UI interactions.
- **Key Frontend Features:** Interactive map with Leaflet.js, offline-first design (Service Worker), touch-optimized interface, responsive layouts.

### Backend Architecture
- **Server Framework:** Express.js with TypeScript, RESTful API.
- **API Structure:** CRUD operations for `buildings`, `floors`, `rooms`, `staff`, `events`, `walkpaths`, `drivepaths`, and admin login.
- **Data Persistence:** PostgreSQL database, Drizzle ORM, schema-first approach with Zod validation, UUID primary keys.
- **Development Environment:** HMR via Vite, custom logging, standardized JSON error handling.

### Data Schema Design
- **Core Entities:** Buildings (geolocation, departments), Floors (hierarchical to buildings), Rooms (x/y coordinates on floor plans), Staff (linked to locations), Events (temporal, optional building link), Walkpaths/Drivepaths (coordinate nodes).
- **Relationships:** One-to-many relationships (Buildings to Floors, Floors to Rooms), direct references, and JSONB arrays for paths.

### Authentication & Authorization
- **Admin Access:** Simple username/password via `/api/admin/login`, localStorage flag for session persistence, client-side protected routes.

### Navigation & Pathfinding
- **Algorithm:** Dijkstra's shortest path algorithm (client-side implementation).
- **Offline Capability:** Complete pathfinding operates in browser without server dependency.
- **Graph Construction:** Paths converted to graph of nodes and weighted edges. Node snapping merges nodes from *different* paths within 10 meters, while preserving same-path structure. Edge weights use Haversine distance. Building start/end points project onto nearest path segment.
- **Path Calculation:** Finds shortest route between buildings, returning waypoints along actual paths.
- **Walkpath Network Design:** Supports unlimited branching paths with `pathId`-based merge control, ensuring correct junction creation and preservation of individual path structures.

### Offline-First Architecture
- **Embedded Baseline Data:** All critical datasets (buildings, staff, floors, rooms, events, walkpaths, drivepaths) bundled in JavaScript build at `client/src/lib/baseline-data.json`.
- **Triple-Tier Fallback Strategy:** 
  1. **Tier 1:** Try fetch from API (served from Service Worker cache if available)
  2. **Tier 2:** Read directly from CacheStorage if fetch fails
  3. **Tier 3:** Use embedded baseline data (guaranteed to work)
- **Global React Query Integration:** All queries automatically use offline-first strategy via custom `offlineFirstQueryFn` in queryClient.
- **First-Boot Offline Support:** Kiosk works perfectly on first boot with zero network connectivity - all features render from embedded data.
- **Service Worker Caching:** Cache-first strategy for API requests, resilient install process tolerates offline conditions, pre-caches critical endpoints when online.
- **Browser Compatibility:** Uses `window.caches` API for proper browser main-thread compatibility.
- **Cache Invalidation Strategy (Three-Layer):** Admin mutations clear all cache layers to ensure immediate updates in navigation:
  1. **In-Memory Cache:** `cachedDrivepaths`/`cachedWalkpaths` set to null
  2. **React Query Cache:** `invalidateQueries` for `/api/walkpaths` and `/api/drivepaths`
  3. **Service Worker CacheStorage:** Delete cached entries for path endpoints
  - All invalidation steps are awaited to prevent race conditions before UI updates
  - `fetchWithCacheFallback` and `offlineFirstQueryFn` update CacheStorage with fresh data on successful network fetches

## External Dependencies

### Third-Party Services
- **Mapping Services:** OpenStreetMap tile servers, Leaflet.js library (v1.9.4).
- **CDN Resources:** Google Fonts API.

### Database
- **PostgreSQL:** Configured via `DATABASE_URL`, uses `@neondatabase/serverless` driver, Drizzle Kit for migrations.

### Build & Development Tools
- **Core Dependencies:** Node.js, TypeScript, esbuild, PostCSS with Autoprefixer.

### UI Component Libraries
- **Radix UI Primitives:** Dialog, Alert Dialog, Dropdown Menu, Select, Tabs, Toast, Tooltips, Popovers, Form controls, Navigation components.
- **Additional UI:** `class-variance-authority`, `cmdk`, `embla-carousel-react`, `date-fns`, `lucide-react`.

### Form Management
- `react-hook-form` for state management, `@hookform/resolvers` with Zod for validation, `drizzle-zod`.

### Service Worker
- **Offline Caching:** Static assets cached on install, cache-first strategy for API requests, separate cache namespaces for static and data.
- **Map Tile Pre-Caching:** Deterministic subdomain selection algorithm `(x + y) % subdomains.length` matches Leaflet's runtime URL generation. Pre-caches all campus area tiles (zoom levels 17-18, ~16-20 tiles covering lat: 14.400-14.405, lng: 120.864-120.868) during Service Worker installation for complete offline map functionality. Uses explicit subdomain array `['a', 'b', 'c']` matching Leaflet configuration to ensure perfect cache hits.