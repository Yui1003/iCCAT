import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AlertCircle, BarChart3, Download, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { firebaseAnalytics, AggregatedMetrics } from "@/lib/firebase-analytics";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

export default function AdminAnalytics() {
  const { toast } = useToast();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const isOnline = navigator.onLine;

  const { data: metrics, isLoading, refetch } = useQuery<AggregatedMetrics>({
    queryKey: ['/api/analytics/aggregated'],
    queryFn: async () => {
      return firebaseAnalytics.getAggregatedMetrics();
    },
    refetchInterval: 5000, // Refetch every 5 seconds
    enabled: isOnline
  });

  useEffect(() => {
    const fetchChartData = async () => {
      const data = await firebaseAnalytics.getMetricsForChart();
      setChartData(data);
    };
    fetchChartData();
  }, [metrics]);

  const resetMutation = useMutation({
    mutationFn: async () => {
      await firebaseAnalytics.deleteAllMetrics();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "All analytics data has been reset.",
      });
      setShowResetDialog(false);
      refetch();
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reset analytics data.",
      });
    }
  });

  const handleExportCSV = async () => {
    try {
      const allMetrics = await firebaseAnalytics.getMetrics();
      
      // Create CSV content
      const headers = ["Timestamp", "Metric Type", "Duration (ms)", "Device", "Action", "Success"];
      const rows = allMetrics.map(m => [
        new Date(m.timestamp).toLocaleString(),
        m.metric_type,
        m.duration_ms,
        m.device,
        m.action,
        m.success ? "Yes" : "No"
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      // Download
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-${new Date().toISOString()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Analytics data exported to CSV.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to export analytics data.",
      });
    }
  };

  return (
    <AdminLayout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Performance Analytics</h1>
          <p className="text-muted-foreground mt-2">Monitor kiosk performance and user behavior</p>
        </div>

        {!isOnline && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Analytics Offline</AlertTitle>
            <AlertDescription>
              Analytics will only record data when the kiosk is connected and online. Ensure the kiosk has internet connectivity to track performance metrics accurately.
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Routes Generated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? "-" : metrics?.total_routes_generated || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">routes calculated</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Route Generation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? "-" : `${metrics?.avg_route_generation || 0}ms`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">milliseconds</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Map Load Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? "-" : `${metrics?.avg_map_load_time || 0}ms`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">milliseconds</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? "-" : `${metrics?.success_rate || 0}%`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">successful operations</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Performance by Metric Type</CardTitle>
              <CardDescription>Average duration (milliseconds)</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="average" fill="#10b981" name="Avg Duration (ms)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Metrics Count</CardTitle>
              <CardDescription>Number of operations tracked</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" name="Count" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={!metrics || metrics.total_metrics === 0}
            data-testid="button-export-csv"
          >
            <Download className="w-4 h-4 mr-2" />
            Export to CSV
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowResetDialog(true)}
            disabled={!metrics || metrics.total_metrics === 0}
            data-testid="button-reset-analytics"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Reset Analytics
          </Button>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Detailed Metrics</CardTitle>
            <CardDescription>Raw analytics data from all tracked operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Timestamp</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Metric Type</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Duration (ms)</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Device</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Action</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Success</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics && metrics.total_metrics > 0 ? (
                    <tr className="border-b border-border">
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        Data table will populate as metrics are recorded...
                      </td>
                    </tr>
                  ) : (
                    <tr className="border-b border-border">
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        {isOnline ? "No analytics data available yet. Use the kiosk to generate metrics." : "Kiosk is offline. Analytics will work when online."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Analytics?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all analytics data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetMutation.isPending ? "Resetting..." : "Reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
