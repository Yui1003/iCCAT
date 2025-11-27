import { useState, useEffect } from 'react';

export function useOfflineDetection() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    // Check actual network connectivity by trying to fetch
    async function checkConnectivity() {
      try {
        // Use a lightweight HEAD request to check connectivity
        const response = await fetch('/ping', { 
          method: 'HEAD',
          cache: 'no-store'
        }).catch(() => {
          // Network request failed
          return null;
        });
        
        if (response === null) {
          // Fetch failed - we're offline
          console.log('[OFFLINE] Network check failed - marking offline');
          setIsOffline(true);
        } else if (response.ok || response.status === 404) {
          // Server responded (even with 404) means we're online
          console.log('[OFFLINE] Network check successful - back online');
          setIsOffline(false);
        }
      } catch (error) {
        console.log('[OFFLINE] Network check error - marking offline:', error);
        setIsOffline(true);
      }
    }

    const handleOnline = () => {
      console.log('[OFFLINE] online event fired - checking connectivity');
      checkConnectivity();
    };

    const handleOffline = () => {
      console.log('[OFFLINE] offline event fired - now offline');
      setIsOffline(true);
    };

    // Listen to online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also check connectivity every 5 seconds to catch network interruptions
    // that navigator.onLine might miss
    const connectivityInterval = setInterval(() => {
      checkConnectivity();
    }, 5000);

    // Initial check
    checkConnectivity();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(connectivityInterval);
    };
  }, []);

  return isOffline;
}
