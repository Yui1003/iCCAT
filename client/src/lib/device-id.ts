// Device ID generation and retrieval for kiosk identification
// Now IP-based for consistent kiosk device tracking across browser sessions
const DEVICE_ID_KEY = 'iccat-device-id';
let cachedDeviceId: string | null = null;

export async function getOrCreateDeviceId(): Promise<string> {
  // Return cached device ID if available
  if (cachedDeviceId) {
    console.log('[DEVICE-ID] Using cached device ID:', cachedDeviceId);
    return cachedDeviceId;
  }

  try {
    // Fetch IP address from backend (this identifies the physical kiosk device)
    const response = await fetch('/api/get-device-ip');
    if (response.ok) {
      const data = await response.json();
      const ipBasedId = data.ip || 'unknown-device';
      cachedDeviceId = ipBasedId;
      console.log('[DEVICE-ID] Using IP-based device ID:', ipBasedId);
      return ipBasedId;
    }
  } catch (err) {
    console.warn('[DEVICE-ID] Failed to fetch IP:', err);
  }

  // Fallback to localStorage for offline mode or if fetch fails
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      cachedDeviceId = existing;
      console.log('[DEVICE-ID] Using fallback localStorage device ID:', existing);
      return existing;
    }

    // Generate fallback device ID
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const fallbackId = `fallback-${timestamp}-${random}`;
    localStorage.setItem(DEVICE_ID_KEY, fallbackId);
    cachedDeviceId = fallbackId;
    console.log('[DEVICE-ID] Generated fallback device ID:', fallbackId);
    return fallbackId;
  } catch (err) {
    console.warn('[DEVICE-ID] localStorage not available:', err);
    const tempId = `temp-${Date.now()}`;
    cachedDeviceId = tempId;
    return tempId;
  }
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
