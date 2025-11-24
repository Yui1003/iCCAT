import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, AlertCircle, BarChart3, RotateCcw, Wifi, WifiOff, Download } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AnalyticsEventType } from "@shared/analytics-schema";
import { isAnalyticsAvailable } from "@/lib/analytics-tracker";
import { useToast } from "@/hooks/use-toast";

interface AnalyticsSummary {
  eventType: AnalyticsEventType;
  totalCount: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  lastUpdated: number;
}

export default function AdminAnalytics() {
  const [isOnline, setIsOnline] = useState(isAnalyticsAvailable());
  const [resetConfirm, setResetConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  // Listen for online/offline status
  useEffect(() => {
    const updateOnline = () => setIsOnline(isAnalyticsAvailable());
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  const { data: analytics = [], isLoading, refetch } = useQuery<AnalyticsSummary[]>({
    queryKey: ['/api/admin/analytics']
  });

  const handleReset = async () => {
    try {
      const response = await fetch('/api/admin/analytics/reset', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to reset analytics');
      }

      await refetch();
      setResetConfirm(false);
      toast({
        title: "Success",
        description: "Analytics data has been reset"
      });
    } catch (error) {
      console.error('Error resetting analytics:', error);
      toast({
        title: "Error",
        description: "Failed to reset analytics",
        variant: "destructive"
      });
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/admin/analytics/export/${format}`);

      if (!response.ok) {
        throw new Error('Failed to export analytics');
      }

      // Get blob and filename
      const blob = await response.blob();
      const filename = `analytics-export-${Date.now()}.${format}`;

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `Analytics exported as ${format.toUpperCase()}`
      });
    } catch (error) {
      console.error('Error exporting analytics:', error);
      toast({
        title: "Error",
        description: "Failed to export analytics",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const eventTypeLabels: Record<AnalyticsEventType, string> = {
    [AnalyticsEventType.INTERFACE_ACTION]: "Interface Actions",
    [AnalyticsEventType.MAP_LOAD]: "Map Loading",
    [AnalyticsEventType.IMAGE_LOAD]: "Image Loading",
    [AnalyticsEventType.MENU_RENDER]: "Menu Rendering",
    [AnalyticsEventType.ROUTE_GENERATION]: "Route Generation",
    [AnalyticsEventType.NAVIGATION_START]: "Navigation Start",
    [AnalyticsEventType.PAGE_VIEW]: "Page Views"
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-card-border p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link href="/admin-dashboard">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="w-6 h-6" />
              Analytics
            </h1>
            <p className="text-sm text-muted-foreground">Monitor kiosk performance and usage</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Offline Disclaimer */}
        {!isOnline && (
          <Alert className="mb-6 border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
            <WifiOff className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              <strong>Offline Mode:</strong> Analytics data collection is disabled while the kiosk is offline. Data collection will resume when the kiosk reconnects to the network. Ensure accurate research data by maintaining network connectivity.
            </AlertDescription>
          </Alert>
        )}

        {/* Online Status */}
        <div className="mb-6 flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm">
            {isOnline ? (
              <>
                <Wifi className="w-4 h-4 text-green-600" />
                <span className="text-green-600 font-medium">Analytics Active</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-orange-600" />
                <span className="text-orange-600 font-medium">Analytics Paused</span>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mb-6 flex justify-end gap-2 flex-wrap">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              data-testid="button-export-csv"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('json')}
              disabled={isExporting}
              data-testid="button-export-json"
            >
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
          </div>

          {resetConfirm ? (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={handleReset}
                data-testid="button-confirm-reset"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Confirm Reset
              </Button>
              <Button
                variant="outline"
                onClick={() => setResetConfirm(false)}
                data-testid="button-cancel-reset"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setResetConfirm(true)}
              data-testid="button-reset-analytics"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset All Data
            </Button>
          )}
        </div>

        {/* Analytics Cards */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="h-64 animate-pulse bg-muted" />
            ))}
          </div>
        ) : analytics.length === 0 ? (
          <Card className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-medium text-foreground mb-2">No Analytics Data</h3>
            <p className="text-muted-foreground">
              Analytics data will appear here once users start interacting with the kiosk
            </p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {analytics.map((stat) => (
              <Card
                key={stat.eventType}
                className="p-6 hover-elevate active-elevate-2"
                data-testid={`analytics-card-${stat.eventType}`}
              >
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  {eventTypeLabels[stat.eventType]}
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Events:</span>
                    <span className="font-medium text-foreground">{stat.totalCount}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Average Time:</span>
                    <span className="font-medium text-foreground">{formatTime(stat.averageResponseTime)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Min Time:</span>
                    <span className="font-medium text-foreground">{formatTime(stat.minResponseTime)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Max Time:</span>
                    <span className="font-medium text-foreground">{formatTime(stat.maxResponseTime)}</span>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      Last updated: {new Date(stat.lastUpdated).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Info Boxes */}
        <div className="mt-8 space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Metrics Tracked:</strong> This analytics dashboard monitors response times for interface actions, map and image loading, menu rendering, route generation, and navigation start times. All metrics are automatically collected when the kiosk is online.
            </AlertDescription>
          </Alert>

          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
            <Download className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <strong>Data Export:</strong> Use CSV export for spreadsheet analysis or JSON for raw data. All events are tagged with sessionId and timestamp for accurate user session tracking.
            </AlertDescription>
          </Alert>

          <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
            <AlertCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <strong>Session Tracking:</strong> New sessions automatically start on first use or after 15 minutes of inactivity. Each event includes the session ID, allowing you to group data by individual user sessions for detailed analysis.
            </AlertDescription>
          </Alert>
        </div>
      </main>
    </div>
  );
}
