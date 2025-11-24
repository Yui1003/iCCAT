import { z } from "zod";

// Analytics event types
export enum AnalyticsEventType {
  INTERFACE_ACTION = "interface_action",
  MAP_LOAD = "map_load",
  IMAGE_LOAD = "image_load",
  MENU_RENDER = "menu_render",
  ROUTE_GENERATION = "route_generation",
  NAVIGATION_START = "navigation_start",
  PAGE_VIEW = "page_view"
}

// Schema for analytics events
export const analyticsEventSchema = z.object({
  id: z.string().uuid().optional(),
  eventType: z.nativeEnum(AnalyticsEventType),
  responseTime: z.number(), // in milliseconds
  timestamp: z.number(), // Unix timestamp
  metadata: z.record(z.any()).optional(), // Additional context
  offline: z.boolean().default(false)
});

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;

// Schema for analytics summary/stats
export const analyticsSummarySchema = z.object({
  id: z.string().uuid().optional(),
  eventType: z.nativeEnum(AnalyticsEventType),
  totalCount: z.number(),
  averageResponseTime: z.number(),
  minResponseTime: z.number(),
  maxResponseTime: z.number(),
  lastUpdated: z.number()
});

export type AnalyticsSummary = z.infer<typeof analyticsSummarySchema>;

// Schema for analytics reset
export const analyticsResetSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

export type AnalyticsReset = z.infer<typeof analyticsResetSchema>;
