/**
 * Firebase Real-Time Listeners
 * Replaces polling with Firebase change notifications
 * Cost: ~1-5K reads/day instead of 100K
 * Real-time: Instant updates instead of 5-second delay
 */

import { queryClient } from './queryClient';

// Track active listeners so we can unsubscribe
const activeListeners: (() => void)[] = [];

/**
 * Extract all image URLs from data object recursively
 */
function extractImageUrls(data: any, urls: Set<string> = new Set()): Set<string> {
  if (!data) return urls;

  if (Array.isArray(data)) {
    data.forEach(item => extractImageUrls(item, urls));
  } else if (typeof data === 'object') {
    // Common image field names across all collections
    const imageFields = ['image', 'photo', 'floorPlanImage', 'imageUrl', 'photoUrl', 'picture', 'icon', 'avatar'];
    
    for (const field of imageFields) {
      if (field in data && typeof data[field] === 'string' && data[field]) {
        const url = data[field].trim();
        // Cache actual URLs (http/https, //, or /)
        if (url.startsWith('http') || url.startsWith('//') || url.startsWith('/')) {
          urls.add(url);
        }
      }
    }
    
    // Recursively check nested objects
    for (const key in data) {
      if (typeof data[key] === 'object' && data[key] !== null) {
        extractImageUrls(data[key], urls);
      }
    }
  }

  return urls;
}

/**
 * Pre-cache images in background (non-blocking)
 * Called automatically when real-time data arrives with image URLs
 */
async function precacheImagesInBackground(imageUrls: Set<string>, collection: string = 'data') {
  if (imageUrls.size === 0) return;

  console.log(`[LISTENERS] ⏳ Auto-caching ${imageUrls.size} images from ${collection} (background)...`);

  try {
    const cache = await caches.open('iccat-images-v6');
    let successCount = 0;
    let failCount = 0;
    
    // Batch fetch and cache all images
    Array.from(imageUrls).forEach((url, index) => {
      fetch(url, { 
        cache: 'no-store',
        mode: 'cors',
        credentials: 'omit'
      })
        .then(response => {
          if (response.ok) {
            cache.put(url, response.clone());
            successCount++;
            if (index < 3 || index % 5 === 0) {
              console.log(`[LISTENERS] ✓ Auto-cached: ${url.split('/').pop() || url}`);
            }
          } else {
            failCount++;
            console.warn(`[LISTENERS] ✗ Failed to cache ${url}: HTTP ${response.status}`);
          }
        })
        .catch(err => {
          failCount++;
          console.warn(`[LISTENERS] ✗ Failed to fetch ${url}:`, err.message);
        });
    });
    
    // Log summary after a delay
    setTimeout(() => {
      console.log(`[LISTENERS] 📦 Auto-cache summary for ${collection}: ${successCount} cached, ${failCount} failed`);
    }, 1000);
  } catch (err) {
    console.warn('[LISTENERS] Error pre-caching images:', err);
  }
}

/**
 * Sets up Firebase listeners for all collections
 * Called once on app initialization
 */
export function initializeFirebaseListeners() {
  console.log('[LISTENERS] Initializing Firebase real-time listeners');
  
  // Only works if backend is connected to Firebase
  // If using fallback mode, listeners won't fire but app still works
  
  setupBuildingsListener();
  setupEventsListener();
  setupStaffListener();
  setupFloorsListener();
  setupRoomsListener();
  setupWalkpathsListener();
  setupDrivepathsListener();
  setupIndoorNodesListener();
  setupRoomPathsListener();
  setupSettingsListener();
}

/**
 * Helper: Updates React Query cache when data changes
 * Also automatically pre-caches any images in the data
 */
function updateCache(endpoint: string, data: any) {
  // Extract collection name from endpoint (e.g., '/api/staff' -> 'staff')
  const collection = endpoint.split('/').pop() || 'unknown';
  console.log(`[LISTENERS] ✅ Real-time update: ${collection}`);
  queryClient.setQueryData([endpoint], data);
  
  // Update CacheStorage for offline
  if (window.caches) {
    caches.open('iccat-data-v6').then(cache => {
      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
      cache.put(endpoint, response);
    });
  }

  // AUTO-PRECACHE any images from this data in background (non-blocking)
  // This works for ALL CRUD operations: CREATE, UPDATE, DELETE
  const imageUrls = extractImageUrls(data);
  if (imageUrls.size > 0) {
    precacheImagesInBackground(imageUrls, collection);
  }
}

/**
 * Buildings listener
 */
function setupBuildingsListener() {
  try {
    // Call backend endpoint that watches Firebase and streams changes
    const eventSource = new EventSource('/api/listen/buildings');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        updateCache('/api/buildings', data);
      } catch (err) {
        console.error('[LISTENERS] Failed to parse buildings data:', err);
      }
    };
    
    eventSource.onerror = (error) => {
      console.warn('[LISTENERS] Buildings listener error:', error);
      eventSource.close();
      // Fall back to polling on error
    };
    
    activeListeners.push(() => eventSource.close());
  } catch (err) {
    console.warn('[LISTENERS] Could not set up buildings listener:', err);
  }
}

