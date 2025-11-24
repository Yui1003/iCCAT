/**
 * Calculate ETA based on distance and travel mode
 * @param distanceMeters - Distance in meters
 * @param mode - Travel mode ('walking' or 'driving')
 * @returns ETA string (e.g., "5 min", "< 1 min")
 */
export function calculateETA(distanceMeters: number, mode: 'walking' | 'driving'): string {
  if (distanceMeters <= 0) return '0 min';
  
  // Average speeds: walking ~1.4 m/s, driving ~10 m/s
  const speed = mode === 'walking' ? 1.4 : 10;
  const secondsNeeded = distanceMeters / speed;
  const minutesNeeded = secondsNeeded / 60;

  const minutes = Math.ceil(minutesNeeded);
  return minutes > 0 ? `${minutes} min` : '< 1 min';
}

/**
 * Parse distance string and return meters
 * @param distanceStr - Distance string (e.g., "150 m" or "1.5 km")
 * @returns Distance in meters
 */
export function parseDistance(distanceStr: string): number {
  if (!distanceStr) return 0;
  
  const trimmed = distanceStr.trim();
  const number = parseFloat(trimmed);
  
  if (isNaN(number)) return 0;
  if (trimmed.includes('km')) return number * 1000;
  return number; // Assume meters
}
