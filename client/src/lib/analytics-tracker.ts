import { AnalyticsEventType } from "@shared/analytics-schema";

interface PendingEvent {
  eventType: AnalyticsEventType;
  responseTime: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

// In-memory queue for offline events
let eventQueue: PendingEvent[] = [];
let isOnline = navigator.onLine;

// Listen for online/offline status
window.addEventListener('online', () => {
  isOnline = true;
  flushEvents();
});

window.addEventListener('offline', () => {
  isOnline = false;
});

/**
 * Track an analytics event (response time measurement)
 */
export function trackEvent(
  eventType: AnalyticsEventType,
  responseTimeMs: number,
  metadata?: Record<string, any>
): void {
  const event: PendingEvent = {
    eventType,
    responseTime: responseTimeMs,
    timestamp: Date.now(),
    metadata
  };

  if (isOnline) {
    sendEvent(event);
  } else {
    // Queue locally when offline
    eventQueue.push(event);
  }
}

/**
 * Measure response time of a function/operation
 */
export async function measurePerformance<T>(
  eventType: AnalyticsEventType,
  fn: () => T | Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await Promise.resolve(fn());
    const duration = performance.now() - start;
    trackEvent(eventType, duration, metadata);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    trackEvent(eventType, duration, { ...metadata, error: true });
    throw error;
  }
}

/**
 * Send single event to backend
 */
function sendEvent(event: PendingEvent): void {
  if (!isOnline) return;

  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  }).catch((error) => {
    console.debug('[Analytics] Failed to send event:', error);
    // Queue event if send fails
    eventQueue.push(event);
  });
}

/**
 * Flush all queued events when coming back online
 */
export async function flushEvents(): Promise<void> {
  if (!isOnline || eventQueue.length === 0) return;

  const events = [...eventQueue];
  eventQueue = [];

  for (const event of events) {
    sendEvent(event);
  }
}

/**
 * Check if analytics is available (online)
 */
export function isAnalyticsAvailable(): boolean {
  return isOnline;
}

/**
 * Get current queue size (for debugging)
 */
export function getPendingEventCount(): number {
  return eventQueue.length;
}
