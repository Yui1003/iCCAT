const CACHE_NAME = 'iccat-v5';
const DATA_CACHE_NAME = 'iccat-data-v5';

const urlsToCache = [
  '/',
  '/index.html',
  '/data.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&family=Roboto+Mono:wght@400;500;700&display=swap'
];

const apiEndpointsToCache = [
  '/api/buildings',
  '/api/walkpaths',
  '/api/drivepaths',
  '/api/events',
  '/api/staff',
  '/api/floors',
  '/api/rooms',
  '/api/indoor-nodes',
  '/api/room-paths',
  '/api/settings/home_inactivity_timeout',
  '/api/settings/global_inactivity_timeout'
];

// Function to convert lat/lng to tile coordinates
function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const xtile = Math.floor((lng + 180) / 360 * n);
  const ytile = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  return { x: xtile, y: ytile };
}

// Generate all tile URLs for the campus area
function generateCampusTileUrls() {
  const tiles = [];
  
  // Campus bounds - expanded significantly to ensure full coverage at all zoom levels
  const bounds = {
    north: 14.407,   // Expanded north
    south: 14.398,   // Expanded south
    east: 120.870,   // Expanded east
    west: 120.862    // Expanded west
  };
  
  // Generate tiles for zoom levels 16, 17, 18, and 19
  // This ensures smooth zooming and panning while offline
  const zooms = [16, 17, 18, 19];
  
  console.log('[SW] Generating tile URLs for campus area...');
  console.log(`[SW] Bounds: N=${bounds.north}, S=${bounds.south}, E=${bounds.east}, W=${bounds.west}`);
  
  zooms.forEach(zoom => {
    // Get tile coordinates for corners
    const topLeft = latLngToTile(bounds.north, bounds.west, zoom);
    const bottomRight = latLngToTile(bounds.south, bounds.east, zoom);
    
    console.log(`[SW] Zoom ${zoom}: tiles from (${topLeft.x},${topLeft.y}) to (${bottomRight.x},${bottomRight.y})`);
    
    // Generate all tiles in the bounding box
    for (let x = topLeft.x; x <= bottomRight.x; x++) {
      for (let y = topLeft.y; y <= bottomRight.y; y++) {
        // Match Leaflet's subdomain selection exactly
        // Leaflet uses Math.abs for consistent subdomain mapping
        const subdomains = ['a', 'b', 'c'];
        const index = Math.abs(x + y) % subdomains.length;
        const subdomain = subdomains[index];
        tiles.push(`https://${subdomain}.tile.openstreetmap.org/${zoom}/${x}/${y}.png`);
      }
    }
  });
  
  console.log(`[SW] Generated ${tiles.length} map tile URLs for pre-caching`);
  return tiles;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(urlsToCache).catch(err => {
        console.warn('[SW] Some static assets failed to cache:', err);
        return Promise.resolve();
      });
    }).then(() => {
      return caches.open(DATA_CACHE_NAME);
    }).then((cache) => {
      console.log('[SW] Pre-caching API endpoints for offline use');
      return Promise.allSettled(
        apiEndpointsToCache.map(url =>
          fetch(url)
            .then(response => {
              if (response.ok) {
                console.log(`[SW] Cached ${url}`);
                return cache.put(url, response);
              } else {
                console.warn(`[SW] Failed to cache ${url}: HTTP ${response.status}`);
              }
            })
            .catch(err => {
              console.warn(`[SW] Failed to fetch ${url} (offline or error):`, err.message);
            })
        )
      ).then(results => {
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`[SW] API pre-caching complete: ${successful} succeeded, ${failed} failed`);
      });
    }).then(() => {
      // Pre-cache map tiles
      return caches.open(CACHE_NAME);
    }).then((cache) => {
      console.log('[SW] Starting map tile pre-caching for offline use...');
      const tileUrls = generateCampusTileUrls();
      console.log(`[SW] Will attempt to cache ${tileUrls.length} tiles`);
      
      let successCount = 0;
      let failCount = 0;
      
      return Promise.allSettled(
        tileUrls.map((url, index) =>
          fetch(url)
            .then(response => {
              if (response.ok) {
                successCount++;
                if (index < 5 || index % 20 === 0) {
                  console.log(`[SW] ✓ Cached tile ${index + 1}/${tileUrls.length}: ${url}`);
                }
                return cache.put(url, response);
              } else {
                failCount++;
                console.error(`[SW] ✗ Failed to cache tile ${url}: HTTP ${response.status}`);
                return Promise.reject(new Error(`HTTP ${response.status}`));
              }
            })
            .catch(err => {
              failCount++;
              console.error(`[SW] ✗ Failed to fetch tile ${url}:`, err.message);
              return Promise.reject(err);
            })
        )
      ).then(results => {
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`[SW] ========================================`);
        console.log(`[SW] Map tile pre-caching complete!`);
        console.log(`[SW] Success: ${successful}/${tileUrls.length} tiles`);
        console.log(`[SW] Failed: ${failed}/${tileUrls.length} tiles`);
        console.log(`[SW] ========================================`);
        
        if (failed > 0) {
          console.warn(`[SW] ${failed} tiles failed to cache. The app may not work fully offline.`);
        }
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  // NEVER cache admin routes - always fetch fresh from network
  if (url.pathname.startsWith('/admin/')) {
    console.log(`[SW] ⛔ Admin route detected: ${url.pathname} - bypassing cache`);
    event.respondWith(fetch(request));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then((cache) => {
        return fetch(request)
          .then((response) => {
            if (response.status === 200) {
              console.log(`[SW] Network-first: Fetched fresh ${url.pathname} from server`);
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch((error) => {
            console.log(`[SW] Network failed for ${url.pathname}, falling back to cache`);
            return cache.match(request).then((cachedResponse) => {
              if (cachedResponse) {
                console.log(`[SW] Serving ${url.pathname} from cache (offline)`);
                return cachedResponse;
              }
              console.error(`[SW] No cache available for ${url.pathname}:`, error);
              throw error;
            });
          });
      })
    );
    return;
  }

  // Cache-first strategy for map tiles
  if (url.origin.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((response) => {
          if (response) {
            return response;
          }
          return fetch(request)
            .then((response) => {
              if (response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch((error) => {
              console.error('[SW] Map tile fetch failed (offline):', error.message);
              // Return a transparent 256x256 PNG as fallback
              // This prevents broken tile images while offline
              return new Response(
                new Blob([new Uint8Array([
                  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
                  0, 0, 1, 0, 0, 0, 1, 0, 8, 6, 0, 0, 0, 92, 114, 168, 229,
                  0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0,
                  4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252, 97, 5, 0, 0, 0,
                  9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111,
                  168, 100, 0, 0, 0, 23, 73, 68, 65, 84, 120, 94, 237, 193, 1,
                  13, 0, 0, 0, 194, 160, 247, 79, 109, 14, 55, 160, 0, 0, 0, 0,
                  0, 0, 230, 7, 32, 0, 0, 1, 225, 33, 177, 39, 0, 0, 0, 0, 73,
                  69, 78, 68, 174, 66, 96, 130
                ])], { type: 'image/png' })
              );
            });
        });
      })
    );
    return;
  }

  // Helper function to check if URL is an image
  function isImageUrl(urlString) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
    const imageKeywords = ['image', 'photo', 'picture', 'floor', 'plan', 'avatar'];
    const urlLower = urlString.toLowerCase();
    
    // Check file extensions
    if (imageExtensions.some(ext => urlLower.includes(ext))) {
      return true;
    }
    
    // Check URL keywords that typically indicate images
    if (imageKeywords.some(keyword => urlLower.includes(keyword))) {
      return true;
    }
    
    return false;
  }

  // Cache-first strategy for images (staff photos, building images, floor plans, etc.)
  if (isImageUrl(url.pathname) || isImageUrl(url.href)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((response) => {
          if (response) {
            console.log(`[SW] Image served from cache: ${url.pathname}`);
            return response;
          }
          
          // Not in cache, try network
          return fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                const responseToCache = response.clone();
                cache.put(request, responseToCache);
                console.log(`[SW] Image cached: ${url.pathname}`);
              }
              return response;
            })
            .catch((error) => {
              console.warn(`[SW] Image fetch failed (offline): ${url.pathname}`, error.message);
              // Return transparent 1x1 PNG placeholder for images that fail offline
              return new Response(
                new Blob([new Uint8Array([
                  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
                  0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0,
                  0, 10, 73, 68, 65, 84, 8, 29, 1, 0, 0, 255, 255, 0, 0, 0, 0, 0, 1,
                  0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
                ])], { type: 'image/png' })
              );
            });
        });
      })
    );
    return;
  }

  // Default: Network-first for other resources, cache as fallback
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(request).then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        });
      })
      .catch(() => {
        // If network fails and no cache, return cached version if available
        return caches.match(request);
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME, DATA_CACHE_NAME];
  
  console.log('[SW] Activating new Service Worker...');
  console.log(`[SW] Current caches: ${cacheWhitelist.join(', ')}`);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log(`[SW] Found existing caches: ${cacheNames.join(', ')}`);
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service Worker activated successfully!');
      return self.clients.claim();
    })
  );
});
