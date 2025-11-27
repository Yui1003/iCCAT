import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeServiceWorkerStack } from "./lib/service-worker-registration";
import { initializeFirebaseOffline } from "./lib/firebase-client";
import { initializeFirebaseListeners } from "./lib/firebase-listeners";
import { prefetchAllData } from "./lib/data-prefetcher";

// Initialize offline capabilities on app startup
initializeServiceWorkerStack();
initializeFirebaseOffline();

// Initialize Firebase real-time listeners (replaces polling)
initializeFirebaseListeners();

// Prefetch all data to populate React Query cache
prefetchAllData().catch(err => {
  console.error('[STARTUP] Failed to prefetch data:', err);
});

createRoot(document.getElementById("root")!).render(<App />);
