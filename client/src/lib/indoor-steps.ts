import type { IndoorNode, Room, RouteStep } from "@shared/schema";

export function generateIndoorSteps(
  polylineWaypoints: Array<{ lat: number; lng: number }>,
  floorIndoorNodes: IndoorNode[],
  floorRooms: Room[],
  scale: number,
  startLabel: string,
  endLabel: string,
  isMultiFloor: boolean
): RouteStep[] {
  const steps: RouteStep[] = [];

  steps.push({ instruction: `Start at ${startLabel}`, distance: '0 m', icon: 'navigation' });

  if (polylineWaypoints.length < 2) {
    steps.push({ instruction: `Arrive at ${endLabel}`, distance: '0 m', icon: isMultiFloor ? 'arrow-up' : 'flag' });
    return steps;
  }

  const nodeByCoord = new Map<string, IndoorNode>();
  floorIndoorNodes.forEach(node => {
    nodeByCoord.set(`${node.x.toFixed(1)},${node.y.toFixed(1)}`, node);
  });
  const roomByCoord = new Map<string, Room>();
  floorRooms.forEach(room => {
    roomByCoord.set(`${room.x.toFixed(1)},${room.y.toFixed(1)}`, room);
  });

  const MIN_TURN_ANGLE = 45;
  const MIN_REAL_DIST_M = 4;
  const MIN_SLIGHT_ANGLE = 15;
  const MIN_SLIGHT_DIST_M = 15;

  const bearings: number[] = [];
  for (let i = 0; i < polylineWaypoints.length - 1; i++) {
    const dx = polylineWaypoints[i + 1].lat - polylineWaypoints[i].lat;
    const dy = polylineWaypoints[i + 1].lng - polylineWaypoints[i].lng;
    bearings.push(Math.atan2(dy, dx) * 180 / Math.PI);
  }

  let accumulatedPixels = 0;

  for (let i = 0; i < polylineWaypoints.length - 1; i++) {
    const dx = polylineWaypoints[i + 1].lat - polylineWaypoints[i].lat;
    const dy = polylineWaypoints[i + 1].lng - polylineWaypoints[i].lng;
    accumulatedPixels += Math.sqrt(dx * dx + dy * dy);
    const accumulatedMeters = accumulatedPixels * scale;
    const isLast = i === polylineWaypoints.length - 2;

    const wp = polylineWaypoints[i + 1];
    const coordKey = `${wp.lat.toFixed(1)},${wp.lng.toFixed(1)}`;
    const namedNode = nodeByCoord.get(coordKey);

    if (namedNode && (namedNode.type === 'stairway' || namedNode.type === 'elevator')) {
      const distStr = accumulatedMeters >= 1000
        ? `${(accumulatedMeters / 1000).toFixed(1)} km`
        : `${Math.round(accumulatedMeters)} m`;
      const verb = namedNode.type === 'elevator' ? 'Take the elevator' : 'Take the stairs';
      steps.push({ instruction: verb, distance: distStr, icon: namedNode.type === 'elevator' ? 'arrow-up' : 'stairs' });
      accumulatedPixels = 0;
      continue;
    }

    if (isLast) continue;

    if (i < bearings.length - 1) {
      const angleDiff = ((bearings[i + 1] - bearings[i] + 540) % 360) - 180;
      const absAngle = Math.abs(angleDiff);

      const isRealTurn = absAngle >= MIN_TURN_ANGLE && accumulatedMeters >= MIN_REAL_DIST_M;
      const isSlightTurn = absAngle >= MIN_SLIGHT_ANGLE && accumulatedMeters >= MIN_SLIGHT_DIST_M;

      if (isRealTurn || isSlightTurn) {
        const distStr = accumulatedMeters >= 1000
          ? `${(accumulatedMeters / 1000).toFixed(1)} km`
          : `${Math.round(accumulatedMeters)} m`;

        let instruction: string;
        let icon: string;
        if (absAngle < MIN_SLIGHT_ANGLE) {
          instruction = 'Continue straight down the hallway';
          icon = 'straight';
        } else if (absAngle < MIN_TURN_ANGLE) {
          instruction = angleDiff > 0 ? 'Slight right down the hallway' : 'Slight left down the hallway';
          icon = angleDiff > 0 ? 'slight-right' : 'slight-left';
        } else if (absAngle < 135) {
          instruction = angleDiff > 0 ? 'Turn right down the hallway' : 'Turn left down the hallway';
          icon = angleDiff > 0 ? 'right' : 'left';
        } else if (absAngle < 165) {
          instruction = angleDiff > 0 ? 'Sharp right down the hallway' : 'Sharp left down the hallway';
          icon = angleDiff > 0 ? 'sharp-right' : 'sharp-left';
        } else {
          instruction = 'Make a U-turn down the hallway';
          icon = 'u-turn';
        }

        steps.push({ instruction, distance: distStr, icon });
        accumulatedPixels = 0;
      }
    }
  }

  const remainingMeters = accumulatedPixels * scale;
  if (remainingMeters >= 1) {
    const distStr = remainingMeters >= 1000
      ? `${(remainingMeters / 1000).toFixed(1)} km`
      : `${Math.round(remainingMeters)} m`;
    steps.push({ instruction: 'Continue to destination down the hallway', distance: distStr, icon: 'straight' });
  }

  steps.push({ instruction: `Arrive at ${endLabel}`, distance: '0 m', icon: isMultiFloor ? 'arrow-up' : 'flag' });
  return steps;
}
