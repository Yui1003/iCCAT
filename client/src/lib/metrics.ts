/**
 * Client-side metrics tracking system
 * Tracks performance metrics for kiosk usage analysis
 */

export interface AnalyticsMetric {
  metric_type: string;
  duration_ms: number;
  timestamp: number;
  device: string;
  action: string;
  success: boolean;
}

class MetricsTracker {
  private static instance: MetricsTracker;
  private metrics: AnalyticsMetric[] = [];
  private isOnline = navigator.onLine;

  private constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  static getInstance(): MetricsTracker {
    if (!MetricsTracker.instance) {
      MetricsTracker.instance = new MetricsTracker();
    }
    return MetricsTracker.instance;
  }

  isConnected(): boolean {
    return this.isOnline;
  }

  /**
   * Track a performance metric
   */
  trackMetric(
    metricType: string,
    durationMs: number,
    action: string,
    success: boolean = true
  ): void {
    if (!this.isOnline) {
      console.warn('[Analytics] Offline - metrics not recorded');
      return;
    }

    const metric: AnalyticsMetric = {
      metric_type: metricType,
      duration_ms: Math.round(durationMs),
      timestamp: Date.now(),
      device: this.getDeviceType(),
      action,
      success
    };

    this.metrics.push(metric);

    // Send to backend immediately
    this.sendMetric(metric);
  }

  /**
   * Track duration of an async operation
   */
  async trackAsyncOperation<T>(
    metricType: string,
    action: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      this.trackMetric(metricType, duration, action, true);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.trackMetric(metricType, duration, action, false);
      throw error;
    }
  }

  /**
   * Track duration of a sync operation
   */
  trackSyncOperation<T>(
    metricType: string,
    action: string,
    operation: () => T
  ): T {
    const startTime = performance.now();
    try {
      const result = operation();
      const duration = performance.now() - startTime;
      this.trackMetric(metricType, duration, action, true);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.trackMetric(metricType, duration, action, false);
      throw error;
    }
  }

  /**
   * Get device type
   */
  private getDeviceType(): string {
    const userAgent = navigator.userAgent;
    if (/mobile|android|iphone|ipad|phone/i.test(userAgent)) {
      return 'Mobile';
    }
    if (/tablet/i.test(userAgent)) {
      return 'Tablet';
    }
    return 'Desktop/Kiosk';
  }

  /**
   * Send metric to backend
   */
  private async sendMetric(metric: AnalyticsMetric): Promise<void> {
    try {
      await fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metric)
      });
    } catch (error) {
      console.error('[Analytics] Failed to send metric:', error);
    }
  }

  /**
   * Get all tracked metrics (for debugging)
   */
  getMetrics(): AnalyticsMetric[] {
    return [...this.metrics];
  }

  /**
   * Clear local metrics
   */
  clearLocal(): void {
    this.metrics = [];
  }
}

export const metricsTracker = MetricsTracker.getInstance();
