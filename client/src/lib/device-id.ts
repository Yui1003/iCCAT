// Device ID generation and retrieval for kiosk identification
const DEVICE_ID_KEY = 'iccat-device-id';

export function generateDeviceId(): string {
  // Format: iccat-kiosk-{timestamp}-{random}
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `iccat-kiosk-${timestamp}-${random}`;
}

export function getOrCreateDeviceId(): string {
  try {
    // Try to retrieve existing device ID from localStorage
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      console.log('[DEVICE-ID] Using existing device ID:', existing);
      return existing;
    }

    // Generate new device ID for this kiosk
    const newId = generateDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, newId);
    console.log('[DEVICE-ID] Generated new device ID:', newId);
    return newId;
  } catch (err) {
    console.warn('[DEVICE-ID] localStorage not available, generating temporary ID:', err);
    // Fallback if localStorage is unavailable (shouldn't happen on modern browsers)
    return generateDeviceId();
  }
}

export function getDeviceId(): string | null {
  try {
    return localStorage.getItem(DEVICE_ID_KEY);
  } catch (err) {
    console.warn('[DEVICE-ID] Unable to access localStorage:', err);
    return null;
  }
}

export function clearDeviceId(): void {
  try {
    localStorage.removeItem(DEVICE_ID_KEY);
    console.log('[DEVICE-ID] Device ID cleared');
  } catch (err) {
    console.warn('[DEVICE-ID] Failed to clear device ID:', err);
  }
}
