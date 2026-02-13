// Service Worker registration and lifecycle management

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW-REG] Service Workers not supported');
    return null;
  }

  try {
    // Register the service worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    console.log('[SW-REG] Service Worker registered successfully');

    // Force activation of new worker
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;

      newWorker?.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[SW-REG] New Service Worker available - app will update on reload');
          // Optionally show a notification to user that updates are available
        }
      });
    });

    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, 60000); // Check every minute

    return registration;
  } catch (err) {
    console.error('[SW-REG] Service Worker registration failed:', err);
    return null;
  }
}

// Call this on app startup
export function initializeServiceWorkerStack() {
  // Register SW in all environments for kiosk testing, not just production
  registerServiceWorker();
}
