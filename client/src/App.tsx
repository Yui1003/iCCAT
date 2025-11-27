import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OfflineIndicator } from "@/components/offline-indicator";
import { CacheVerificationLoader } from "@/components/cache-verification-loader";

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

function App() {
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      // Give cache verification time to complete
      await new Promise(resolve => setTimeout(resolve, 1500));
      setCacheReady(true);
    };

    initApp();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <OfflineIndicator />
        {!cacheReady && <CacheVerificationLoader />}
        {cacheReady && <Router />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
