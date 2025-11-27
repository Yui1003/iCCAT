import type { Walkpath, Drivepath, Building, Staff, Floor, Room, Event } from "@shared/schema";
import baselineData from "./baseline-data.json";

const DATA_CACHE_NAME = 'iccat-data-v7';

let cachedBuildings: Building[] | null = null;
let cachedWalkpaths: Walkpath[] | null = null;
let cachedDrivepaths: Drivepath[] | null = null;
let cachedStaff: Staff[] | null = null;
let cachedFloors: Floor[] | null = null;
let cachedRooms: Room[] | null = null;
let cachedEvents: Event[] | null = null;

async function fetchWithCacheFallback<T>(
  url: string, 
  dataJsonKey: keyof typeof baselineData
): Promise<T> {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      
      // Update CacheStorage with fresh data when network fetch succeeds
      if (window.caches) {
        try {
          const cache = await window.caches.open(DATA_CACHE_NAME);
          const responseToCache = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
          });
          await cache.put(url, responseToCache);
          console.log(`[OFFLINE] Updated CacheStorage for ${url}`);
        } catch (cacheError) {
          console.error(`[OFFLINE] Failed to update CacheStorage for ${url}:`, cacheError);
        }
      }
      
      return data;
    }
  } catch (fetchError) {
    console.log(`[OFFLINE] Fetch failed for ${url} (offline or network error), trying cache...`);
  }

  if (window.caches) {
    try {
      const cache = await window.caches.open(DATA_CACHE_NAME);
      const cachedResponse = await cache.match(url);
      if (cachedResponse) {
        console.log(`[OFFLINE] Retrieved ${url} from CacheStorage`);
        return await cachedResponse.json();
      }
    } catch (cacheError) {
      console.error(`[OFFLINE] CacheStorage error for ${url}:`, cacheError);
    }
  }

  console.log(`[OFFLINE] Using embedded baseline data for ${dataJsonKey}`);
  return baselineData[dataJsonKey] as T;
}

export async function getWalkpaths(): Promise<Walkpath[]> {
  if (cachedWalkpaths) {
    console.log('[OFFLINE] Using in-memory cached walkpaths');
    return cachedWalkpaths;
  }

  const walkpaths = await fetchWithCacheFallback<Walkpath[]>('/api/walkpaths', 'walkpaths');
  cachedWalkpaths = walkpaths;
  console.log('[OFFLINE] Loaded walkpaths:', walkpaths.length);
  return walkpaths;
}

export async function getDrivepaths(): Promise<Drivepath[]> {
  if (cachedDrivepaths) {
    console.log('[OFFLINE] Using in-memory cached drivepaths');
    return cachedDrivepaths;
  }

  const drivepaths = await fetchWithCacheFallback<Drivepath[]>('/api/drivepaths', 'drivepaths');
  cachedDrivepaths = drivepaths;
  console.log('[OFFLINE] Loaded drivepaths:', drivepaths.length);
  return drivepaths;
}

export async function getBuildings(): Promise<Building[]> {
  if (cachedBuildings) {
    console.log('[OFFLINE] Using in-memory cached buildings');
    return cachedBuildings;
  }

  const buildings = await fetchWithCacheFallback<Building[]>('/api/buildings', 'buildings');
  cachedBuildings = buildings;
  console.log('[OFFLINE] Loaded buildings:', buildings.length);
  return buildings;
}

export async function getStaff(): Promise<Staff[]> {
  if (cachedStaff) {
    console.log('[OFFLINE] Using in-memory cached staff');
    return cachedStaff;
  }

  const staff = await fetchWithCacheFallback<Staff[]>('/api/staff', 'staff');
  cachedStaff = staff;
  console.log('[OFFLINE] Loaded staff:', staff.length);
  return staff;
}

export async function getFloors(): Promise<Floor[]> {
  if (cachedFloors) {
    console.log('[OFFLINE] Using in-memory cached floors');
    return cachedFloors;
  }

  const floors = await fetchWithCacheFallback<Floor[]>('/api/floors', 'floors');
  cachedFloors = floors;
  console.log('[OFFLINE] Loaded floors:', floors.length);
  return floors;
}

export async function getRooms(): Promise<Room[]> {
  if (cachedRooms) {
    console.log('[OFFLINE] Using in-memory cached rooms');
    return cachedRooms;
  }

  const rooms = await fetchWithCacheFallback<Room[]>('/api/rooms', 'rooms');
  cachedRooms = rooms;
  console.log('[OFFLINE] Loaded rooms:', rooms.length);
  return rooms;
}

export async function getEvents(): Promise<Event[]> {
  if (cachedEvents) {
    console.log('[OFFLINE] Using in-memory cached events');
    return cachedEvents;
  }

  const events = await fetchWithCacheFallback<Event[]>('/api/events', 'events');
  cachedEvents = events;
  console.log('[OFFLINE] Loaded events:', events.length);
  return events;
}

export function clearAllCache() {
  cachedBuildings = null;
  cachedWalkpaths = null;
  cachedDrivepaths = null;
  cachedStaff = null;
  cachedFloors = null;
  cachedRooms = null;
  cachedEvents = null;
  console.log('[OFFLINE] All data cache cleared');
}

export function clearPathCache() {
  cachedWalkpaths = null;
  cachedDrivepaths = null;
  console.log('[OFFLINE] Path cache cleared');
}

