import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import AdminLayout from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AnalyticsMetric } from "@shared/schema";

export default function AdminAnalytics() {
  const { toast } = useToast();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['/api/analytics/summary'],
  });

  const { data: metrics = [] } = useQuery<AnalyticsMetric[]>({
    queryKey: ['/api/analytics/metrics'],
  });

  const handleReset = async () => {
    setResetting(true);
    try {
      await apiRequest('POST', '/api/analytics/reset');
      toast({
        title: "Success",
        description: "All analytics metrics have been reset.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/metrics'] });
      setShowResetConfirm(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset analytics.",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  const handleExportCSV = () => {
    if (!metrics.length) return;

    const headers = ['Timestamp', 'Metric Type', 'Duration (ms)', 'Device', 'Action', 'Success', 'Error Message'];
    const rows = metrics.map(m => [
      new Date(m.timestamp).toLocaleString(),
      m.metricType,
      m.durationMs,
      m.deviceType,
      m.actionName || '-',
      m.success ? 'Yes' : 'No',
      m.errorMessage || '-',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString()}.csv`;
    a.click();
  };

  return (
    <AdminLayout>
      <div className="p-8 max-w-7xl">
        {/* DISCLAIMER */}
        <Card className="mb-6 border-yellow-500/30 bg-yellow-50/10">
          <div className="p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">Analytics Offline Disclaimer</h3>
              <p className="text-sm text-yellow-800">
                Analytics only work when the kiosk is <strong>online and connected to the server</strong>. 
                When the kiosk is offline, metrics are NOT recorded. To ensure accurate research data, 
                perform all testing with a stable internet connection.
              </p>
            </div>
          </div>
        </Card>

        <h1 className="text-3xl font-bold text-foreground mb-8">Performance Analytics</h1>

        {/* Summary Cards */}
        {isLoading ? (
          <div className="animate-pulse text-muted-foreground">Loading analytics...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="p-6">
              <p className="text-sm text-muted-foreground mb-2">Total Routes Generated</p>
              <p className="text-3xl font-bold text-foreground">{summary?.totalRoutes || 0}</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground mb-2">Avg Route Generation</p>
              <p className="text-3xl font-bold text-foreground">{summary?.avgRouteGenerationTime || 0}ms</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground mb-2">Avg Map Load Time</p>
              <p className="text-3xl font-bold text-foreground">{summary?.avgMapLoadTime || 0}ms</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground mb-2">Success Rate</p>
              <p className="text-3xl font-bold text-foreground">{summary?.successRate || 0}%</p>
            </Card>
          </div>
        )}

        {/* Export & Reset Buttons */}
        <div className="mb-6 flex gap-3">
          <Button 
            onClick={handleExportCSV}
            disabled={!metrics.length}
            className="gap-2"
            data-testid="button-export-analytics-csv"
          >
            <Download className="w-4 h-4" />
            Export to CSV
          </Button>
          <Button 
            onClick={() => setShowResetConfirm(true)}
            disabled={!metrics.length}
            variant="outline"
            className="gap-2"
            data-testid="button-reset-analytics"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Data
          </Button>
        </div>

        {/* Reset Confirmation Dialog */}
        <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Analytics Data?</DialogTitle>
              <DialogDescription>
                This will permanently delete all recorded analytics metrics. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button 
                variant="outline"
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleReset}
                disabled={resetting}
                data-testid="button-confirm-reset"
              >
                {resetting ? 'Resetting...' : 'Reset All Data'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Metrics Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">Timestamp</th>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">Metric Type</th>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">Duration (ms)</th>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">Device</th>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">Action</th>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">Success</th>
                </tr>
              </thead>
              <tbody>
                {metrics.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                      No analytics data available. Make sure the kiosk is online.
                    </td>
                  </tr>
                ) : (
                  metrics.map((metric) => (
                    <tr key={metric.id} className="border-b border-border hover:bg-muted/50" data-testid={`analytics-row-${metric.id}`}>
                      <td className="px-6 py-3 text-foreground">
                        {new Date(metric.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-foreground">{metric.metricType}</td>
                      <td className="px-6 py-3 text-foreground font-mono">{metric.durationMs}</td>
                      <td className="px-6 py-3 text-foreground">{metric.deviceType}</td>
                      <td className="px-6 py-3 text-foreground">{metric.actionName || '-'}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          metric.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {metric.success ? 'Yes' : 'Failed'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
