/**
 * Firebase Real-Time Listeners with Auto-Reconnection
 * Replaces polling with Firebase change notifications
 * Cost: ~1-5K reads/day instead of 100K
 * Real-time: Instant updates instead of 5-second delay
 * 
 * Features:
 * - Auto-reconnection with exponential backoff
 * - Network online/offline detection
 * - Graceful error handling
 */

import { queryClient } from './queryClient';
import { cacheNewImages } from './image-precache';

// Track active listeners so we can unsubscribe
const activeListeners: (() => void)[] = [];

// Track listener states for reconnection
interface ListenerState {
  endpoint: string;
  apiEndpoint: string;
  eventSource: EventSource | null;
  retryCount: number;
  retryTimeout: NodeJS.Timeout | null;
  isActive: boolean;
}

const listenerStates: Map<string, ListenerState> = new Map();

// Configuration
const MAX_RETRIES = 10;
const BASE_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

/**
 * Sets up Firebase listeners for all collections
 * Called once on app initialization
 */
export function initializeFirebaseListeners() {
  console.log('[LISTENERS] Initializing Firebase real-time listeners with auto-reconnection');
  
  // Set up network online/offline detection for reconnection
  window.addEventListener('online', handleNetworkOnline);
  window.addEventListener('offline', handleNetworkOffline);
  
  // Set up all listeners
  createReconnectingListener('/api/listen/buildings', '/api/buildings');
  createReconnectingListener('/api/listen/events', '/api/events');
  createReconnectingListener('/api/listen/staff', '/api/staff');
  createReconnectingListener('/api/listen/floors', '/api/floors');
  createReconnectingListener('/api/listen/rooms', '/api/rooms');
  createReconnectingListener('/api/listen/walkpaths', '/api/walkpaths');
  createReconnectingListener('/api/listen/drivepaths', '/api/drivepaths');
  createReconnectingListener('/api/listen/indoor-nodes', '/api/indoor-nodes');
  createReconnectingListener('/api/listen/room-paths', '/api/room-paths');
  createReconnectingListener('/api/listen/settings', '/api/settings');
}

/**
 * Handle network coming back online - reconnect all listeners
 */
function handleNetworkOnline() {
  console.log('[LISTENERS] Network online - reconnecting all listeners...');
  listenerStates.forEach((state, key) => {
    if (state.isActive && !state.eventSource) {
      state.retryCount = 0; // Reset retry count on network recovery
      reconnectListener(key);
    }
  });
}

/**
 * Handle network going offline
 */
function handleNetworkOffline() {
  console.log('[LISTENERS] Network offline - listeners will reconnect when online');
}

/**
 * Creates a listener with auto-reconnection capability
 */
function createReconnectingListener(listenEndpoint: string, apiEndpoint: string) {
  const key = listenEndpoint;
  
  // Initialize state
  listenerStates.set(key, {
    endpoint: listenEndpoint,
    apiEndpoint: apiEndpoint,
    eventSource: null,
    retryCount: 0,
    retryTimeout: null,
    isActive: true
  });
  
  // Connect
  connectListener(key);
  
  // Add cleanup function
  activeListeners.push(() => {
    const state = listenerStates.get(key);
    if (state) {
      state.isActive = false;
      if (state.retryTimeout) {
        clearTimeout(state.retryTimeout);
      }
      if (state.eventSource) {
        state.eventSource.close();
      }
    }
  });
}

/**
 * Connect a listener
 */
function connectListener(key: string) {
  const state = listenerStates.get(key);
  if (!state || !state.isActive) return;
  
  try {
    const eventSource = new EventSource(state.endpoint);
    state.eventSource = eventSource;
    
    eventSource.onopen = () => {
      console.log(`[LISTENERS] Connected: ${state.apiEndpoint}`);
      state.retryCount = 0; // Reset retry count on successful connection
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        updateCache(state.apiEndpoint, data);
      } catch (err) {
        console.error(`[LISTENERS] Failed to parse data for ${state.apiEndpoint}:`, err);
      }
    };
    
    eventSource.onerror = (error) => {
      console.warn(`[LISTENERS] Error on ${state.apiEndpoint}:`, error);
      eventSource.close();
      state.eventSource = null;
      
      // Only retry if still active and online
      if (state.isActive && navigator.onLine) {
        scheduleReconnect(key);
      }
    };
  } catch (err) {
    console.warn(`[LISTENERS] Could not connect ${state.endpoint}:`, err);
    if (state.isActive && navigator.onLine) {
      scheduleReconnect(key);
    }
  }
}

/**
 * Schedule a reconnection with exponential backoff
 */
function scheduleReconnect(key: string) {
  const state = listenerStates.get(key);
  if (!state || !state.isActive) return;
  
  if (state.retryCount >= MAX_RETRIES) {
    console.warn(`[LISTENERS] Max retries reached for ${state.apiEndpoint}, giving up`);
    return;
  }
  
  // Exponential backoff with jitter
  const delay = Math.min(
    BASE_RETRY_DELAY * Math.pow(2, state.retryCount) + Math.random() * 1000,
    MAX_RETRY_DELAY
  );
  
  console.log(`[LISTENERS] Reconnecting ${state.apiEndpoint} in ${Math.round(delay/1000)}s (attempt ${state.retryCount + 1}/${MAX_RETRIES})`);
  
  state.retryTimeout = setTimeout(() => {
    state.retryCount++;
    reconnectListener(key);
  }, delay);
}

/**
 * Reconnect a listener
 */
function reconnectListener(key: string) {
  const state = listenerStates.get(key);
  if (!state || !state.isActive) return;
  
  // Close existing connection if any
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
  
  // Clear any pending retry
  if (state.retryTimeout) {
    clearTimeout(state.retryTimeout);
    state.retryTimeout = null;
  }
  
  connectListener(key);
}

/**
 * Helper: Updates React Query cache when data changes
 * Also automatically caches any new images from the update
 */
function updateCache(endpoint: string, data: any) {
  console.log(`[LISTENERS] Firebase change detected: ${endpoint}`);
  queryClient.setQueryData([endpoint], data);
  
  // Update CacheStorage for offline - MUST match service worker cache version!
  if (window.caches) {
    caches.open('iccat-data-v7').then(cache => {
      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
      cache.put(endpoint, response);
    });
    
    // Automatically cache any new images in this update
    // Don't await - let it cache in the background
    cacheNewImages(data).catch(err => {
      console.warn('[LISTENERS] Error caching new images:', err);
    });
  }
}

/**
 * Force reconnect all listeners (useful after app comes back to foreground)
 */
export function reconnectAllListeners() {
  console.log('[LISTENERS] Force reconnecting all listeners...');
  listenerStates.forEach((state, key) => {
    if (state.isActive) {
      state.retryCount = 0;
      reconnectListener(key);
    }
  });
}

/**
 * Clean up all listeners
 */
export function cleanupFirebaseListeners() {
  console.log('[LISTENERS] Cleaning up Firebase listeners');
  
  // Remove network listeners
  window.removeEventListener('online', handleNetworkOnline);
  window.removeEventListener('offline', handleNetworkOffline);
  
  // Clean up all active listeners
  activeListeners.forEach(unsubscribe => unsubscribe());
  activeListeners.length = 0;
  listenerStates.clear();
}
