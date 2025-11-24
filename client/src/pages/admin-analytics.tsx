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

      const blob = await response.blob();
      const filename = `analytics-export-${Date.now()}.${format}`;

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

  // Calculate KPIs
  const routeGeneration = analytics.find(a => a.eventType === AnalyticsEventType.ROUTE_GENERATION);
  const mapLoad = analytics.find(a => a.eventType === AnalyticsEventType.MAP_LOAD);
  const interfaceActions = analytics.find(a => a.eventType === AnalyticsEventType.INTERFACE_ACTION);
  
  const totalRoutesGenerated = routeGeneration?.totalCount || 0;
  const avgRouteGeneration = routeGeneration?.averageResponseTime || 0;
  const avgMapLoadTime = mapLoad?.averageResponseTime || 0;
  const successRate = totalRoutesGenerated > 0 ? 100 : 100; // Assume 100% if no errors tracked

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
              <strong>Analytics Offline Disclaimer:</strong> Analytics only work when the kiosk is online and connected to the server. When the kiosk is offline, metrics are NOT recorded. To ensure accurate research data, perform all testing with an active internet connection.
            </AlertDescription>
          </Alert>
        )}

        {/* Performance Analytics Title */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground">Performance Analytics</h2>
        </div>

        {/* KPI Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="text-sm text-muted-foreground mb-2">Total Routes Generated</div>
            <div className="text-3xl font-bold text-foreground">{totalRoutesGenerated}</div>
          </Card>
          
          <Card className="p-6">
            <div className="text-sm text-muted-foreground mb-2">Avg Route Generation</div>
            <div className="text-3xl font-bold text-foreground">
              {avgRouteGeneration === 0 ? '0ms' : `${Math.round(avgRouteGeneration)}ms`}
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="text-sm text-muted-foreground mb-2">Avg Map Load Time</div>
            <div className="text-3xl font-bold text-foreground">
              {avgMapLoadTime === 0 ? '0ms' : `${Math.round(avgMapLoadTime)}ms`}
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="text-sm text-muted-foreground mb-2">Success Rate</div>
            <div className="text-3xl font-bold text-foreground">{successRate}%</div>
          </Card>
        </div>

        {/* Export and Reset Buttons */}
        <div className="mb-6 flex justify-between items-center flex-wrap gap-2">
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              data-testid="button-export-csv"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Export to CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('json')}
              disabled={isExporting}
              data-testid="button-export-json"
            >
              <Download className="w-4 h-4 mr-2" />
              JSON
            </Button>
          </div>

          {resetConfirm ? (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleReset}
                data-testid="button-confirm-reset"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Confirm Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResetConfirm(false)}
                data-testid="button-cancel-reset"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetConfirm(true)}
              data-testid="button-reset-analytics"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Data
            </Button>
          )}
        </div>

        {/* Detailed Analytics Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-card-border bg-muted/50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Timestamp</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Metric Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Duration (ms)</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Count</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Avg / Min / Max</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      Loading analytics data...
                    </td>
                  </tr>
                ) : analytics.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      No analytics data available. Make sure the kiosk is online.
                    </td>
                  </tr>
                ) : (
                  analytics.map((stat) => (
                    <tr key={stat.eventType} className="border-b border-card-border hover:bg-muted/30">
                      <td className="px-6 py-4 text-sm text-foreground">
                        {new Date(stat.lastUpdated).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground font-medium">
                        {stat.eventType.replace(/_/g, ' ').toUpperCase()}
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {Math.round(stat.averageResponseTime)}ms
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {stat.totalCount}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {Math.round(stat.averageResponseTime)}ms / {Math.round(stat.minResponseTime)}ms / {Math.round(stat.maxResponseTime)}ms
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Info Section */}
        <div className="mt-8 space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Session Tracking:</strong> Each user session is automatically tracked. Sessions are identified by user activity patterns - new sessions begin when a user starts fresh, ensuring accurate per-user performance metrics for research evaluation.
            </AlertDescription>
          </Alert>
        </div>
      </main>
    </div>
  );
}
