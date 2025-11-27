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
          console.log('[CACHE-LOADER] Normal refresh - caches exist, skipping verification');
          setIsComplete(true);
          return;
        }
        
        console.log('[CACHE-LOADER] Hard refresh - waiting for fresh data to cache...');
        setProgressMessage('Fetching fresh data from server...');
        
        const maxWaitTime = 30000;
        const checkInterval = 200;
        let elapsedTime = 0;
        let swInstallComplete = false;

        while (elapsedTime < maxWaitTime && !swInstallComplete) {
          const swInstalled = localStorage.getItem('sw_install_complete') === 'true';
          if (swInstalled) {
            console.log('[CACHE-LOADER] Service Worker install complete');
            swInstallComplete = true;
            break;
          }
          
          if (elapsedTime % 2000 === 0) {
            setProgressMessage(`Loading... ${Math.round(elapsedTime / 1000)}s`);
          }
          
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          elapsedTime += checkInterval;
        }

        if (!swInstallComplete) {
          console.warn('[CACHE-LOADER] Timeout waiting for SW - proceeding anyway');
        }

        setProgressMessage('Verifying cached data...');

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

        if (window.caches) {
          const cacheNames = await caches.keys();
          const hasStaticCache = cacheNames.some(name => name.startsWith('iccat-v'));
          setStatus(prev => ({
            ...prev,
            staticCache: hasStaticCache ? 'verified' : 'failed'
          }));
        }

        if (window.caches) {
          const dataCache = await caches.open('iccat-data-v7');
          const cachedRequests = await dataCache.keys();
          setStatus(prev => ({
            ...prev,
            dataCache: cachedRequests.length > 0 ? 'verified' : 'failed'
          }));
          console.log(`[CACHE-LOADER] Data cache: ${cachedRequests.length} items`);
        }

        if (window.caches) {
          const staticCache = await caches.open('iccat-v7');
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

        if (window.caches) {
          const dataCache = await caches.open('iccat-data-v7');
          const apiEndpoints = [
            '/api/buildings',
            '/api/walkpaths',
            '/api/floors',
            '/api/rooms'
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
        }

        setIsComplete(true);
        console.log('[CACHE-LOADER] Verification complete - app ready!');
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