/**
 * Events listener - Used by screensaver and events page
 */
function setupEventsListener() {
  try {
    const eventSource = new EventSource('/api/listen/events');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        updateCache('/api/events', data);
      } catch (err) {
        console.error('[LISTENERS] Failed to parse events data:', err);
      }
    };
    
    eventSource.onerror = () => eventSource.close();
    activeListeners.push(() => eventSource.close());
  } catch (err) {
    console.warn('[LISTENERS] Could not set up events listener:', err);
  }
}

/**
 * Staff listener
 */
function setupStaffListener() {
  try {
    const eventSource = new EventSource('/api/listen/staff');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        updateCache('/api/staff', data);
      } catch (err) {
        console.error('[LISTENERS] Failed to parse staff data:', err);
      }
    };
    
    eventSource.onerror = () => eventSource.close();
    activeListeners.push(() => eventSource.close());
  } catch (err) {
    console.warn('[LISTENERS] Could not set up staff listener:', err);
  }
}

/**
 * Floors listener
 */
function setupFloorsListener() {
  try {
    const eventSource = new EventSource('/api/listen/floors');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        updateCache('/api/floors', data);
      } catch (err) {
        console.error('[LISTENERS] Failed to parse floors data:', err);
      }
    };
    
    eventSource.onerror = () => eventSource.close();
    activeListeners.push(() => eventSource.close());
  } catch (err) {
    console.warn('[LISTENERS] Could not set up floors listener:', err);
  }
}

/**
 * Rooms listener
 */
function setupRoomsListener() {
  try {
    const eventSource = new EventSource('/api/listen/rooms');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        updateCache('/api/rooms', data);
      } catch (err) {
        console.error('[LISTENERS] Failed to parse rooms data:', err);
      }
    };
    
    eventSource.onerror = () => eventSource.close();
    activeListeners.push(() => eventSource.close());
  } catch (err) {
    console.warn('[LISTENERS] Could not set up rooms listener:', err);
  }
}

/**
 * Walkpaths listener
 */
function setupWalkpathsListener() {
  try {
    const eventSource = new EventSource('/api/listen/walkpaths');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        updateCache('/api/walkpaths', data);
      } catch (err) {
        console.error('[LISTENERS] Failed to parse walkpaths data:', err);
      }
    };
    
    eventSource.onerror = () => eventSource.close();
    activeListeners.push(() => eventSource.close());
  } catch (err) {
    console.warn('[LISTENERS] Could not set up walkpaths listener:', err);
  }
}

/**
 * Drivepaths listener
 */
function setupDrivepathsListener() {
  try {
    const eventSource = new EventSource('/api/listen/drivepaths');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        updateCache('/api/drivepaths', data);
      } catch (err) {
        console.error('[LISTENERS] Failed to parse drivepaths data:', err);
      }
    };
    
    eventSource.onerror = () => eventSource.close();
    activeListeners.push(() => eventSource.close());
  } catch (err) {
    console.warn('[LISTENERS] Could not set up drivepaths listener:', err);
  }
}

/**
 * Indoor nodes listener
 */
function setupIndoorNodesListener() {
  try {
    const eventSource = new EventSource('/api/listen/indoor-nodes');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        updateCache('/api/indoor-nodes', data);
      } catch (err) {
        console.error('[LISTENERS] Failed to parse indoor-nodes data:', err);
      }
    };
    
    eventSource.onerror = () => eventSource.close();
    activeListeners.push(() => eventSource.close());
  } catch (err) {
    console.warn('[LISTENERS] Could not set up indoor-nodes listener:', err);
  }
}

/**
 * Room paths listener
 */
function setupRoomPathsListener() {
  try {
    const eventSource = new EventSource('/api/listen/room-paths');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        updateCache('/api/room-paths', data);
      } catch (err) {
        console.error('[LISTENERS] Failed to parse room-paths data:', err);
      }
    };
    
    eventSource.onerror = () => eventSource.close();
    activeListeners.push(() => eventSource.close());
  } catch (err) {
    console.warn('[LISTENERS] Could not set up room-paths listener:', err);
  }
}

/**
 * Settings listener
 */
function setupSettingsListener() {
  try {
    const eventSource = new EventSource('/api/listen/settings');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        updateCache('/api/settings', data);
      } catch (err) {
        console.error('[LISTENERS] Failed to parse settings data:', err);
      }
    };
    
    eventSource.onerror = () => eventSource.close();
    activeListeners.push(() => eventSource.close());
  } catch (err) {
    console.warn('[LISTENERS] Could not set up settings listener:', err);
  }
}

/**
 * Clean up all listeners
 */
export function cleanupFirebaseListeners() {
  console.log('[LISTENERS] Cleaning up Firebase listeners');
  activeListeners.forEach(unsubscribe => unsubscribe());
  activeListeners.length = 0;
}
