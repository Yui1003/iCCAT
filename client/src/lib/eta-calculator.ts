/**
 * ETA Calculator utility
 * Calculates estimated time of arrival based on distance and travel mode
 */

export const TRAVEL_SPEEDS = {
  walking: 1.4, // meters per second (5 km/h)
  driving: 10, // meters per second (36 km/h)
  biking: 5, // meters per second (18 km/h)
} as const;

/**
 * Calculate ETA from distance in meters
 * @param distanceMeters - distance in meters
 * @param mode - travel mode (walking, driving, or biking)
 * @returns ETA string (e.g., "5 min", "2 hrs 30 min")
 */
export function calculateETA(distanceMeters: number, mode: 'walking' | 'driving' | 'biking' = 'walking'): string {
  const speed = TRAVEL_SPEEDS[mode];
  const timeSeconds = distanceMeters / speed;
  const timeMinutes = Math.round(timeSeconds / 60);

  if (timeMinutes < 1) {
    return '<1 min';
  } else if (timeMinutes < 60) {
    return `${timeMinutes} min`;
  } else {
    const hours = Math.floor(timeMinutes / 60);
    const minutes = timeMinutes % 60;
    return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
  }
}

/**
 * Parse distance string (e.g., "1234 m" or "1.23 km") to meters
 */
export function parseDistanceToMeters(distanceStr: string): number {
  const match = distanceStr.match(/^([\d.]+)\s*(m|km)$/i);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  
  return unit === 'km' ? value * 1000 : value;
}

/**
 * Format distance in meters to a readable string
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}
