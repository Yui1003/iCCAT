/**
 * Image pre-caching utility
 * Extracts image URLs from API responses and proactively caches them
 * during the loading phase to ensure offline image availability
 * 
 * All external images are fetched through the /api/proxy-image endpoint
 * to bypass CORS restrictions and ensure proper caching
 */

import { getProxiedImageUrl } from '@/components/proxied-image';

// MUST match service worker cache versions!
const CACHE_NAME = 'iccat-v8';
const DATA_CACHE_NAME = 'iccat-data-v8';
const IMAGE_CACHE_NAME = 'iccat-images-v8';

export interface ImagePrecacheStatus {
  extracted: number;
  cached: number;
  failed: number;
}

/**
 * Extracts all image URLs from API response objects
 */
function extractImageUrls(data: any, urls: Set<string> = new Set()): Set<string> {
  if (!data) return urls;

  if (Array.isArray(data)) {
    data.forEach(item => extractImageUrls(item, urls));
  } else if (typeof data === 'object') {
    // Check for common image field names
    const imageFields = ['image', 'photo', 'floorPlanImage', 'imageUrl', 'photoUrl', 'picture'];
    
    for (const field of imageFields) {
      if (field in data && typeof data[field] === 'string' && data[field]) {
        const url = data[field];
        // Only cache actual URLs (http/https or /), not placeholders
        if (url.startsWith('http') || url.startsWith('/')) {
          urls.add(url);
        }
      }
    }
    
    // Recursively check nested objects
    for (const key in data) {
      if (typeof data[key] === 'object') {
        extractImageUrls(data[key], urls);
      }
    }
  }

  return urls;
}

/**
 * Pre-caches images from API responses
 * Called during app initialization to ensure offline image availability
 */
export async function precacheApiImages(): Promise<ImagePrecacheStatus> {
  const status: ImagePrecacheStatus = {
    extracted: 0,
    cached: 0,
    failed: 0
  };

  try {
    const apiEndpoints = [
      '/api/buildings',
      '/api/staff',
      '/api/events',
      '/api/floors'
    ];

    const imageUrls = new Set<string>();

    // Fetch all API data and extract image URLs
    console.log('[IMAGE-PRECACHE] Extracting image URLs from API responses...');
    
    for (const endpoint of apiEndpoints) {
      try {
        const response = await fetch(endpoint, { 
          credentials: 'include',
          cache: 'no-cache'
        });
        
        if (response.ok) {
          const data = await response.json();
          extractImageUrls(data, imageUrls);
        }
      } catch (err) {
        console.warn(`[IMAGE-PRECACHE] Failed to fetch ${endpoint}:`, err);
      }
    }

    status.extracted = imageUrls.size;
    console.log(`[IMAGE-PRECACHE] Extracted ${status.extracted} unique image URLs`);

    if (status.extracted === 0) {
      console.log('[IMAGE-PRECACHE] No images to pre-cache');
      return status;
    }

    // Batch fetch and cache all images through the proxy endpoint
    console.log('[IMAGE-PRECACHE] Pre-caching images through proxy...');
    
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const imageArray = Array.from(imageUrls);

    // Batch fetch with Promise.allSettled to handle failures gracefully
    // All images are fetched through the proxy to bypass CORS restrictions
    const fetchPromises = imageArray.map(originalUrl => {
      const proxyUrl = getProxiedImageUrl(originalUrl);
      
      return fetch(proxyUrl, { cache: 'no-store' })
        .then(response => {
          if (response.ok) {
            // Cache using the proxy URL (this is what the ProxiedImage component will request)
            return cache.put(proxyUrl, response.clone()).then(() => {
              status.cached++;
              console.log(`[IMAGE-PRECACHE] ✓ Cached: ${originalUrl.substring(0, 60)}...`);
              return { success: true, url: originalUrl };
            });
          } else {
            status.failed++;
            console.warn(`[IMAGE-PRECACHE] ✗ Failed (HTTP ${response.status}): ${originalUrl.substring(0, 60)}...`);
            return { success: false, url: originalUrl, status: response.status };
          }
        })
        .catch(err => {
          status.failed++;
          console.warn(`[IMAGE-PRECACHE] ✗ Fetch error: ${originalUrl.substring(0, 60)}...`, err.message);
          return { success: false, url: originalUrl, error: err.message };
        });
    });

    const results = await Promise.allSettled(fetchPromises);
    
    // Count actual results
    const fulfilled = results.filter(r => r.status === 'fulfilled').length;
    console.log(`[IMAGE-PRECACHE] Pre-caching complete: ${status.cached}/${status.extracted} cached, ${status.failed} failed`);

    return status;
  } catch (err) {
    console.error('[IMAGE-PRECACHE] Fatal error during pre-caching:', err);
    return status;
  }
}

/**
 * Get statistics about cached images
 */
/**
 * Dynamically cache new images when they're added via real-time updates
 * Called when Firebase listeners receive new/updated data with image URLs
 */
export async function cacheNewImages(data: any): Promise<void> {
  try {
    const imageUrls = extractImageUrls(data);
    
    if (imageUrls.size === 0) {
      return;
    }

    console.log(`[IMAGE-PRECACHE] Caching ${imageUrls.size} new images from real-time update...`);
    
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const imageArray = Array.from(imageUrls);

    // Batch fetch new images through the proxy to bypass CORS
    const fetchPromises = imageArray.map(originalUrl => {
      const proxyUrl = getProxiedImageUrl(originalUrl);
      
      return fetch(proxyUrl, { cache: 'no-store' })
        .then(response => {
          if (response.ok) {
            // Cache using the proxy URL (this is what the ProxiedImage component will request)
            return cache.put(proxyUrl, response.clone()).then(() => {
              console.log(`[IMAGE-PRECACHE] ✓ Cached image: ${originalUrl.substring(0, 60)}...`);
              return true;
            });
          } else {
            console.warn(`[IMAGE-PRECACHE] ✗ Failed to cache image (HTTP ${response.status}): ${originalUrl.substring(0, 60)}...`);
            return false;
          }
        })
        .catch(err => {
          console.warn(`[IMAGE-PRECACHE] ✗ Failed to fetch image: ${originalUrl.substring(0, 60)}...`, err.message);
          return false;
        });
    });

    await Promise.allSettled(fetchPromises);
  } catch (err) {
    console.error('[IMAGE-PRECACHE] Error caching new images:', err);
  }
}

export async function getImageCacheStats(): Promise<{ count: number; size: number }> {
  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const requests = await cache.keys();
    
    // Filter to image requests (rough heuristic)
    const imageRequests = requests.filter(req => {
      const url = req.url.toLowerCase();
      return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url) || 
             url.includes('photo') || 
             url.includes('image') ||
             url.includes('floor');
    });

    // Estimate size (very rough)
    let totalSize = 0;
    for (const req of imageRequests) {
      try {
        const response = await cache.match(req);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      } catch (err) {
        // Continue on error
      }
    }

    return {
      count: imageRequests.length,
      size: totalSize
    };
  } catch (err) {
    console.error('[IMAGE-PRECACHE] Error getting cache stats:', err);
    return { count: 0, size: 0 };
  }
}
