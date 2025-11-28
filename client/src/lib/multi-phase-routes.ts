import type { Building, NavigationRoute, RoutePhase, LatLng, RouteStep } from "@shared/schema";
import { KIOSK_LOCATION } from "@shared/schema";
import { getPhaseColor } from "@shared/phase-colors";
import { findShortestPath } from "./pathfinding";
import { getWalkpaths, getDrivepaths } from "./offline-data";

export interface MultiStopRoute {
  phases: RoutePhase[];
  totalDistance: string;
  waypoints: Building[];
}

/**
 * Calculate bearing between two points
 */
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return (θ * 180 / Math.PI + 360) % 360;
}

/**
 * Get turn instruction based on angle difference
 */
function getTurnInstruction(angleDiff: number, travelMode: string): { instruction: string; icon: string } {
  const absAngle = Math.abs(angleDiff);
  const isWalking = travelMode === 'walking' || travelMode === 'accessible';
  const road = isWalking ? 'pathway' : 'road';

  if (absAngle < 20) {
    return { instruction: `Continue straight on the ${road}`, icon: 'straight' };
  } else if (absAngle < 45) {
    return {
      instruction: angleDiff > 0 ? `Slight right on the ${road}` : `Slight left on the ${road}`,
      icon: angleDiff > 0 ? 'slight-right' : 'slight-left'
    };
  } else if (absAngle < 135) {
    return {
      instruction: angleDiff > 0 ? `Turn right on the ${road}` : `Turn left on the ${road}`,
      icon: angleDiff > 0 ? 'right' : 'left'
    };
  } else if (absAngle < 165) {
    return {
      instruction: angleDiff > 0 ? `Sharp right on the ${road}` : `Sharp left on the ${road}`,
      icon: angleDiff > 0 ? 'sharp-right' : 'sharp-left'
    };
  } else {
    return { instruction: `Make a U-turn on the ${road}`, icon: 'u-turn' };
  }
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Generate smart turn-by-turn directions from a route polyline
 */
function generateSmartSteps(
  routePolyline: LatLng[],
  travelMode: 'walking' | 'driving' | 'accessible',
  startName: string,
  endName: string
): { steps: RouteStep[]; totalDistance: string } {
  const steps: RouteStep[] = [];
  let totalDist = 0;

  steps.push({
    instruction: `Start at ${startName}`,
    distance: '0 m',
    icon: 'start'
  });

  // Calculate bearings for each segment
  const bearings: number[] = [];
  for (let i = 0; i < routePolyline.length - 1; i++) {
    const bearing = calculateBearing(
      routePolyline[i].lat,
      routePolyline[i].lng,
      routePolyline[i + 1].lat,
      routePolyline[i + 1].lng
    );
    bearings.push(bearing);
  }

  // Group consecutive segments with similar bearings
  let currentGroupStart = 0;
  for (let i = 1; i < bearings.length; i++) {
    const prevBearing = bearings[i - 1];
    const currBearing = bearings[i];
    const angleDiff = ((currBearing - prevBearing + 540) % 360) - 180;

    if (Math.abs(angleDiff) > 20 || i === bearings.length - 1) {
      const groupEnd = i === bearings.length - 1 ? i + 1 : i;
      
      let segmentDist = 0;
      for (let j = currentGroupStart; j < groupEnd; j++) {
        segmentDist += calculateDistance(
          routePolyline[j].lat,
          routePolyline[j].lng,
          routePolyline[j + 1].lat,
          routePolyline[j + 1].lng
        );
      }
      totalDist += segmentDist;

      if (currentGroupStart > 0) {
        const prevBearing = bearings[currentGroupStart - 1];
        const currBearing = bearings[currentGroupStart];
        const turnAngle = ((currBearing - prevBearing + 540) % 360) - 180;
        const { instruction, icon } = getTurnInstruction(turnAngle, travelMode);
        
        const distStr = segmentDist >= 1000
          ? `${(segmentDist / 1000).toFixed(1)} km`
          : `${Math.round(segmentDist)} m`;

        steps.push({ instruction, distance: distStr, icon });
      }

      currentGroupStart = i;
    }
  }

  // Add final instruction
  const totalDistStr = totalDist >= 1000
    ? `${(totalDist / 1000).toFixed(1)} km`
    : `${Math.round(totalDist)} m`;

  steps.push({
    instruction: `Arrive at ${endName}`,
    distance: totalDistStr,
    icon: 'end'
  });

  return { steps, totalDistance: totalDistStr };
}

/**
 * Calculate multi-phase route with waypoints
 * Each phase is a separate route calculation with its own color
 */
export async function calculateMultiPhaseRoute(
  start: Building | typeof KIOSK_LOCATION,
  waypoints: Building[],
  destination: Building,
  mode: 'walking' | 'driving' | 'accessible'
): Promise<MultiStopRoute | null> {
  // For accessible mode, use walkpaths (will be filtered by isPwdFriendly in pathfinding)
  const paths = mode === 'driving' ? await getDrivepaths() : await getWalkpaths();
  const phases: RoutePhase[] = [];
  
  // Create array of all stops: [start, ...waypoints, destination]
  const allStops = [start as Building, ...waypoints, destination];
  
  // Calculate route for each segment
  for (let i = 0; i < allStops.length - 1; i++) {
    const segmentStart = allStops[i];
    const segmentEnd = allStops[i + 1];
    
    // Find shortest path for this segment
    const polyline = findShortestPath(segmentStart, segmentEnd, paths, mode);
    
    if (!polyline) {
      console.error(`No route found for segment ${i + 1}: ${segmentStart.name} → ${segmentEnd.name}`);
      return null;
    }
    
    // Generate turn-by-turn directions for this phase
    const { steps, totalDistance } = generateSmartSteps(
      polyline,
      mode,
      segmentStart.name,
      segmentEnd.name
    );
    
    // Create phase object with unique color
    const phase: RoutePhase = {
      mode,
      polyline,
      steps,
      distance: totalDistance,
      startName: segmentStart.name,
      endName: segmentEnd.name,
      color: getPhaseColor(i),
      phaseIndex: i,
      startId: segmentStart.id,
      endId: segmentEnd.id
    };
    
    phases.push(phase);
  }
  
  // Calculate total distance across all phases
  let totalMeters = 0;
  phases.forEach(phase => {
    const dist = parseFloat(phase.distance.replace(/[^\d.]/g, ''));
    const isKm = phase.distance.includes('km');
    totalMeters += isKm ? dist * 1000 : dist;
  });
  
  const totalDistance = totalMeters >= 1000
    ? `${(totalMeters / 1000).toFixed(1)} km`
    : `${Math.round(totalMeters)} m`;
  
  return {
    phases,
    totalDistance,
    waypoints
  };
}

/**
 * Convert multi-phase route to a full navigation route (for backward compatibility)
 * Combines all phases into a single route with the first phase's polyline/steps
 */
export function multiPhaseToNavigationRoute(
  multiPhase: MultiStopRoute,
  start: Building,
  destination: Building,
  mode: 'walking' | 'driving' | 'accessible'
): NavigationRoute {
  // For display purposes, use the complete route
  // But store phases for multi-stop navigation
  const allPolylines = multiPhase.phases.flatMap(p => p.polyline);
  const allSteps = multiPhase.phases.flatMap(p => p.steps);
  
  return {
    start,
    end: destination,
    mode,
    polyline: allPolylines,
    steps: allSteps,
    totalDistance: multiPhase.totalDistance,
    phases: multiPhase.phases,
    waypoints: multiPhase.waypoints
  };
}
