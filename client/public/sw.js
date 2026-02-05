/**
 * ICCAT Service Worker v9
 * Complete offline support with auto-caching of all assets
 */

const CACHE_NAME = 'iccat-v10';
const DATA_CACHE_NAME = 'iccat-data-v10';
const IMAGE_CACHE_NAME = 'iccat-images-v10';

// Static assets to cache immediately
const urlsToCache = [
  '/',
  '/index.html',
  '/data.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&family=Roboto+Mono:wght@400;500;700&display=swap'
];

// API endpoints to cache for offline
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

// File extensions that should be cached for offline
const CACHEABLE_EXTENSIONS = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.woff', '.woff2', '.ttf', '.ico'];

function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const xtile = Math.floor((lng + 180) / 360 * n);
  const ytile = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  return { x: xtile, y: ytile };
}

function generateEssentialTileUrls() {
  const tiles = [];
  
  const bounds = {
    north: 14.407,
    south: 14.398,
    east: 120.870,
    west: 120.862
  };
  
  const essentialZooms = [17, 18, 19];
  
  console.log('[SW] Generating ESSENTIAL tile URLs (zoom 17-18 only)...');
  
  essentialZooms.forEach(zoom => {
    const topLeft = latLngToTile(bounds.north, bounds.west, zoom);
    const bottomRight = latLngToTile(bounds.south, bounds.east, zoom);
    
    console.log(`[SW] Zoom ${zoom}: tiles from (${topLeft.x},${topLeft.y}) to (${bottomRight.x},${bottomRight.y})`);
    
    for (let x = topLeft.x; x <= bottomRight.x; x++) {
      for (let y = topLeft.y; y <= bottomRight.y; y++) {
        const subdomains = ['a', 'b', 'c'];
        const index = Math.abs(x + y) % subdomains.length;
        const subdomain = subdomains[index];
        tiles.push(`https://${subdomain}.tile.openstreetmap.org/${zoom}/${x}/${y}.png`);
      }
    }
  });
  
  console.log(`[SW] Generated ${tiles.length} ESSENTIAL map tile URLs for pre-caching`);
  return tiles;
}

function generateBackgroundTileUrls() {
  const tiles = [];
  
  const bounds = {
    north: 14.407,
    south: 14.398,
    east: 120.870,
    west: 120.862
  };
  
  const backgroundZooms = [16, 20];
  
  backgroundZooms.forEach(zoom => {
    const topLeft = latLngToTile(bounds.north, bounds.west, zoom);
    const bottomRight = latLngToTile(bounds.south, bounds.east, zoom);
    
    for (let x = topLeft.x; x <= bottomRight.x; x++) {
      for (let y = topLeft.y; y <= bottomRight.y; y++) {
        const subdomains = ['a', 'b', 'c'];
        const index = Math.abs(x + y) % subdomains.length;
        const subdomain = subdomains[index];
        tiles.push(`https://${subdomain}.tile.openstreetmap.org/${zoom}/${x}/${y}.png`);
      }
    }
  });
  
  return tiles;
}

