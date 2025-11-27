# Cache Auto-Update Flow: Database Changes → Background Cache Update

## Complete Data Flow (Network Online)

```
ADMIN MAKES CHANGE (e.g., creates new building)
         ↓
   POST /api/buildings
         ↓
BACKEND PROCESSES
  • Validates with Zod
  • Stores in Firebase
  • Fetches ALL buildings
         ↓
BROADCASTS TO LISTENERS
  notifyBuildingsChange(buildings)
         ↓
ALL CONNECTED LISTENERS RECEIVE UPDATE
  (No Firebase read - just broadcast)
         ↓
KIOSK 1 RECEIVES BROADCAST
         ↓
EventSource.onmessage triggered
  └─→ updateCache('/api/buildings', data)
         ↓
  TWO CACHES UPDATED SIMULTANEOUSLY (BACKGROUND):
  
  ┌────────────────────┐         ┌──────────────────────┐
  │ React Query Cache  │         │ CacheStorage (SW)    │
  │ (In-Memory)        │         │ (Persistent)         │
  ├────────────────────┤         ├──────────────────────┤
  │ queryClient.       │         │ caches.open()        │
  │ setQueryData(      │         │   .put(              │
  │  ['/api/...'],     │    ✓    │    endpoint,         │
  │  buildings         │         │    response)         │
  │ )                  │         │                      │
  └────────────────────┘         └──────────────────────┘
         ↓                               ↓
    INSTANT                        BACKGROUND
  (Next render)                   (Persistent)
         ↓                               ↓
   UI re-renders                   Survives refresh
   with new data                   Survives offline
```

---

## Code Evidence: Automatic Cache Update

**File**: `client/src/lib/firebase-listeners.ts` (Lines 38-51)

```typescript
/**
 * Helper: Updates React Query cache when data changes
 */
function updateCache(endpoint: string, data: any) {
  console.log(`[LISTENERS] Firebase change detected: ${endpoint}`);
  
  // ✅ CACHE UPDATE #1: React Query (instant, in-memory)
  queryClient.setQueryData([endpoint], data);
  
  // ✅ CACHE UPDATE #2: CacheStorage (background, persistent)
  if (window.caches) {
    caches.open('iccat-data-v6').then(cache => {
      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
      cache.put(endpoint, response);
    });
  }
}
```

**When this is called** (Line 64):
```typescript
eventSource.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    updateCache('/api/buildings', data);  // ← Automatic cache update!
  } catch (err) {
    console.error('[LISTENERS] Failed to parse buildings data:', err);
  }
};
```

---

## Scenario: Step-by-Step Cache Update

### Scenario: Admin creates new building at 10:30 AM

**10:30:00** - Admin submits form in Admin Dashboard
```
POST /api/buildings
{
  "name": "New Science Hall",
  "lat": 14.123,
  "lng": 121.456,
  ...
}
```

**10:30:01** - Backend processes (server logs)
```
[express] POST /api/buildings 201 in 45ms
```

**10:30:01** - Broadcast sent to all connected listeners
```javascript
// server/routes.ts
const buildings = await storage.getBuildings();  // Get all buildings
notifyBuildingsChange(buildings);                // Broadcast to all
```

**10:30:02** - Listener receives broadcast
```log
[LISTENERS] Firebase change detected: /api/buildings
```

**10:30:02** - Cache updated (BOTH at same time)
```javascript
// React Query cache (INSTANT)
queryClient.setQueryData(['/api/buildings'], [...buildings]);
// ↓
// Any component using useQuery(['/api/buildings']) re-renders immediately
// ↓
// UI shows new building marker on map

// CacheStorage (BACKGROUND, asynchronous)
caches.open('iccat-data-v6').then(cache => {
  cache.put('/api/buildings', responseWithNewBuilding);
});
// ↓
// Saved to disk for offline use
// ↓
// Survives browser refresh, survives kiosk restart
```

**10:30:02.5** - User sees new building on map (no refresh needed!)

---

## Cache Update Verification

### Console Logs You'll See

When admin makes a change:
```
[LISTENERS] Firebase change detected: /api/buildings
[LISTENERS] Firebase change detected: /api/buildings
[LISTENERS] Firebase change detected: /api/buildings
```

(Note: You'll see it 1-3 times due to multiple components listening)

### Testing Cache Updates

1. **In Admin Dashboard**: Create a new building
2. **In Browser Console**: Open DevTools (F12)
3. **Switch to Another Page**: Go to Campus Navigation
4. **The new building appears instantly** (from broadcast)

### Offline Cache Verification

1. **Make a change online** (admin creates building)
2. **Go offline** (DevTools → Network → Offline)
3. **Refresh page** (F5)
4. **The new building is still there** (from CacheStorage!)

---

## All 10 Collections Auto-Cache Updates

Every collection follows the same pattern:

| Collection | Listener Endpoint | Auto-Cache? |
|-----------|-------------------|-------------|
| Buildings | `/api/listen/buildings` | ✅ Yes |
| Floors | `/api/listen/floors` | ✅ Yes |
| Rooms | `/api/listen/rooms` | ✅ Yes |
| Staff | `/api/listen/staff` | ✅ Yes |
| Events | `/api/listen/events` | ✅ Yes |
| Walkpaths | `/api/listen/walkpaths` | ✅ Yes |
| Drivepaths | `/api/listen/drivepaths` | ✅ Yes |
| Indoor-nodes | `/api/listen/indoor-nodes` | ✅ Yes |
| Room-paths | `/api/listen/room-paths` | ✅ Yes |
| Settings | `/api/listen/settings` | ✅ Yes |

---

## Background vs Foreground

### React Query Cache (Foreground)
- ✅ **Instant** - Updates immediately
- ✅ **In-Memory** - Super fast
- ⚠️ **Lost on refresh** - In-memory only
- ✅ **Triggers UI re-render** - Immediate visual update

### CacheStorage (Background)
- ✅ **Async** - Updates in background
- ✅ **Persistent** - Survives refresh/restart
- ✅ **Offline-ready** - Available when offline
- ⚠️ **Slower** - Disk I/O vs memory

**Both happen together automatically!**

---

## Summary: Automatic Cache Updates

| When | What Happens | Result |
|------|-------------|--------|
| Admin creates building | EventSource broadcast → updateCache() | React Query + CacheStorage both updated |
| Admin updates room | Same process | All caches updated |
| Admin deletes event | Same process | All caches updated |
| User navigates | Components read from updated cache | Shows latest data |
| Kiosk goes offline | CacheStorage serves cached data | Still shows latest buildings/rooms/staff |
| Kiosk comes back online | Reconnects, gets full latest dataset | Shows all changes made while offline |

**Result**: Your kiosk ALWAYS shows the latest data, whether online or offline! ✅
