import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeServiceWorkerStack } from "./lib/service-worker-registration";
import { initializeFirebaseOffline } from "./lib/firebase-client";
import { initializeFirebaseListeners } from "./lib/firebase-listeners";

// Initialize offline capabilities on app startup
initializeServiceWorkerStack();
initializeFirebaseOffline();

// Initialize Firebase real-time listeners (replaces polling)
initializeFirebaseListeners();

createRoot(document.getElementById("root")!).render(<App />);
