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
 */
function updateCache(endpoint: string, data: any) {
  console.log(`[LISTENERS] Firebase change detected: ${endpoint}`);
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
