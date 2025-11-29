import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, AlertCircle, BarChart3, RotateCcw, Wifi, WifiOff, Download, Cpu, Clock, Info, Trash2, Smartphone } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AnalyticsEventType } from "@shared/analytics-schema";
import { isAnalyticsAvailable } from "@/lib/analytics-tracker";
import { useToast } from "@/hooks/use-toast";
import { getDeviceId } from "@/lib/device-id";
import type { KioskUptime } from "@shared/schema";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";

interface AnalyticsSummary {
  eventType: AnalyticsEventType;
  totalCount: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  lastUpdated: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminAnalytics() {
  const [isOnline, setIsOnline] = useState(isAnalyticsAvailable());
  const [resetConfirm, setResetConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  // Initialize device ID from IP address
  useEffect(() => {
    const initDeviceId = async () => {
      try {
        const response = await fetch('/api/get-device-ip');
        if (response.ok) {
          const data = await response.json();
          setCurrentDeviceId(data.ip || 'unknown');
        }
      } catch (err) {
        console.warn('Failed to get device ID:', err);
        setCurrentDeviceId('unknown');
      }
    };
    initDeviceId();
  }, []);

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

  // Dedicated query for mobile navigation usage count
  const { data: mobileNavData } = useQuery<{ count: number }>({
    queryKey: ['/api/admin/analytics', 'mobile-navigation-count'],
    queryFn: async () => {
      const response = await fetch('/api/admin/analytics/mobile-navigation-count');
      if (!response.ok) throw new Error('Failed to fetch mobile navigation count');
      return response.json();
    }
  });

  const [kioskUptimes, setKioskUptimes] = useState<KioskUptime[]>([]);
  const [liveTime, setLiveTime] = useState<number>(Date.now());

  // Real-time listener for kiosk uptime changes
  useEffect(() => {
    const eventSource = new EventSource('/api/listen/kiosk-uptime');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setKioskUptimes(Array.isArray(data) ? data : []);
        console.log('[ANALYTICS] Received kiosk uptime update');
      } catch (err) {
        console.warn('Error parsing kiosk uptime data:', err);
      }
    };
    
    eventSource.onerror = () => {
      console.warn('[ANALYTICS] Kiosk uptime listener disconnected');
      eventSource.close();
    };
    
    return () => {
      eventSource.close();
    };
  }, []);

