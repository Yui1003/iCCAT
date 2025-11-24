import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse distance string and return meters
 * Handles both "123 m" and "1.5 km" formats
 */
export function parseDistanceToMeters(distStr: string): number {
  const match = distStr.match(/(\d+(?:\.\d+)?)\s*(m|km)?/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2] || 'm';
  return unit === 'km' ? value * 1000 : value;
}

/**
 * Calculate ETA (Estimated Time of Arrival) from distance and travel mode
 * Average speeds: walking ~1.4 m/s, driving ~10 m/s
 */
export function calculateETA(distanceMeters: number, mode: 'walking' | 'driving'): string {
  const speed = mode === 'walking' ? 1.4 : 10; // m/s
  const seconds = distanceMeters / speed;
  const minutes = Math.ceil(seconds / 60);
  return minutes > 0 ? `${minutes} min` : '< 1 min';
}

/**
 * Calculate ETA from a distance string
 */
export function calculateETAFromString(distStr: string, mode: 'walking' | 'driving'): string {
  const meters = parseDistanceToMeters(distStr);
  return calculateETA(meters, mode);
}
