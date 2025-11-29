import { useEffect, useState } from 'react';
import { Loader2, Check, AlertCircle } from 'lucide-react';

interface CacheVerificationStatus {
  serviceWorker: 'checking' | 'registered' | 'failed';
  staticCache: 'checking' | 'verified' | 'failed';
  dataCache: 'checking' | 'verified' | 'failed';
  mapTiles: 'checking' | 'verified' | 'failed';
  apiEndpoints: 'checking' | 'verified' | 'failed';
}

export function CacheVerificationLoader({ onComplete }: { onComplete: () => void }) {
  const [status, setStatus] = useState<CacheVerificationStatus>({
    serviceWorker: 'checking',
    staticCache: 'checking',
    dataCache: 'checking',
    mapTiles: 'checking',
    apiEndpoints: 'checking'
  });
  const [isComplete, setIsComplete] = useState(false);
  const [progressMessage, setProgressMessage] = useState('Initializing...');

  useEffect(() => {
    const verifyCache = async () => {
      try {
        // Detect mobile users - skip caching for mobile since it requires internet anyway
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                         window.innerWidth < 768;
        
        if (isMobile) {
          console.log('[CACHE-LOADER] Mobile device detected - skipping cache verification (requires internet)');
          setIsComplete(true);
          return;
        }
        
        const isHardRefresh = !localStorage.getItem('sw_install_complete');
        
        if (!isHardRefresh) {
          console.log('[CACHE-LOADER] Normal refresh - caches exist, closing loader immediately');
          setIsComplete(true);
          return;
        }
        
        console.log('[CACHE-LOADER] Hard refresh - verifying caches are populated...');
        setProgressMessage('Setting up offline mode...');

        // Register service worker if not already registered
        if ('serviceWorker' in navigator) {
          try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            if (registrations.length > 0) {
              setStatus(prev => ({ ...prev, serviceWorker: 'registered' }));
            } else {
              await navigator.serviceWorker.register('/sw.js', { scope: '/' });
              setStatus(prev => ({ ...prev, serviceWorker: 'registered' }));
            }
          } catch (err) {
            setStatus(prev => ({ ...prev, serviceWorker: 'failed' }));
          }
        }

        // Verify all caches are populated (with quick timeout checks)
        let allReady = false;
        const maxAttempts = 25; // ~5 seconds max wait with 200ms intervals
        let attempts = 0;

        while (attempts < maxAttempts && !allReady) {
          const cacheNames = await caches.keys();
          const hasStaticCache = cacheNames.some(name => name.startsWith('iccat-v'));
          const hasDataCache = cacheNames.includes('iccat-data-v7');

          let dataItems = 0;
          let tilesCached = 0;
          let apiEndpointsCached = 0;

          if (hasDataCache) {
            const dataCache = await caches.open('iccat-data-v7');
            const cachedRequests = await dataCache.keys();
            dataItems = cachedRequests.length;

            const apiEndpoints = ['/api/buildings', '/api/walkpaths', '/api/floors', '/api/rooms'];
            const cachedEndpoints = await Promise.all(
              apiEndpoints.map(endpoint => dataCache.match(endpoint).then(response => !!response))
            );
            apiEndpointsCached = cachedEndpoints.filter(Boolean).length;
          }

          if (hasStaticCache) {
            const staticCache = await caches.open('iccat-v7');
            const allCached = await staticCache.keys();
            tilesCached = allCached.filter(req => req.url.includes('tile.openstreetmap.org')).length;
          }

          // Update status
          setStatus(prev => ({
            ...prev,
            staticCache: hasStaticCache ? 'verified' : 'checking',
            dataCache: dataItems > 0 ? 'verified' : 'checking',
            mapTiles: tilesCached > 0 ? 'verified' : 'checking',
            apiEndpoints: apiEndpointsCached === 4 ? 'verified' : 'checking'
          }));

          // Check if all caches are populated
          const allPopulated = hasStaticCache && dataItems > 0 && tilesCached > 0 && apiEndpointsCached === 4;
          if (allPopulated) {
            console.log('[CACHE-LOADER] All caches populated - closing immediately');
            allReady = true;
            break;
          }

          // Wait a bit before rechecking
          await new Promise(resolve => setTimeout(resolve, 200));
          attempts++;
        }

        if (!allReady) {
          console.log('[CACHE-LOADER] Cache verification timeout - proceeding anyway');
        } else {
          console.log('[CACHE-LOADER] Cache verification complete - closing loader');
        }

        setIsComplete(true);
      } catch (err) {
        console.error('[CACHE-LOADER] Verification error:', err);
        setIsComplete(true);
      }
    };

    verifyCache();
  }, []);

  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isComplete, onComplete]);

  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'verified':
      case 'registered':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'checking':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <Loader2 className="w-4 h-4 animate-spin" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-[9999] flex items-center justify-center">
      <div className="space-y-6 max-w-md w-full px-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Preparing App</h2>
          <p className="text-sm text-muted-foreground">
            {progressMessage}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
            <div className="flex items-center gap-3">
              {getStatusIcon(status.serviceWorker)}
              <span className="text-sm">Service Worker</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
            <div className="flex items-center gap-3">
              {getStatusIcon(status.apiEndpoints)}
              <span className="text-sm">API Data</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
            <div className="flex items-center gap-3">
              {getStatusIcon(status.mapTiles)}
              <span className="text-sm">Map Tiles</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
            <div className="flex items-center gap-3">
              {getStatusIcon(status.staticCache)}
              <span className="text-sm">Static Assets</span>
            </div>
          </div>
        </div>

        <div className="pt-2 text-center">
          <p className="text-xs text-muted-foreground">
            {isComplete
              ? 'Ready! Loading app...'
              : 'This ensures offline mode works properly'}
          </p>
        </div>
      </div>
    </div>
  );
}