async function cacheBackgroundTiles() {
  const tileUrls = generateBackgroundTileUrls();
  console.log(`[SW-BG] Starting background caching of ${tileUrls.length} extra tiles (zoom 16, 19)...`);
  
  const cache = await caches.open(CACHE_NAME);
  let successCount = 0;
  let failCount = 0;
  
  for (const url of tileUrls) {
    try {
      const existingResponse = await cache.match(url);
      if (existingResponse) {
        successCount++;
        continue;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
        successCount++;
      } else {
        failCount++;
      }
    } catch (err) {
      failCount++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(`[SW-BG] Background tile caching complete: ${successCount} succeeded, ${failCount} failed`);
}

/**
 * Check if a URL should be cached based on its extension
 */
function shouldCacheStaticAsset(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  return CACHEABLE_EXTENSIONS.some(ext => pathname.endsWith(ext));
}

/**
 * Check if this is a Vite-bundled asset (has hash in filename)
 */
function isViteBundledAsset(url) {
  const pathname = new URL(url).pathname;
  // Vite assets typically have patterns like: index-CCwASkC2.js, logo-abc123.png
  return /\/assets\/.*-[a-zA-Z0-9]{8,}\.(js|css|png|jpg|jpeg|gif|svg|webp|woff|woff2)$/i.test(pathname);
}

self.addEventListener('install', (event) => {
  console.log('[SW] ========================================');
  console.log('[SW] OPTIMIZED INSTALL - Fast loading enabled');
  console.log('[SW] ========================================');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Step 1/3: Caching static assets...');
      return cache.addAll(urlsToCache).catch(err => {
        console.warn('[SW] Some static assets failed to cache:', err);
        return Promise.resolve();
      });
    }).then(() => {
      return caches.open(DATA_CACHE_NAME);
    }).then((cache) => {
      console.log('[SW] Step 2/3: Fetching fresh API data...');
      return Promise.allSettled(
        apiEndpointsToCache.map(url =>
          fetch(url)
            .then(response => {
              if (response.ok) {
                console.log(`[SW] Cached API: ${url}`);
                return cache.put(url, response);
              } else {
                console.warn(`[SW] Failed to cache ${url}: HTTP ${response.status}`);
              }
            })
            .catch(err => {
              console.warn(`[SW] Failed to fetch ${url}:`, err.message);
            })
        )
      ).then(results => {
        const successful = results.filter(r => r.status === 'fulfilled').length;
        console.log(`[SW] API data cached: ${successful}/${apiEndpointsToCache.length} endpoints`);
      });
    }).then(() => {
      return caches.open(CACHE_NAME);
    }).then((cache) => {
      console.log('[SW] Step 3/3: Caching essential map tiles (zoom 17-18)...');
      const tileUrls = generateEssentialTileUrls();
      
      return Promise.allSettled(
        tileUrls.map(url =>
          fetch(url)
            .then(response => {
              if (response.ok) {
                return cache.put(url, response);
              }
            })
            .catch(() => {})
        )
      ).then(results => {
        const successful = results.filter(r => r.status === 'fulfilled').length;
        console.log(`[SW] Essential tiles cached: ${successful}/${tileUrls.length}`);
      });
    }).then(() => {
      console.log('[SW] ========================================');
      console.log('[SW] INSTALL COMPLETE - App ready to use!');
      console.log('[SW] ========================================');
      console.log('[SW] Background: Will cache extra tiles (zoom 16, 19) after activation');
      
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('sw_install_complete', 'true');
          console.log('[SW] Client notified - app can proceed');
        } catch (e) {
          console.warn('[SW] Cannot access localStorage:', e);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating and cleaning old caches...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME && cacheName !== IMAGE_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Starting background tile caching...');
      cacheBackgroundTiles();
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  // Skip admin routes - always fetch fresh
  if (url.pathname.startsWith('/admin/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Skip SSE/EventSource connections - these should not be cached
  if (url.pathname.startsWith('/api/listen/')) {
    return; // Let the browser handle SSE connections
  }

  // Handle proxied images - cache for offline
  if (url.pathname.startsWith('/api/proxy-image')) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) => {
        const originalUrl = url.searchParams.get('url');
        if (!originalUrl) {
          return fetch(request);
        }
        
        const cacheKey = `/api/proxy-image?url=${encodeURIComponent(originalUrl)}`;
        
        return cache.match(cacheKey).then((cachedResponse) => {
          if (cachedResponse) {
            console.log(`[SW] Proxied image served from cache: ${originalUrl.substring(0, 50)}...`);
            return cachedResponse;
          }
          
          return fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                const responseToCache = response.clone();
                cache.put(cacheKey, responseToCache);
                console.log(`[SW] Proxied image cached: ${originalUrl.substring(0, 50)}...`);
              }
              return response;
            })
            .catch((error) => {
              console.warn(`[SW] Proxied image fetch failed:`, error.message);
              // Return transparent 1x1 PNG as fallback
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

  // Handle API requests - network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then((cache) => {
        return fetch(request)
          .then((response) => {
            if (response.status === 200) {
              try {
                cache.put(request, response.clone());
              } catch (cacheError) {
                console.warn(`[SW] Failed to cache API response: ${url.pathname}`, cacheError.message);
              }
            }
            return response;
          })
          .catch((error) => {
            console.log(`[SW] Network failed for ${url.pathname}, falling back to cache`);
            return cache.match(request).then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              throw error;
            });
          });
      })
    );
    return;
  }

  // Handle OpenStreetMap tiles - cache first for performance
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
                try {
                  cache.put(request, response.clone());
                } catch (cacheError) {
                  console.warn(`[SW] Failed to cache map tile: ${url.pathname}`, cacheError.message);
                }
              }
              return response;
            })
            .catch((error) => {
              // Return placeholder tile when offline
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

  // Handle index.html and root path
  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((response) => {
          if (response) {
            // Return cached version but update in background
            fetch(request).then((freshResponse) => {
              if (freshResponse && freshResponse.status === 200) {
                cache.put(request, freshResponse.clone());
              }
            }).catch(() => {});
            return response;
          }
          
          const alternateRequest = url.pathname === '/' ? '/index.html' : '/';
          return cache.match(alternateRequest).then((altResponse) => {
            if (altResponse) {
              return altResponse;
            }
            
            return fetch(request)
              .then((response) => {
                if (response.status === 200) {
                  try {
                    cache.put(request, response.clone());
                  } catch (cacheError) {
                    console.warn(`[SW] Failed to cache HTML: ${url.pathname}`, cacheError.message);
                  }
                }
                return response;
              })
              .catch((error) => {
                return cache.match('/').then((rootResponse) => {
                  if (rootResponse) return rootResponse;
                  return cache.match('/index.html');
                }).then((fallbackResponse) => {
                  if (fallbackResponse) {
                    return fallbackResponse;
                  }
                  throw error;
                });
              });
          });
        });
      })
    );
    return;
  }

  // Handle Vite-bundled assets (JS, CSS, images with hashes) - CACHE FIRST for performance
  if (url.pathname.startsWith('/assets/') || isViteBundledAsset(request.url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(request).then((response) => {
            if (response && response.status === 200) {
              // Cache bundled assets for offline use
              cache.put(request, response.clone());
              console.log(`[SW] Cached bundled asset: ${url.pathname}`);
            }
            return response;
          }).catch((error) => {
            console.warn(`[SW] Failed to fetch bundled asset: ${url.pathname}`);
            throw error;
          });
        });
      })
    );
    return;
  }

  // Handle other static assets (fonts, images, etc.)
  if (shouldCacheStaticAsset(request.url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(request).then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch((error) => {
            console.warn(`[SW] Failed to fetch static asset: ${url.pathname}`);
            throw error;
          });
        });
      })
    );
    return;
  }

  // Handle all other requests - stale while revalidate
  const isHardRefresh = !globalThis.localStorage || localStorage.getItem('sw_install_complete') !== 'true';
  
  if (isHardRefresh) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }

          try {
            const url = new URL(request.url);
            if (url.protocol === 'http:' || url.protocol === 'https:') {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                try {
                  cache.put(request, responseToCache);
                } catch (cacheError) {
                  console.warn(`[SW] Failed to cache response: ${request.url}`, cacheError.message);
                }
              });
            }
          } catch (e) {
            console.warn(`[SW] Invalid URL for caching: ${request.url}`, e.message);
          }

          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
  } else {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            fetch(request).then((freshResponse) => {
              if (freshResponse && freshResponse.status === 200) {
                try {
                  const url = new URL(request.url);
                  if (url.protocol === 'http:' || url.protocol === 'https:') {
                    caches.open(CACHE_NAME).then((cache) => {
                      try {
                        cache.put(request, freshResponse.clone());
                      } catch (cacheError) {
                        console.warn(`[SW] Failed to update cache: ${request.url}`, cacheError.message);
                      }
                    });
                  }
                } catch (e) {
                  console.warn(`[SW] Invalid URL for updating cache: ${request.url}`, e.message);
                }
              }
            }).catch(() => {});
            return response;
          }

          return fetch(request).then((response) => {
            if (!response || response.status !== 200) {
              return response;
            }

            try {
              const url = new URL(request.url);
              if (url.protocol === 'http:' || url.protocol === 'https:') {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  try {
                    cache.put(request, responseToCache);
                  } catch (cacheError) {
                    console.warn(`[SW] Failed to cache response: ${request.url}`, cacheError.message);
                  }
                });
              }
            } catch (e) {
              console.warn(`[SW] Invalid URL for caching: ${request.url}`, e.message);
            }

            return response;
          });
        })
        .catch(() => {
          return new Response('Offline - resource not available', { status: 503 });
        })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_IMAGE') {
    const imageUrl = event.data.url;
    if (imageUrl) {
      caches.open(IMAGE_CACHE_NAME).then((cache) => {
        fetch(imageUrl, { mode: 'cors', credentials: 'omit' })
          .then((response) => {
            if (response.ok) {
              cache.put(imageUrl, response);
              console.log(`[SW] Image cached via message: ${imageUrl.substring(0, 50)}...`);
            }
          })
          .catch(() => {});
      });
    }
  }
  
  // Force refresh all caches
  if (event.data && event.data.type === 'REFRESH_CACHE') {
    console.log('[SW] Refreshing all caches...');
    caches.open(DATA_CACHE_NAME).then((cache) => {
      apiEndpointsToCache.forEach(url => {
        fetch(url).then(response => {
          if (response.ok) {
            cache.put(url, response);
          }
        }).catch(() => {});
      });
    });
  }
});
