// Hook for tracking kiosk uptime
import { useEffect, useRef } from 'react';
import { getOrCreateDeviceId } from './device-id';
import { apiRequest, requestCounter } from './queryClient';

export function useKioskUptime() {
  const deviceIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  useEffect(() => {
    // Initialize device ID and start session
    sessionStartRef.current = Date.now();

    const initializeSession = async () => {
      try {
        // Get device ID (IP-based for consistent kiosk identification)
        deviceIdRef.current = await getOrCreateDeviceId();
        console.log('[UPTIME] Kiosk session started with device ID:', deviceIdRef.current);

        // Start the session on server
        await apiRequest('POST', '/api/analytics/kiosk-uptime/start', {
          deviceId: deviceIdRef.current,
        });
        console.log('[UPTIME] Session started on server');
      } catch (err) {
        console.warn('[UPTIME] Failed to initialize session:', err);
      }
    };

    initializeSession();

    // Send heartbeat every 30 seconds to keep session alive
    const heartbeatInterval = setInterval(async () => {
      if (!deviceIdRef.current) return;

      try {
        const uptimePercentage =
          requestCounter.total > 0
            ? (requestCounter.successful / requestCounter.total) * 100
            : 100;

        console.log('[UPTIME] Heartbeat:', {
          total: requestCounter.total,
          successful: requestCounter.successful,
          uptime: uptimePercentage.toFixed(1) + '%'
        });

        await apiRequest('POST', '/api/analytics/kiosk-uptime/heartbeat', {
          deviceId: deviceIdRef.current,
          totalRequests: requestCounter.total,
          successfulRequests: requestCounter.successful,
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
          requestCounter.total > 0
            ? (requestCounter.successful / requestCounter.total) * 100
            : 100;

        await apiRequest('POST', '/api/analytics/kiosk-uptime/end', {
          deviceId: deviceIdRef.current,
          totalRequests: requestCounter.total,
          successfulRequests: requestCounter.successful,
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
}
