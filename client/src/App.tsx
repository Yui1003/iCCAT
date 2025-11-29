import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OfflineIndicator } from "@/components/offline-indicator";
import { CacheVerificationLoader } from "@/components/cache-verification-loader";
import { useKioskUptime } from "@/lib/use-kiosk-uptime";

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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/navigation" component={Navigation} />
      <Route path="/navigate/:routeId" component={MobileNavigation} />
      <Route path="/events" component={Events} />
      <Route path="/staff" component={StaffDirectory} />
      <Route path="/about" component={About} />
      <Route path="/feedback" component={FeedbackPage} />
      <Route path="/thank-you" component={ThankYouPage} />
      <Route path="/screensaver" component={Screensaver} />
      
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/buildings" component={AdminBuildings} />
      <Route path="/admin/paths" component={AdminPaths} />
      <Route path="/admin/floor-plans" component={AdminFloorPlans} />
      <Route path="/admin/floor-plan-management" component={AdminFloorPlanManagement} />
      <Route path="/admin/room-paths" component={AdminFloorPlanManagement} />
      <Route path="/admin/staff" component={AdminStaff} />
      <Route path="/admin/events" component={AdminEvents} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/analytics" component={AdminAnalytics} />
      
      <Route component={NotFound} />
    </Switch>
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
