import { useState, useEffect } from 'react';

export function useOfflineDetection() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      console.log('[OFFLINE] Connection restored - back online');
      setIsOffline(false);
    };

    const handleOffline = () => {
      console.log('[OFFLINE] Connection lost - now offline');
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOffline;
}
