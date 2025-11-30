// Hook for tracking kiosk uptime
import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { getOrCreateDeviceId } from './device-id';
import { apiRequest, requestCounter } from './queryClient';

// Detect if user is on a mobile device (phone or tablet)
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  
  // Check for common mobile keywords
  const mobileKeywords = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
  
  // Also check for touch capability combined with small screen (tablets and phones)
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 1024; // Tablets are usually <= 1024px
  
  return mobileKeywords.test(userAgent) || (isTouchDevice && isSmallScreen);
}

export function useKioskUptime() {
  const deviceIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const sessionInitializedRef = useRef<boolean>(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPageVisibleRef = useRef<boolean>(!document.hidden);
  const isScreensaverActiveRef = useRef<boolean>(false);
  const [location] = useLocation();

  useEffect(() => {
    // Don't track heartbeats on admin pages or mobile navigation - only track kiosk pages
    const isAdminPage = location?.startsWith('/admin/');
    const isMobileNavigation = location?.startsWith('/navigate/');
    const isMobile = isMobileDevice();
    
    if (isAdminPage) {
      console.log('[UPTIME] Admin page detected - skipping kiosk heartbeat tracking');
      return;
    }
    if (isMobileNavigation) {
      console.log('[UPTIME] Mobile navigation detected - skipping kiosk heartbeat tracking');
      return;
    }
    if (isMobile) {
      console.log('[UPTIME] Mobile device detected - skipping kiosk uptime tracking (phones/tablets are not kiosks)');
      return;
    }

    // Initialize session only once (on first mount)
    const initializeSession = async () => {
      if (sessionInitializedRef.current) {
        console.log('[UPTIME] Session already initialized');
        return;
      }
      
      try {
        // Get device ID (IP-based for consistent kiosk identification)
        deviceIdRef.current = await getOrCreateDeviceId();
        console.log('[UPTIME] Kiosk session started with device ID:', deviceIdRef.current);

        // Start the session on server
        await apiRequest('POST', '/api/analytics/kiosk-uptime/start', {
          deviceId: deviceIdRef.current,
        });
        console.log('[UPTIME] Session started on server');
        
        sessionStartRef.current = Date.now();
        sessionInitializedRef.current = true;
        
        // Send initial heartbeat immediately after session starts
        sendHeartbeat();
      } catch (err) {
        console.warn('[UPTIME] Failed to initialize session:', err);
      }
    };

    // Send heartbeat with current status (active or standby based on page visibility or screensaver)
    const sendHeartbeat = async () => {
      if (!deviceIdRef.current) return;

      try {
        const uptimePercentage =
          requestCounter.total > 0
            ? (requestCounter.successful / requestCounter.total) * 100
            : 100;

        // Determine status: 'standby' if screensaver active or page hidden, otherwise 'active'
        const status = isScreensaverActiveRef.current || !isPageVisibleRef.current ? 'standby' : 'active';

        console.log('[UPTIME] Heartbeat:', {
          status,
          screensaverActive: isScreensaverActiveRef.current,
          pageVisible: isPageVisibleRef.current,
          total: requestCounter.total,
          successful: requestCounter.successful,
          uptime: uptimePercentage.toFixed(1) + '%'
        });

        await apiRequest('POST', '/api/analytics/kiosk-uptime/heartbeat', {
          deviceId: deviceIdRef.current,
          status,
          totalRequests: requestCounter.total,
          successfulRequests: requestCounter.successful,
          uptimePercentage,
        });
      } catch (err) {
        console.warn('[UPTIME] Heartbeat failed:', err);
      }
    };

    // Handle visibility changes (tab switch, etc.)
    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;
      if (isPageVisibleRef.current) {
        console.log('[UPTIME] Page visible again - status: active');
      } else {
        console.log('[UPTIME] Page hidden - status: standby');
      }
      sendHeartbeat();
    };

    // Handle screensaver state changes
    const handleScreensaverChange = (event: CustomEvent<boolean>) => {
      isScreensaverActiveRef.current = event.detail;
      const statusMsg = event.detail ? 'standby (screensaver active)' : 'active (screensaver closed)';
      console.log('[UPTIME] Screensaver status changed - new status:', statusMsg);
      sendHeartbeat();
    };

    // Handle page unload - end the session (mark as inactive)
    const handleBeforeUnload = () => {
      if (!deviceIdRef.current) return;

      const uptimePercentage =
        requestCounter.total > 0
          ? (requestCounter.successful / requestCounter.total) * 100
          : 100;

      const payload = JSON.stringify({
        deviceId: deviceIdRef.current,
        status: 'inactive',
        totalRequests: requestCounter.total,
        successfulRequests: requestCounter.successful,
        uptimePercentage,
      });

      // Use sendBeacon for reliable delivery during page unload
      const success = navigator.sendBeacon('/api/analytics/kiosk-uptime/end', 
        new Blob([payload], { type: 'application/json' })
      );
      
      if (success) {
        console.log('[UPTIME] Session end sent via sendBeacon - status: inactive');
      } else {
        console.warn('[UPTIME] sendBeacon failed, session may not end properly');
      }
    };

    const handlePageHide = () => {
      handleBeforeUnload();
    };

    // Initialize session if not already done
    initializeSession();

    // ALWAYS set up heartbeat interval (this was the bug - early return prevented this)
    // Clear any existing interval first
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    // Send heartbeat every 30 seconds - continues even during standby mode
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 30000);
    console.log('[UPTIME] Heartbeat interval started (every 30 seconds)');

    // Set up event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [location]);
}
