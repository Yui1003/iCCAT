import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeServiceWorkerStack } from "./lib/service-worker-registration";
import { initializeFirebaseOffline } from "./lib/firebase-client";

// Initialize offline capabilities on app startup
initializeServiceWorkerStack();
initializeFirebaseOffline();

createRoot(document.getElementById("root")!).render(<App />);