export async function deleteCacheStorageEntry(url: string): Promise<void> {
  if (window.caches) {
    try {
      const cache = await window.caches.open(DATA_CACHE_NAME);
      
      // Get all cache keys (Request objects) and find matching ones
      const cacheKeys = await cache.keys();
      const targetUrl = new URL(url, window.location.origin);
      
      const matchingKeys = cacheKeys.filter(request => {
        // Only delete GET requests to avoid removing POST/PUT/DELETE entries
        if (request.method !== 'GET') {
          return false;
        }
        
        const requestUrl = new URL(request.url);
        
        // If target URL has no query string, delete all GET requests to that pathname
        // (including those with query strings like ?ts=123)
        if (!targetUrl.search) {
          return requestUrl.pathname === targetUrl.pathname;
        }
        
        // If target URL has query string, match both pathname and search params exactly
        return requestUrl.pathname === targetUrl.pathname && 
               requestUrl.search === targetUrl.search;
      });
      
      // Delete all matching entries
      if (matchingKeys.length > 0) {
        await Promise.all(matchingKeys.map(key => cache.delete(key)));
        console.log(`[OFFLINE] Deleted ${matchingKeys.length} CacheStorage entry(s) for ${url}`);
      } else {
        console.log(`[OFFLINE] No CacheStorage entry found for ${url}`);
      }
    } catch (error) {
      console.error(`[OFFLINE] Failed to delete CacheStorage entry for ${url}:`, error);
    }
  }
}

export async function invalidatePathCaches(): Promise<void> {
  clearPathCache();
  await Promise.all([
    deleteCacheStorageEntry('/api/walkpaths'),
    deleteCacheStorageEntry('/api/drivepaths')
  ]);
  console.log('[OFFLINE] All path caches invalidated');
}

/**
 * Universal cache invalidation helper - clears ALL 3 cache layers for a specific endpoint
 * 
 * Layer 1: In-memory cache (module-level variables)
 * Layer 2: Service Worker CacheStorage (persistent offline cache)
 * Layer 3: React Query cache (via queryClient.invalidateQueries)
 * 
 * @param endpoint - The API endpoint to invalidate (e.g., '/api/buildings', '/api/events')
 * @param queryClient - React Query client instance for cache invalidation
 */
export async function invalidateEndpointCache(
  endpoint: string, 
  queryClient?: any
): Promise<void> {
  console.log(`[CACHE INVALIDATION] Starting comprehensive invalidation for ${endpoint}`);
  
  // Layer 1: Clear in-memory cache based on endpoint
  // Note: Settings endpoints don't have in-memory caches, but we clear them anyway for consistency
  switch (endpoint) {
    case '/api/buildings':
      cachedBuildings = null;
      break;
    case '/api/walkpaths':
      cachedWalkpaths = null;
      break;
    case '/api/drivepaths':
      cachedDrivepaths = null;
      break;
    case '/api/staff':
      cachedStaff = null;
      break;
    case '/api/floors':
      cachedFloors = null;
      break;
    case '/api/rooms':
      cachedRooms = null;
      break;
    case '/api/events':
      cachedEvents = null;
      break;
    // Settings endpoints - no in-memory cache but included for Layer 2 & 3 invalidation
    case '/api/settings/home_inactivity_timeout':
    case '/api/settings/global_inactivity_timeout':
      // No in-memory cache for settings
      break;
  }
  
  // Layer 2: Delete from Service Worker CacheStorage
  await deleteCacheStorageEntry(endpoint);
  
  // Layer 3: Invalidate React Query cache and force IMMEDIATE refetch for ALL queries
  if (queryClient) {
    // Invalidate queries to mark them as stale
    await queryClient.invalidateQueries({ 
      queryKey: [endpoint],
      exact: false  // Enable partial matching for derivative keys
    });
    
    // Force immediate refetch for ALL queries (active or cached), not just active mounted ones
    // This ensures instant updates even when navigation page is not currently visible
    await queryClient.refetchQueries({
      queryKey: [endpoint],
      exact: false,  // Refetch derivatives too
      type: 'all'  // Refetch ALL queries (active + inactive cached)
    });
    
    // Also prefetch to ensure data is ready in cache for next page view
    await queryClient.prefetchQuery({
      queryKey: [endpoint]
    });
    
    console.log(`[CACHE INVALIDATION] ✅ Invalidated, refetched (all), and prefetched ${endpoint}`);
  }
  
  console.log(`[CACHE INVALIDATION] ✅ Complete for ${endpoint} (all 3 layers cleared)`);
}

/**
 * Universal cache invalidation for ALL endpoints - clears all 3 cache layers
 * 
 * Use this when you need to invalidate everything (e.g., major data changes)
 * 
 * @param queryClient - React Query client instance for cache invalidation
 */
export async function invalidateAllCaches(queryClient?: any): Promise<void> {
  console.log('[CACHE INVALIDATION] Starting comprehensive invalidation for ALL endpoints');
  
  // Layer 1: Clear all in-memory caches
  clearAllCache();
  
  // Layer 2: Delete all entries from Service Worker CacheStorage
  await Promise.all([
    deleteCacheStorageEntry('/api/buildings'),
    deleteCacheStorageEntry('/api/walkpaths'),
    deleteCacheStorageEntry('/api/drivepaths'),
    deleteCacheStorageEntry('/api/staff'),
    deleteCacheStorageEntry('/api/floors'),
    deleteCacheStorageEntry('/api/rooms'),
    deleteCacheStorageEntry('/api/events'),
    deleteCacheStorageEntry('/api/settings/home_inactivity_timeout'),
    deleteCacheStorageEntry('/api/settings/global_inactivity_timeout')
  ]);
  
  // Layer 3: Invalidate all React Query caches
  if (queryClient) {
    await queryClient.invalidateQueries();
    console.log('[CACHE INVALIDATION] Invalidated all React Query caches');
  }
  
  console.log('[CACHE INVALIDATION] ✅ Complete for ALL endpoints (all 3 layers cleared)');
}
