import { useEffect } from "react";
import { useLocation } from "wouter";
import { Check, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ThankYouPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    // Prevent browser back button from navigating away
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      // Stay on this page
      window.history.pushState(null, "", window.location.href);
    };

    window.addEventListener("popstate", handlePopState);
    window.history.pushState(null, "", window.location.href);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleReturnToKiosk = () => {
    // Navigate back to landing page
    navigate("/");
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 p-4">
      <Card className="p-8 max-w-md w-full text-center bg-white dark:bg-slate-900">
        <div className="mb-6">
          <Check className="w-16 h-16 mx-auto text-green-500 dark:text-green-400" />
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-2">Thank You!</h1>
        
        <p className="text-lg text-muted-foreground mb-6">
          Thank you for using the kiosk. Your session has been completed successfully.
        </p>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
          <div className="flex gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-900 dark:text-blue-100">
              To navigate again, please return to the physical kiosk and start a new session.
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-6 text-center">
          This session is complete. Please do not navigate away from this page.
        </p>
      </Card>
    </div>
  );
}
