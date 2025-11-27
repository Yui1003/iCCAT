import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { precacheApiImages } from '@/lib/image-precache';

interface CacheVerificationStatus {
  serviceWorker: 'checking' | 'registered' | 'failed';
  staticCache: 'checking' | 'verified' | 'failed';
  dataCache: 'checking' | 'verified' | 'failed';
  mapTiles: 'checking' | 'verified' | 'failed';
  apiEndpoints: 'checking' | 'verified' | 'failed';
  images: 'checking' | 'verified' | 'failed';
  swInstall: 'checking' | 'complete' | 'timeout';
}

export function CacheVerificationLoader({ onComplete }: { onComplete: () => void }) {
  const [status, setStatus] = useState<CacheVerificationStatus>({
    serviceWorker: 'checking',
    staticCache: 'checking',
    dataCache: 'checking',
    mapTiles: 'checking',
    apiEndpoints: 'checking',
    images: 'checking',
    swInstall: 'checking'
  });
  const [isComplete, setIsComplete] = useState(false);
  const [imagePrecacheInfo, setImagePrecacheInfo] = useState<string>('');

  useEffect(() => {
    const verifyCache = async () => {
      try {
        // 0. WAIT for Service Worker install to complete
        // SW sets localStorage when install finishes
        console.log('[CACHE-LOADER] Waiting for Service Worker install to complete...');
        const maxWaitTime = 60000; // 60 seconds max
        const checkInterval = 100;
        let elapsedTime = 0;
        let swInstallComplete = false;

        while (elapsedTime < maxWaitTime && !swInstallComplete) {
          const swInstalled = localStorage.getItem('sw_install_complete') === 'true';
          if (swInstalled) {
            setStatus(prev => ({ ...prev, swInstall: 'complete' }));
            console.log('[CACHE-LOADER] ✓ Service Worker install complete');
            swInstallComplete = true;
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          elapsedTime += checkInterval;
        }

        if (!swInstallComplete) {
          setStatus(prev => ({ ...prev, swInstall: 'timeout' }));
          console.warn('[CACHE-LOADER] Service Worker install timeout (>60s) - proceeding anyway');
        }

        // 1. Verify Service Worker registration
        if ('serviceWorker' in navigator) {
          try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            if (registrations.length > 0) {
              setStatus(prev => ({ ...prev, serviceWorker: 'registered' }));
              console.log('[CACHE-LOADER] Service Worker is registered');
            } else {
              // Try to register if not already registered
              await navigator.serviceWorker.register('/sw.js', { scope: '/' });
              setStatus(prev => ({ ...prev, serviceWorker: 'registered' }));
              console.log('[CACHE-LOADER] Service Worker registered');
            }
          } catch (err) {
            setStatus(prev => ({ ...prev, serviceWorker: 'failed' }));
            console.warn('[CACHE-LOADER] Service Worker registration failed:', err);
          }
        } else {
          setStatus(prev => ({ ...prev, serviceWorker: 'failed' }));
        }

        // 2. Verify static cache
        if (window.caches) {
          const cacheNames = await caches.keys();
          const hasStaticCache = cacheNames.includes('iccat-v6');
          setStatus(prev => ({
            ...prev,
            staticCache: hasStaticCache ? 'verified' : 'failed'
          }));
          console.log('[CACHE-LOADER] Static cache:', hasStaticCache ? 'verified' : 'not found');
        }

        // 3. Verify data cache
        if (window.caches) {
          const dataCache = await caches.open('iccat-data-v6');
          const cachedRequests = await dataCache.keys();
          setStatus(prev => ({
            ...prev,
            dataCache: cachedRequests.length > 0 ? 'verified' : 'failed'
          }));
          console.log(`[CACHE-LOADER] Data cache: ${cachedRequests.length} items cached`);
        }

        // 4. Verify map tiles cache
        if (window.caches) {
          const staticCache = await caches.open('iccat-v6');
          const allCached = await staticCache.keys();
          const tilesCached = allCached.filter(req =>
            req.url.includes('tile.openstreetmap.org')
          ).length;
          setStatus(prev => ({
            ...prev,
            mapTiles: tilesCached > 0 ? 'verified' : 'failed'
          }));
          console.log(`[CACHE-LOADER] Map tiles: ${tilesCached} tiles cached`);
        }

        // 5. Verify API endpoints are cached
        if (window.caches) {
          const dataCache = await caches.open('iccat-data-v6');
          const apiEndpoints = [
            '/api/buildings',
            '/api/walkpaths',
            '/api/drivepaths',
            '/api/floors',
            '/api/rooms',
            '/api/staff',
            '/api/events'
          ];
          
          const cachedEndpoints = await Promise.all(
            apiEndpoints.map(endpoint =>
              dataCache.match(endpoint).then(response => !!response)
            )
          );
          
          const allCached = cachedEndpoints.every(cached => cached);
          setStatus(prev => ({
            ...prev,
            apiEndpoints: allCached ? 'verified' : 'failed'
          }));
          console.log('[CACHE-LOADER] API endpoints cached:', cachedEndpoints);
        }

        // 6. Verify ALL images are cached from IMAGE_CACHE_NAME
        console.log('[CACHE-LOADER] Verifying image cache...');
        if (window.caches) {
          try {
            const imageCache = await caches.open('iccat-images-v6');
            const cachedImages = await imageCache.keys();
            console.log(`[CACHE-LOADER] Found ${cachedImages.length} cached images`);
            
            setImagePrecacheInfo(`${cachedImages.length} images cached`);
            setStatus(prev => ({
              ...prev,
              images: cachedImages.length > 0 ? 'verified' : 'failed'
            }));
            
            if (cachedImages.length === 0) {
              console.warn('[CACHE-LOADER] No images in cache yet - they will be cached during SW install');
            }
          } catch (err) {
            console.error('[CACHE-LOADER] Failed to check image cache:', err);
            setStatus(prev => ({
              ...prev,
              images: 'failed'
            }));
          }
        }

        // 7. WAIT for Service Worker to complete image caching
        console.log('[CACHE-LOADER] Waiting for Service Worker image caching to complete...');
        
        // Wait up to 30 seconds for images to be cached
        const imageWaitMaxTime = 30000;
        const imageCheckInterval = 500;
        let imageElapsedTime = 0;
        let imagesFullyCached = false;

        while (imageElapsedTime < imageWaitMaxTime && !imagesFullyCached) {
          const imageCache = await caches.open('iccat-images-v6');
          const cachedImages = await imageCache.keys();
          
          // Give SW time to extract and cache images
          if (cachedImages.length > 0) {
            console.log(`[CACHE-LOADER] ✓ Images are being cached (${cachedImages.length} so far)`);
            imagesFullyCached = true;
            break;
          }
          
          // Wait and check again
          await new Promise(resolve => setTimeout(resolve, imageCheckInterval));
          imageElapsedTime += imageCheckInterval;
        }

        if (!imagesFullyCached) {
          console.warn('[CACHE-LOADER] Timeout waiting for SW image caching - proceeding anyway');
        }

        setIsComplete(true);
        console.log('[CACHE-LOADER] ✅ Cache verification complete - ready for offline use!');
      } catch (err) {
        console.error('[CACHE-LOADER] Verification error:', err);
        setIsComplete(true);
      }
    };

    verifyCache();
  }, []);

  // Notify parent when cache is complete
  useEffect(() => {
    if (isComplete) {
      // Brief delay to ensure UI updates
      const timer = setTimeout(() => {
        onComplete();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isComplete, onComplete]);

  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'verified':
        return '✓';
      case 'registered':
        return '✓';
      case 'checking':
        return '○';
      case 'failed':
        return '✗';
      default:
        return '?';
    }
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'verified':
      case 'registered':
        return 'text-green-600 dark:text-green-400';
      case 'checking':
        return 'text-blue-600 dark:text-blue-400';
      case 'failed':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-[9999] flex items-center justify-center">
      <div className="space-y-6 max-w-md w-full px-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Preparing Offline Support</h2>
          <p className="text-sm text-muted-foreground">
            Verifying cached files for offline access...
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
            <div className="flex items-center gap-3">
              <Loader2 className={`w-4 h-4 ${status.swInstall === 'checking' ? 'animate-spin' : ''}`} />
              <span className="text-sm">SW Install & Caching</span>
            </div>
            <span className={`text-sm font-medium ${getStatusColor(status.swInstall)}`}>
              {getStatusIcon(status.swInstall)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
            <div className="flex items-center gap-3">
              <Loader2 className={`w-4 h-4 ${status.serviceWorker === 'checking' ? 'animate-spin' : ''}`} />
              <span className="text-sm">Service Worker</span>
            </div>
            <span className={`text-sm font-medium ${getStatusColor(status.serviceWorker)}`}>
              {getStatusIcon(status.serviceWorker)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
            <div className="flex items-center gap-3">
              <Loader2 className={`w-4 h-4 ${status.staticCache === 'checking' ? 'animate-spin' : ''}`} />
              <span className="text-sm">Static Cache</span>
            </div>
            <span className={`text-sm font-medium ${getStatusColor(status.staticCache)}`}>
              {getStatusIcon(status.staticCache)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
            <div className="flex items-center gap-3">
              <Loader2 className={`w-4 h-4 ${status.dataCache === 'checking' ? 'animate-spin' : ''}`} />
              <span className="text-sm">Data Cache</span>
            </div>
            <span className={`text-sm font-medium ${getStatusColor(status.dataCache)}`}>
              {getStatusIcon(status.dataCache)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
            <div className="flex items-center gap-3">
              <Loader2 className={`w-4 h-4 ${status.mapTiles === 'checking' ? 'animate-spin' : ''}`} />
              <span className="text-sm">Map Tiles</span>
            </div>
            <span className={`text-sm font-medium ${getStatusColor(status.mapTiles)}`}>
              {getStatusIcon(status.mapTiles)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
            <div className="flex items-center gap-3">
              <Loader2 className={`w-4 h-4 ${status.apiEndpoints === 'checking' ? 'animate-spin' : ''}`} />
              <span className="text-sm">API Data</span>
            </div>
            <span className={`text-sm font-medium ${getStatusColor(status.apiEndpoints)}`}>
              {getStatusIcon(status.apiEndpoints)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
            <div className="flex items-center gap-3">
              <Loader2 className={`w-4 h-4 ${status.images === 'checking' ? 'animate-spin' : ''}`} />
              <span className="text-sm">Images</span>
            </div>
            <span className={`text-sm font-medium ${getStatusColor(status.images)}`}>
              {getStatusIcon(status.images)}
            </span>
          </div>
        </div>

        {imagePrecacheInfo && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Pre-cached: {imagePrecacheInfo}
            </p>
          </div>
        )}

        <div className="pt-2 text-center">
          <p className="text-xs text-muted-foreground">
            {isComplete
              ? 'Cache verification complete. App is ready!'
              : 'Checking cache status...'}
          </p>
        </div>
      </div>
    </div>
  );
}
