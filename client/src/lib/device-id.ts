// Device ID generation and retrieval for kiosk identification
// Uses browser-specific localStorage ID for accurate per-device tracking
// This ensures each browser on each device gets its own unique identifier
const DEVICE_ID_KEY = 'iccat-device-id';
let cachedDeviceId: string | null = null;

function generateUniqueDeviceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const browserInfo = navigator.userAgent.slice(0, 10).replace(/[^a-zA-Z0-9]/g, '');
  return `device-${browserInfo}-${timestamp}-${random}`;
}

export async function getOrCreateDeviceId(): Promise<string> {
  // Return cached device ID if available (same session)
  if (cachedDeviceId) {
    console.log('[DEVICE-ID] Using cached device ID:', cachedDeviceId);
    return cachedDeviceId;
  }

  // PRIORITY 1: Use localStorage-based unique device ID
  // This ensures each browser on each device gets its own unique identifier
  // Works correctly even when multiple devices share the same WiFi/IP
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      cachedDeviceId = existing;
      console.log('[DEVICE-ID] Using localStorage device ID:', existing);
      return existing;
    }

    // Generate new unique device ID and persist it
    const newDeviceId = generateUniqueDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, newDeviceId);
    cachedDeviceId = newDeviceId;
    console.log('[DEVICE-ID] Generated new device ID:', newDeviceId);
    return newDeviceId;
  } catch (err) {
    console.warn('[DEVICE-ID] localStorage not available:', err);
  }

  // FALLBACK: If localStorage fails, use IP address + random suffix
  // This provides some uniqueness even in restricted environments
  try {
    const response = await fetch('/api/get-device-ip');
    if (response.ok) {
      const data = await response.json();
      const ip = data.ip || 'unknown';
      const random = Math.random().toString(36).substring(2, 8);
      const fallbackId = `${ip}-${random}`;
      cachedDeviceId = fallbackId;
      console.log('[DEVICE-ID] Using IP-based fallback device ID:', fallbackId);
      return fallbackId;
    }
  } catch (err) {
    console.warn('[DEVICE-ID] Failed to fetch IP for fallback:', err);
  }

  // LAST RESORT: Generate temporary ID for this session only
  const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  cachedDeviceId = tempId;
  console.log('[DEVICE-ID] Using temporary session ID:', tempId);
  return tempId;
}

export function getDeviceId(): string | null {
  return cachedDeviceId;
}

export function clearDeviceId(): void {
  cachedDeviceId = null;
  try {
    localStorage.removeItem(DEVICE_ID_KEY);
    console.log('[DEVICE-ID] Device ID cleared');
  } catch (err) {
    console.warn('[DEVICE-ID] Failed to clear device ID:', err);
  }
}
