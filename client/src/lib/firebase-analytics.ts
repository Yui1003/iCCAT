/**
 * Analytics service using backend API
 * Backend handles Firebase storage for deployed projects
 */

export interface StoredMetric {
  metric_type: string;
  duration_ms: number;
  timestamp: number;
  device: string;
  action: string;
  success: boolean;
  id?: string;
}

export interface AggregatedMetrics {
  total_routes_generated: number;
  avg_route_generation: number;
  avg_map_load_time: number;
  success_rate: number;
  route_count: number;
  map_count: number;
  total_metrics: number;
}

class FirebaseAnalytics {
  private apiBaseUrl = '/api';

  /**
   * Save a metric to backend
   */
  async saveMetric(metric: StoredMetric): Promise<string> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metric)
      });

      if (!response.ok) {
        throw new Error(`Failed to save metric: ${response.statusText}`);
      }

      const data = await response.json();
      return data.id || '';
    } catch (error) {
      console.error('Error saving metric to backend:', error);
      throw error;
    }
  }

  /**
   * Get all metrics from backend
   */
  async getMetrics(): Promise<StoredMetric[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/analytics`);
      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching metrics from backend:', error);
      return [];
    }
  }

  /**
   * Get aggregated analytics data
   */
  async getAggregatedMetrics(): Promise<AggregatedMetrics> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/analytics/aggregated`);
      if (!response.ok) {
        throw new Error(`Failed to fetch aggregated metrics: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching aggregated metrics from backend:', error);
      return {
        total_routes_generated: 0,
        avg_route_generation: 0,
        avg_map_load_time: 0,
        success_rate: 100,
        route_count: 0,
        map_count: 0,
        total_metrics: 0
      };
    }
  }

  /**
   * Get metrics by type
   */
  async getMetricsByType(metricType: string): Promise<StoredMetric[]> {
    try {
      const metrics = await this.getMetrics();
      return metrics.filter(m => m.metric_type === metricType);
    } catch (error) {
      console.error(`Error fetching ${metricType} metrics:`, error);
      return [];
    }
  }

  /**
   * Delete all metrics
   */
  async deleteAllMetrics(): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/analytics`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Failed to delete metrics: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting metrics:', error);
      throw error;
    }
  }

  /**
   * Get metrics for chart visualization
   */
  async getMetricsForChart() {
    try {
      const metrics = await this.getMetrics();

      // Group by metric type
      const byType: { [key: string]: number[] } = {};
      metrics.forEach(metric => {
        if (!byType[metric.metric_type]) {
          byType[metric.metric_type] = [];
        }
        byType[metric.metric_type].push(metric.duration_ms);
      });

      // Calculate averages
      const chartData = Object.entries(byType).map(([type, durations]) => ({
        name: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        average: Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10,
        count: durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations)
      }));

      return chartData;
    } catch (error) {
      console.error('Error generating chart data:', error);
      return [];
    }
  }
}

export const firebaseAnalytics = new FirebaseAnalytics();
