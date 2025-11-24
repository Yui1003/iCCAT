import { trackEvent } from "./analytics-tracker";
import { AnalyticsEventType } from "@shared/analytics-schema";

/**
 * Session Manager - Detects when users change and tracks sessions
 * 
 * Triggers new session when:
 * - App loads (first user)
 * - Idle timeout exceeded (15 minutes = different user)
 * - Admin manually ends session
 */

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
let currentSessionId: string | null = null;
let lastActivityTime = Date.now();
let idleTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Initialize session tracking
 */
export function initializeSessionTracking(): void {
  startNewSession('app_load');
  setupActivityListeners();
}

/**
 * Start a new session (user changed or first load)
 */
export function startNewSession(reason: string): string {
  // End previous session if exists
  if (currentSessionId) {
    endCurrentSession();
  }

  // Generate new session ID
  currentSessionId = generateSessionId();
  lastActivityTime = Date.now();

  // Track session start
  trackEvent(AnalyticsEventType.SESSION_START, 0, {
    sessionId: currentSessionId,
    reason: reason
  });

  console.log(`[Session] New session started: ${currentSessionId} (${reason})`);
  return currentSessionId;
}

/**
 * End current session
 */
export function endCurrentSession(reason: string = 'session_end'): void {
  if (!currentSessionId) return;

  trackEvent(AnalyticsEventType.SESSION_END, 0, {
    sessionId: currentSessionId,
    reason: reason,
    duration: Date.now() - lastActivityTime
  });

  console.log(`[Session] Session ended: ${currentSessionId} (${reason})`);
  currentSessionId = null;
  clearIdleTimer();
}

/**
 * Get current session ID
 */
export function getCurrentSessionId(): string {
  if (!currentSessionId) {
    startNewSession('orphaned_event');
  }
  return currentSessionId!;
}

/**
 * Update last activity time (called on user interaction)
 */
export function recordActivity(): void {
  const now = Date.now();
  const timeSinceLastActivity = now - lastActivityTime;

  // If idle timeout exceeded, start new session
  if (timeSinceLastActivity > IDLE_TIMEOUT_MS) {
    console.log(`[Session] Idle timeout detected (${Math.round(timeSinceLastActivity / 1000)}s)`);
    startNewSession('idle_timeout');
  }

  lastActivityTime = now;
  resetIdleTimer();
}

/**
 * Generate UUID for session
 */
function generateSessionId(): string {
  // Crypto not available in browser, use random approach
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Setup activity listeners to detect idle
 */
function setupActivityListeners(): void {
  const events = ['click', 'touch', 'keydown', 'scroll', 'mousemove', 'pointerdown'];
  
  events.forEach(event => {
    document.addEventListener(event, recordActivity, { passive: true });
  });

  // Stop recording on page unload
  window.addEventListener('beforeunload', () => {
    endCurrentSession('page_unload');
  });
}

/**
 * Reset idle timeout
 */
function resetIdleTimer(): void {
  clearIdleTimer();
  
  idleTimer = setTimeout(() => {
    console.log('[Session] Idle timeout - waiting for next activity');
  }, IDLE_TIMEOUT_MS);
}

/**
 * Clear idle timer
 */
function clearIdleTimer(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

/**
 * Get session duration in seconds
 */
export function getSessionDuration(): number {
  if (!currentSessionId) return 0;
  return Math.round((Date.now() - lastActivityTime) / 1000);
}
