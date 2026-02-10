import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OfflineIndicator } from "@/components/offline-indicator";
import { CacheVerificationLoader } from "@/components/cache-verification-loader";
import { useKioskUptime } from "@/lib/use-kiosk-uptime";
import { motion, AnimatePresence } from "framer-motion";

import Landing from "@/pages/landing";
import Navigation from "@/pages/navigation";
import MobileNavigation from "@/pages/mobile-navigation";
import Events from "@/pages/events";
import StaffDirectory from "@/pages/staff";
import About from "@/pages/about";
import Screensaver from "@/pages/screensaver";
import FeedbackPage from "@/pages/feedback";
import ThankYouPage from "@/pages/thank-you";

import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminBuildings from "@/pages/admin-buildings";
import AdminPaths from "@/pages/admin-paths";
import AdminFloorPlans from "@/pages/admin-floor-plans";
import AdminStaff from "@/pages/admin-staff";
import AdminEvents from "@/pages/admin-events";
import AdminSettings from "@/pages/admin-settings";
import AdminAnalytics from "@/pages/admin-analytics";
import AdminFloorPlanManagement from "@/pages/admin-floor-plan-management";

import NotFound from "@/pages/not-found";

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}

function Router() {
  const [location] = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Switch location={location} key={location}>
        <Route path="/">
          <PageTransition><Landing /></PageTransition>
        </Route>
        <Route path="/navigation">
          <PageTransition><Navigation /></PageTransition>
        </Route>
        <Route path="/navigate/:routeId">
          {(params) => <PageTransition><MobileNavigation /></PageTransition>}
        </Route>
        <Route path="/events">
          <PageTransition><Events /></PageTransition>
        </Route>
        <Route path="/staff">
          <PageTransition><StaffDirectory /></PageTransition>
        </Route>
        <Route path="/about">
          <PageTransition><About /></PageTransition>
        </Route>
        <Route path="/feedback">
          <PageTransition><FeedbackPage /></PageTransition>
        </Route>
        <Route path="/thank-you">
          <PageTransition><ThankYouPage /></PageTransition>
        </Route>
        <Route path="/screensaver">
          <PageTransition><Screensaver /></PageTransition>
        </Route>
        
        <Route path="/admin/login">
          <AdminLogin />
        </Route>
        <Route path="/admin/dashboard">
          <AdminDashboard />
        </Route>
        <Route path="/admin/buildings">
          <AdminBuildings />
        </Route>
        <Route path="/admin/paths">
          <AdminPaths />
        </Route>
        <Route path="/admin/floor-plans">
          <AdminFloorPlans />
        </Route>
        <Route path="/admin/floor-plan-management">
          <AdminFloorPlanManagement />
        </Route>
        <Route path="/admin/room-paths">
          <AdminFloorPlanManagement />
        </Route>
        <Route path="/admin/staff">
          <AdminStaff />
        </Route>
        <Route path="/admin/events">
          <AdminEvents />
        </Route>
        <Route path="/admin/settings">
          <AdminSettings />
        </Route>
        <Route path="/admin/analytics">
          <AdminAnalytics />
        </Route>
        
        <Route>
          <PageTransition><NotFound /></PageTransition>
        </Route>
      </Switch>
    </AnimatePresence>
  );
}

function AppContent() {
  const [cacheReady, setCacheReady] = useState(false);
  const [location] = useLocation();
  useKioskUptime(); // Start tracking kiosk uptime

  // Disable context menu (right-click and long-press) globally
  useEffect(() => {
    const disableContextMenu = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // Prevent right-click context menu on desktop
    document.addEventListener('contextmenu', disableContextMenu, { passive: false });

    // Prevent long-press context menu on mobile/touch devices
    // Some browsers fire contextmenu on long-press, but we also handle touchend with timer
    let touchStartTime = 0;
    const handleTouchStart = () => {
      touchStartTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchDuration = Date.now() - touchStartTime;
      // If touch was held for more than 500ms (long-press), prevent default
      if (touchDuration > 500) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('contextmenu', disableContextMenu);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Check if current route is an admin route
  const isAdminRoute = location?.startsWith('/admin/');

  // For admin routes, skip cache verification - just show router immediately
  if (isAdminRoute) {
    console.log('[APP] Admin route detected:', location, '- skipping cache verification');
    return (
      <>
        <Toaster />
        <OfflineIndicator />
        <Router />
      </>
    );
  }

  const handleCacheComplete = () => {
    console.log('[APP] Cache verification complete - showing router');
    setCacheReady(true);
  };

  return (
    <>
      <Toaster />
      <OfflineIndicator />
      {!cacheReady && <CacheVerificationLoader onComplete={handleCacheComplete} />}
      {cacheReady && <Router />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
