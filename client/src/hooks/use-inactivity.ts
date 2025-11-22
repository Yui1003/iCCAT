import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

/**
 * Hook for global inactivity timeout
 * Used on Navigation, Events, Staff, and About pages
 * Redirects to home page after configured timeout (default 3 minutes)
 * Timeout can be configured by admin via /api/settings/global_inactivity_timeout
 */
export function useGlobalInactivity() {
  const [, setLocation] = useLocation();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [inactivityTimeout, setInactivityTimeout] = useState<number>(180000); // Default 3 minutes (180 seconds)

  // Fetch configured timeout from settings
  useEffect(() => {
    fetch('/api/settings/global_inactivity_timeout')
      .then(res => {
        if (res.ok) {
          return res.json();
        }
        return null;
      })
      .then(setting => {
        if (setting && setting.value) {
          // Value is stored in seconds, convert to milliseconds
          const timeoutMs = parseInt(setting.value, 10) * 1000;
          if (!isNaN(timeoutMs) && timeoutMs > 0) {
            setInactivityTimeout(timeoutMs);
          }
        }
      })
      .catch(() => {
        // If fetch fails, use default timeout
      });
  }, []);

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setLocation("/");
    }, inactivityTimeout);
  };

  useEffect(() => {
    // Set up event listeners for user activity
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];

    events.forEach((event) => {
      document.addEventListener(event, resetTimer);
    });

    // Start the initial timer
    resetTimer();

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach((event) => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [inactivityTimeout]);
}

/**
 * Hook for home page inactivity timeout
 * Used only on the home/landing page
 * Redirects to screensaver after configured timeout (default 30 seconds)
 * Timeout can be configured by admin via /api/settings/home_inactivity_timeout
 */
export function useHomeInactivity() {
  const [, setLocation] = useLocation();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [inactivityTimeout, setInactivityTimeout] = useState<number>(30000); // Default 30 seconds

  // Fetch configured timeout from settings
  useEffect(() => {
    fetch('/api/settings/home_inactivity_timeout')
      .then(res => {
        if (res.ok) {
          return res.json();
        }
        return null;
      })
      .then(setting => {
        if (setting && setting.value) {
          // Value is stored in seconds, convert to milliseconds
          const timeoutMs = parseInt(setting.value, 10) * 1000;
          if (!isNaN(timeoutMs) && timeoutMs > 0) {
            setInactivityTimeout(timeoutMs);
          }
        }
      })
      .catch(() => {
        // If fetch fails, use default timeout
      });
  }, []);

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setLocation("/screensaver");
    }, inactivityTimeout);
  };

  useEffect(() => {
    // Set up event listeners for user activity
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];

    events.forEach((event) => {
      document.addEventListener(event, resetTimer);
    });

    // Start the initial timer
    resetTimer();

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach((event) => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [inactivityTimeout]);
}
