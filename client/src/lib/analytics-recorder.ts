/**
 * Analytics Recorder utility
 * Records system behavior metrics as per research guidelines:
 * - Response time of interface actions
 * - Loading speed of maps, images, and menus
 * - Route-generation speed
 */

import { apiRequest } from './queryClient';

export type MetricType = 'route_generation' | 'map_load' | 'api_response' | 'interface_action';
export type DeviceType = 'kiosk' | 'mobile';

interface RecordMetricParams {
  metricType: MetricType;
  durationMs: number;
  actionName?: string;
  success?: boolean;
  errorMessage?: string;
  sourceRoute?: string;
  additionalData?: Record<string, any>;
}

/**
 * Record a performance metric
 */
export async function recordMetric(params: RecordMetricParams): Promise<void> {
  try {
    const isKiosk = !window.location.search.includes('source=mobile');
    const deviceType: DeviceType = isKiosk ? 'kiosk' : 'mobile';

    await apiRequest('POST', '/api/metrics', {
      metricType: params.metricType,
      durationMs: Math.round(params.durationMs),
      deviceType,
      actionName: params.actionName,
      success: params.success !== false ? 1 : 0,
      errorMessage: params.errorMessage,
      sourceRoute: params.sourceRoute,
      additionalData: params.additionalData,
    });
  } catch (error) {
    console.error('Failed to record metric:', error);
    // Fail silently - don't disrupt user experience
  }
}

/**
 * Time an async operation and record the metric
 */
export async function timeAndRecordMetric<T>(
  operation: () => Promise<T>,
  params: Omit<RecordMetricParams, 'durationMs'>
): Promise<T> {
  const startTime = performance.now();
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    await recordMetric({ ...params, durationMs: duration, success: true });
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    await recordMetric({
      ...params,
      durationMs: duration,
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Time a synchronous operation and record the metric
 */
export function timeAndRecordSyncMetric<T>(
  operation: () => T,
  params: Omit<RecordMetricParams, 'durationMs'>
): T {
  const startTime = performance.now();
  try {
    const result = operation();
    const duration = performance.now() - startTime;
    recordMetric({ ...params, durationMs: duration, success: true });
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    recordMetric({
      ...params,
      durationMs: duration,
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
