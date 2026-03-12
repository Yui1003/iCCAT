import type { Building, NavigationRoute, RoutePhase, LatLng, RouteStep, Walkpath, Drivepath } from "@shared/schema";
import { KIOSK_LOCATION } from "@shared/schema";
import { getPhaseColor } from "@shared/phase-colors";
import { findShortestPath, findNearestAccessibleEndpoint } from "./pathfinding";
import { getWalkpaths, getDrivepaths } from "./offline-data";

export interface InaccessibleStopInfo {
  phaseIndex: number;       // Phase index in the route (0-based) where this stop is the end
  buildingName: string;     // Original name of the inaccessible building
  nearestEndpoint: { lat: number; lng: number } | null; // Nearest point on any accessible path
}

export interface MultiStopRoute {
  phases: RoutePhase[];
  totalDistance: string;
  waypoints: Building[];
  inaccessibleStops?: InaccessibleStopInfo[];
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

  if (absAngle < 15) {
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

  // Google Maps-style thresholds
  const MIN_TURN_ANGLE = 45;
  const MIN_SLIGHT_ANGLE = 15;
  const MIN_SLIGHT_DIST = 15;

  // Group consecutive segments, only breaking on real turns
  let currentGroupStart = 0;
  let accumulatedGroupDist = 0;

  for (let i = 1; i < bearings.length; i++) {
    const prevBearing = bearings[i - 1];
    const currBearing = bearings[i];
    const angleDiff = ((currBearing - prevBearing + 540) % 360) - 180;
    const absAngle = Math.abs(angleDiff);

    const segDist = calculateDistance(
      routePolyline[i].lat,
      routePolyline[i].lng,
      routePolyline[i + 1 < routePolyline.length ? i + 1 : i].lat,
      routePolyline[i + 1 < routePolyline.length ? i + 1 : i].lng
    );
    accumulatedGroupDist += segDist;

    const isRealTurn = absAngle >= MIN_TURN_ANGLE;
    const isSlightTurn = absAngle >= MIN_SLIGHT_ANGLE && accumulatedGroupDist >= MIN_SLIGHT_DIST;
    const isLast = i === bearings.length - 1;

    if (isRealTurn || isSlightTurn || isLast) {
      const groupEnd = isLast ? i + 1 : i;

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

      if (currentGroupStart > 0 && !isLast) {
        const gb = bearings[currentGroupStart - 1];
        const nb = bearings[currentGroupStart];
        const turnAngle = ((nb - gb + 540) % 360) - 180;
        const { instruction, icon } = getTurnInstruction(turnAngle, travelMode);

        const distStr = segmentDist >= 1000
          ? `${(segmentDist / 1000).toFixed(1)} km`
          : `${Math.round(segmentDist)} m`;

        steps.push({ instruction, distance: distStr, icon });
      }

      currentGroupStart = i;
      accumulatedGroupDist = 0;
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
 * Build a synthetic Building object at a given lat/lng
 */
function makeSyntheticBuilding(name: string, lat: number, lng: number): Building {
  return {
    id: 'accessible-endpoint',
    name,
    lat,
    lng,
    nodeLat: lat,
    nodeLng: lng,
    entranceLat: lat,
    entranceLng: lng,
    polygon: null,
    polygonColor: null,
    description: '',
    image: null,
    type: 'building',
    markerIcon: null,
    departments: null,
    polygonOpacity: null
  } as Building;
}

/**
 * Calculate multi-phase route with waypoints.
 * For accessible mode, if a segment is inaccessible, automatically falls back to
 * the nearest accessible endpoint of that building and records it in inaccessibleStops.
 */
export async function calculateMultiPhaseRoute(
  start: Building | typeof KIOSK_LOCATION,
  waypoints: Building[],
  destination: Building,
  mode: 'walking' | 'driving' | 'accessible'
): Promise<MultiStopRoute | null> {
  // Always fetch fresh paths from server so multi-phase uses the latest path network
  const endpoint = mode === 'driving' ? '/api/drivepaths' : '/api/walkpaths';
  let paths: (Walkpath | Drivepath)[];
  try {
    const res = await fetch(endpoint, { credentials: 'include', cache: 'no-cache' });
    if (res.ok) {
      paths = await res.json();
    } else {
      paths = mode === 'driving' ? await getDrivepaths() : await getWalkpaths();
    }
  } catch {
    paths = mode === 'driving' ? await getDrivepaths() : await getWalkpaths();
  }

  const phases: RoutePhase[] = [];
  const inaccessibleStops: InaccessibleStopInfo[] = [];

  // Create array of all stops: [start, ...waypoints, destination]
  // Each entry may be overridden by a nearest-endpoint substitute
  const allStops: Building[] = [start as Building, ...waypoints, destination];

  // Calculate route for each segment
  for (let i = 0; i < allStops.length - 1; i++) {
    const segmentStart = allStops[i];
    const originalSegmentEnd = allStops[i + 1];
    let segmentEnd: Building = originalSegmentEnd;
    const originalEndName = originalSegmentEnd.name;

    // Find shortest path for this segment
    let polyline = findShortestPath(segmentStart, segmentEnd, paths, mode);
    let phaseEndName = originalEndName;

    // For accessible mode: if no direct accessible path, try 3-tier fallback
    if (!polyline && mode === 'accessible') {
      const nearestEndpoint = findNearestAccessibleEndpoint(originalSegmentEnd as Building, paths as any);

      if (nearestEndpoint) {
        console.warn(`[MULTI-PHASE] Stop "${originalEndName}" has no accessible path — trying nearest accessible endpoint.`);
        const substitute = makeSyntheticBuilding(
          `Nearest Accessible Point to ${originalEndName}`,
          nearestEndpoint.lat,
          nearestEndpoint.lng
        );

        // Tier 1: accessible routing to nearest endpoint
        polyline = findShortestPath(segmentStart, substitute, paths, 'accessible');

        // Tier 2: regular walkpaths to nearest endpoint
        if (!polyline) {
          console.warn(`[MULTI-PHASE] Tier 1 failed — trying regular walkpaths to nearest endpoint.`);
          polyline = findShortestPath(segmentStart, substitute, paths, 'walking');
        }

        if (polyline) {
          // Route this phase to the nearest endpoint.
          // IMPORTANT: do NOT update allStops[i+1] — subsequent phases still start from the original building.
          segmentEnd = substitute;
          // Keep the phase endName as the original building so UI says "Walk to [Building]"
          phaseEndName = originalEndName;
        }

        // Mark this stop as inaccessible regardless of whether endpoint routing succeeded
        inaccessibleStops.push({ phaseIndex: i, buildingName: originalEndName, nearestEndpoint });
      } else {
        // No nearest endpoint found — still mark as inaccessible
        inaccessibleStops.push({ phaseIndex: i, buildingName: originalEndName, nearestEndpoint: null });
      }

      // Tier 3 last resort: if endpoint routing also failed, route directly to the building via regular walkpaths
      if (!polyline) {
        console.warn(`[MULTI-PHASE] Endpoint routing failed — last resort: regular walkpaths directly to ${originalEndName}.`);
        segmentEnd = originalSegmentEnd;
        polyline = findShortestPath(segmentStart, originalSegmentEnd, paths, 'walking');
        phaseEndName = originalEndName;
      }
    }

    if (!polyline) {
      console.error(`No route found for segment ${i + 1}: ${segmentStart.name} → ${phaseEndName}`);
      return null;
    }

    if (polyline.length === 2) {
      console.warn(`[MULTI-PHASE] Segment ${i + 1} (${segmentStart.name} → ${phaseEndName}) used straight-line fallback.`);
    }

    // Generate turn-by-turn directions for this phase
    const { steps, totalDistance } = generateSmartSteps(
      polyline,
      mode,
      segmentStart.name,
      phaseEndName
    );

    // Create phase object with unique color
    const phase: RoutePhase = {
      mode,
      polyline,
      steps,
      distance: totalDistance,
      startName: segmentStart.name,
      endName: phaseEndName,
      color: getPhaseColor(i),
      phaseIndex: i,
      startId: segmentStart.id,
      endId: segmentEnd.id
    };

    if (segmentEnd.id === 'accessible-endpoint') {
      phase.note = `[accessible-endpoint] Nearest accessible point to ${originalEndName} — the building entrance may require a non-accessible path from here.`;
    }

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
    waypoints,
    inaccessibleStops: inaccessibleStops.length > 0 ? inaccessibleStops : undefined
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