  // Update live time every second for session duration counting
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  const handleDeleteDevice = async (deviceId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/analytics/kiosk-uptime/${encodeURIComponent(deviceId)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete device record');
      }

      setDeleteConfirmId(null);
      toast({
        title: "Success",
        description: "Device record deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting device:', error);
      toast({
        title: "Error",
        description: "Failed to delete device record",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatDuration = (startTime: any, endTime?: any): string => {
    try {
      let start: number;
      let end: number;

      // Parse start time - handle all formats
      if (typeof startTime === 'number' && startTime > 0) {
        start = startTime;
      } else if (startTime instanceof Date) {
        start = startTime.getTime();
      } else if (typeof startTime === 'string' && startTime.length > 0) {
        const parsed = new Date(startTime).getTime();
        if (isNaN(parsed)) return 'N/A';
        start = parsed;
      } else if (startTime && typeof startTime === 'object' && startTime._seconds && startTime._seconds > 0) {
        // Firestore Timestamp
        start = (startTime._seconds * 1000) + Math.floor(startTime._nanoseconds / 1000000);
      } else if (startTime && typeof startTime === 'object' && startTime.toMillis) {
        // Firebase Timestamp object
        start = startTime.toMillis();
      } else {
        return 'N/A';
      }

      // Parse end time - use liveTime if no endTime (active session)
      if (endTime) {
        if (typeof endTime === 'number' && endTime > 0) {
          end = endTime;
        } else if (endTime instanceof Date) {
          end = endTime.getTime();
        } else if (typeof endTime === 'string' && endTime.length > 0) {
          const parsed = new Date(endTime).getTime();
          if (isNaN(parsed)) end = liveTime;
          else end = parsed;
        } else if (endTime && typeof endTime === 'object' && endTime._seconds && endTime._seconds > 0) {
          // Firestore Timestamp
          end = (endTime._seconds * 1000) + Math.floor(endTime._nanoseconds / 1000000);
        } else if (endTime && typeof endTime === 'object' && endTime.toMillis) {
          // Firebase Timestamp object
          end = endTime.toMillis();
        } else {
          end = liveTime; // Use live time for ongoing sessions
        }
      } else {
        end = liveTime; // Use live time for ongoing sessions
      }

      const diffMs = end - start;
      if (diffMs < 0 || isNaN(diffMs)) return 'N/A';
      
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      
      if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
      if (minutes > 0) return `${minutes}m ${seconds}s`;
      return `${seconds}s`;
    } catch (err) {
      console.error('Error formatting duration:', err, startTime, endTime);
      return 'N/A';
    }
  };

  const currentDeviceUptime = kioskUptimes.find(k => k.deviceId === currentDeviceId);
  const otherDevices = kioskUptimes.filter(k => k.deviceId !== currentDeviceId);

  const eventTypeLabels: Record<AnalyticsEventType, string> = {
    [AnalyticsEventType.INTERFACE_ACTION]: "Interface Actions (incl. Mobile Navigation Usage)",
    [AnalyticsEventType.MAP_LOAD]: "Map Loading",
    [AnalyticsEventType.IMAGE_LOAD]: "Image Loading",
    [AnalyticsEventType.MENU_RENDER]: "Menu Rendering",
    [AnalyticsEventType.ROUTE_GENERATION]: "Route Generation"
  };

  // Get dedicated mobile navigation usage count from backend query
  const mobileNavigationUsage = mobileNavData?.count || 0;

  // Prepare data for charts
  const chartData = analytics.map((stat) => ({
    name: eventTypeLabels[stat.eventType].split(' ')[0],
    avg: Math.round(stat.averageResponseTime),
    min: Math.round(stat.minResponseTime),
    max: Math.round(stat.maxResponseTime),
    count: stat.totalCount,
    fullName: eventTypeLabels[stat.eventType]
  }));

  const pieData = analytics.map((stat) => ({
    name: eventTypeLabels[stat.eventType],
    value: stat.totalCount
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-card-border p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link href="/admin/dashboard">
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
        <div className="mb-8 flex justify-end gap-2 flex-wrap">
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

        {isLoading ? (
          <div className="grid gap-6">
            {[1, 2].map((i) => (
              <Card key={i} className="h-96 animate-pulse bg-muted" />
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
          <>
            {/* Charts Section */}
            <div className="grid lg:grid-cols-2 gap-6 mb-8">
              {/* Response Time Chart */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Response Times (ms)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" stroke="var(--color-muted-foreground)" />
                    <YAxis stroke="var(--color-muted-foreground)" />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                      labelStyle={{ color: 'var(--color-foreground)' }}
                    />
                    <Legend />
                    <Bar dataKey="avg" fill="#3b82f6" name="Average" />
                    <Bar dataKey="min" fill="#10b981" name="Min" />
                    <Bar dataKey="max" fill="#ef4444" name="Max" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Event Distribution Chart */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Event Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                      labelStyle={{ color: 'var(--color-foreground)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Event Count Chart */}
            <Card className="p-6 mb-8">
              <h3 className="text-lg font-semibold text-foreground mb-4">Events Tracked by Type</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" />
                  <YAxis stroke="var(--color-muted-foreground)" />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                    labelStyle={{ color: 'var(--color-foreground)' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Total Events"
                    dot={{ fill: '#3b82f6', r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Mobile Navigation Usage Card */}
            <Card className="p-6 mb-8 border-2 border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-950/30">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                  <Smartphone className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    Mobile Navigation Usage
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-0 h-4 w-4 rounded-full hover:bg-muted flex items-center justify-center">
                          <Info className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Number of times users have scanned the QR code to continue navigation on their mobile device. This tracks unique page loads of the mobile navigation interface.</p>
                      </TooltipContent>
                    </Tooltip>
                  </h3>
                  <p className="text-sm text-muted-foreground">QR code scans / mobile navigation page loads</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-green-600 dark:text-green-400" data-testid="text-mobile-nav-count">
                    {mobileNavigationUsage.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Total scans</p>
                </div>
              </div>
            </Card>

            {/* Analytics Cards */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-foreground mb-4">Detailed Statistics</h3>
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
            </div>

            {/* Kiosk Uptime Section */}
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                <Cpu className="w-5 h-5" />
                Kiosk Uptime Monitor
              </h2>
              
              <div className="grid gap-6">
                {/* Current Device */}
                {currentDeviceUptime ? (
                  <Card className="p-6 border-2 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/30">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <Badge variant="outline" className="bg-blue-500 text-white dark:text-white">Current Device</Badge>
                          This Kiosk
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">{currentDeviceId}</p>
                      </div>
                      <Badge variant={currentDeviceUptime.isActive ? "default" : "secondary"}>
                        {currentDeviceUptime.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <p className="text-xs text-muted-foreground">Uptime %</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="p-0 h-4 w-4 rounded-full hover:bg-muted flex items-center justify-center">
                                <Info className="w-3 h-3 text-muted-foreground" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs max-w-xs">Percentage of successful API requests. Calculated as: (Successful Requests / Total Requests) × 100</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{currentDeviceUptime.uptimePercentage.toFixed(1)}%</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Total Requests</p>
                        <p className="text-2xl font-bold text-foreground">{currentDeviceUptime.totalRequests}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Successful</p>
                        <p className="text-2xl font-bold text-green-600">{currentDeviceUptime.successfulRequests}</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <p className="text-xs text-muted-foreground">Session Duration</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="p-0 h-4 w-4 rounded-full hover:bg-muted flex items-center justify-center">
                                <Info className="w-3 h-3 text-muted-foreground" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs max-w-xs">Time elapsed since the kiosk browser session started. Updates in real-time.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="text-lg font-bold text-foreground flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDuration(currentDeviceUptime.sessionStart, currentDeviceUptime.sessionEnd)}
                        </p>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <Card className="p-6 border-2 border-dashed text-center">
                    <Cpu className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-muted-foreground">No uptime data for this device yet</p>
                  </Card>
                )}

                {/* Other Devices */}
                {otherDevices.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-4">Other Kiosk Devices ({otherDevices.length})</h4>
                    <div className="grid gap-3">
                      {otherDevices.map((device) => (
                        <Card key={device.id} className="p-4 hover-elevate active-elevate-2">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{device.deviceId}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDuration(device.sessionStart, device.sessionEnd)} • Started: {device.sessionStart ? (() => {
                                  try {
                                    let date: Date;
                                    
                                    // Handle Firestore Timestamp objects ({_seconds, _nanoseconds})
                                    if (device.sessionStart && typeof device.sessionStart === 'object' && '_seconds' in device.sessionStart) {
                                      date = new Date((device.sessionStart as any)._seconds * 1000);
                                    } else if (device.sessionStart instanceof Date) {
                                      date = device.sessionStart;
                                    } else {
                                      date = new Date(device.sessionStart);
                                    }
                                    
                                    if (isNaN(date.getTime())) return 'Invalid Date';
                                    const formatter = new Intl.DateTimeFormat('en-US', {
                                      timeZone: 'Asia/Manila',
                                      year: 'numeric',
                                      month: 'short',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                      hour12: false
                                    });
                                    return formatter.format(date);
                                  } catch (err) {
                                    return 'Invalid Date';
                                  }
                                })() : 'N/A'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant={device.isActive ? "default" : "secondary"}>
                                {device.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                              {deleteConfirmId === device.id ? (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeleteDevice(device.id)}
                                    disabled={isDeleting}
                                    data-testid={`button-confirm-delete-device-${device.id}`}
                                  >
                                    {isDeleting ? 'Deleting...' : 'Confirm'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setDeleteConfirmId(null)}
                                    disabled={isDeleting}
                                    data-testid={`button-cancel-delete-device-${device.id}`}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setDeleteConfirmId(device.id)}
                                  data-testid={`button-delete-device-${device.id}`}
                                >
                                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-sm">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Uptime %</p>
                              <p className="font-semibold text-foreground">{device.uptimePercentage.toFixed(1)}%</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Total Requests</p>
                              <p className="font-semibold text-foreground">{device.totalRequests}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Successful</p>
                              <p className="font-semibold text-green-600">{device.successfulRequests}</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Info Box */}
            <Alert className="mt-8">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Metrics Tracked:</strong> Response times for interface actions, map loading, image loading, menu rendering, and route generation. All metrics are automatically collected when the kiosk is online. Charts above are visual only and not included in exports. Kiosk uptime shows per-device session metrics with request success rates.
              </AlertDescription>
            </Alert>
          </>
        )}
      </main>
    </div>
  );
}
