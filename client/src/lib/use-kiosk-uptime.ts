// Hook for tracking kiosk uptime
import { useEffect, useRef } from 'react';
import { getOrCreateDeviceId } from './device-id';
import { apiRequest } from './queryClient';

export function useKioskUptime() {
  const deviceIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const requestCountRef = useRef({ total: 0, successful: 0 });

  useEffect(() => {
    // Initialize device ID and start session
    deviceIdRef.current = getOrCreateDeviceId();
    sessionStartRef.current = Date.now();

    console.log('[UPTIME] Kiosk session started with device ID:', deviceIdRef.current);

    // Start the session on server
    const startSession = async () => {
      try {
        await apiRequest('POST', '/api/analytics/kiosk-uptime/start', {
          deviceId: deviceIdRef.current,
        });
        console.log('[UPTIME] Session started on server');
      } catch (err) {
        console.warn('[UPTIME] Failed to start session on server:', err);
      }
    };

    startSession();

    // Send heartbeat every 30 seconds to keep session alive
    const heartbeatInterval = setInterval(async () => {
      if (!deviceIdRef.current) return;

      try {
        const uptimePercentage =
          requestCountRef.current.total > 0
            ? (requestCountRef.current.successful / requestCountRef.current.total) * 100
            : 100;

        await apiRequest('POST', '/api/analytics/kiosk-uptime/heartbeat', {
          deviceId: deviceIdRef.current,
          totalRequests: requestCountRef.current.total,
          successfulRequests: requestCountRef.current.successful,
          uptimePercentage,
        });
      } catch (err) {
        console.warn('[UPTIME] Heartbeat failed:', err);
      }
    }, 30000); // 30 seconds

    // Handle page unload - end the session
    const handleBeforeUnload = async () => {
      if (!deviceIdRef.current) return;

      try {
        const uptimePercentage =
          requestCountRef.current.total > 0
            ? (requestCountRef.current.successful / requestCountRef.current.total) * 100
            : 100;

        await apiRequest('POST', '/api/analytics/kiosk-uptime/end', {
          deviceId: deviceIdRef.current,
          totalRequests: requestCountRef.current.total,
          successfulRequests: requestCountRef.current.successful,
          uptimePercentage,
        });
        console.log('[UPTIME] Session ended on server');
      } catch (err) {
        console.warn('[UPTIME] Failed to end session:', err);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Hook to track requests globally
  return {
    recordRequest: (successful: boolean) => {
      requestCountRef.current.total++;
      if (successful) {
        requestCountRef.current.successful++;
      }
    },
  };
}
