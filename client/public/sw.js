/**
 * ICCAT Service Worker v15
 * Optimized for Windows 11 Kiosk Mode & Complete Offline Operation
 */

const CACHE_NAME = 'iccat-v17';
const DATA_CACHE_NAME = 'iccat-data-v17';
const IMAGE_CACHE_NAME = 'iccat-images-v17';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-512.png',
  '/favicon.png',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&family=Roboto+Mono:wght@400;500;700&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js',
  '/src/main.tsx',
  '/src/App.tsx',
  '/index.css'
];

const API_ENDPOINTS = [
  '/api/buildings',
  '/api/walkpaths',
  '/api/drivepaths',
  '/api/events',
  '/api/staff',
  '/api/floors',
  '/api/rooms',
  '/api/indoor-nodes',
  '/api/room-paths',
  '/api/settings'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
      caches.open(DATA_CACHE_NAME).then((cache) => {
        return Promise.allSettled(
          API_ENDPOINTS.map(url => 
            fetch(url).then(res => {
              if (res.ok) cache.put(url, res);
            })
          )
        );
      })
    ])
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (![CACHE_NAME, DATA_CACHE_NAME, IMAGE_CACHE_NAME].includes(key)) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Handle navigation requests: Network-first, then Cache, then Root
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  // Handle API requests: Network-first, then Cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(DATA_CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Handle Map Tiles: Cache-first
  if (url.origin.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // Default: Cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((response) => {
        if (response.ok && !url.pathname.startsWith('/api/')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});