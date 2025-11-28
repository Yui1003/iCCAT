// Hook for tracking kiosk uptime
import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { getOrCreateDeviceId } from './device-id';
import { apiRequest, requestCounter } from './queryClient';

export function useKioskUptime() {
  const deviceIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const sessionInitializedRef = useRef<boolean>(false); // Track if session is already initialized
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPageVisibleRef = useRef<boolean>(!document.hidden);
  const [location] = useLocation();

  useEffect(() => {
    // Don't track heartbeats on admin pages - only track user-facing pages (kiosk usage)
    const isAdminPage = location?.startsWith('/admin/');
    if (isAdminPage) {
      console.log('[UPTIME] Admin page detected - skipping kiosk heartbeat tracking');
      return;
    }

    // Only initialize session once (on first mount)
    if (sessionInitializedRef.current) {
      console.log('[UPTIME] Session already initialized, skipping re-initialization');
      return;
    }

    // Initialize device ID and start session
    sessionStartRef.current = Date.now();
    sessionInitializedRef.current = true;

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

    // Send heartbeat every 30 seconds to keep session alive (but only when page is visible)
    const sendHeartbeat = async () => {
      if (!deviceIdRef.current || !isPageVisibleRef.current) return;

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
    };

    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 30000); // 30 seconds

    // Handle visibility changes (screensaver, tab switch, etc.)
    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;
      if (isPageVisibleRef.current) {
        console.log('[UPTIME] Page visible again - resuming heartbeats');
        // Send heartbeat immediately when page becomes visible
        sendHeartbeat();
      } else {
        console.log('[UPTIME] Page hidden - pausing heartbeats');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

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
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [location]);
}
