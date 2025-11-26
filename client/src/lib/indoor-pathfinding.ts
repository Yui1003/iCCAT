import type { Room, IndoorNode, RoomPath, Floor, Building } from "@shared/schema";

interface IndoorGraph {
  nodes: Map<string, { id: string; x: number; y: number; type: string; floorId: string }>;
  edges: Array<{ from: string; to: string; distance: number }>;
}

interface RoomPathWaypoint {
  x: number;
  y: number;
  nodeId?: string;
}

function pixelDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function nodeKey(id: string, floorId: string): string {
  return `${floorId}:${id}`;
}

export function buildIndoorGraph(
  rooms: Room[],
  indoorNodes: IndoorNode[],
  roomPaths: RoomPath[],
  pixelToMeterScale: number = 0.02
): IndoorGraph {
  const nodes = new Map<string, { id: string; x: number; y: number; type: string; floorId: string }>();
  const edges: Array<{ from: string; to: string; distance: number }> = [];

  // Add rooms as nodes
  rooms.forEach(room => {
    const key = nodeKey(room.id, room.floorId);
    nodes.set(key, {
      id: room.id,
      x: room.x,
      y: room.y,
      type: 'room',
      floorId: room.floorId
    });
  });

  // Add indoor nodes as nodes
  indoorNodes.forEach(node => {
    const key = nodeKey(node.id, node.floorId);
    nodes.set(key, {
      id: node.id,
      x: node.x,
      y: node.y,
      type: node.type,
      floorId: node.floorId
    });
  });

  // Create edges from room paths (connect waypoints)
  roomPaths.forEach((path, pathIndex) => {
    const waypoints = path.waypoints as RoomPathWaypoint[];
    if (!waypoints || waypoints.length < 2) return;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const w1 = waypoints[i];
      const w2 = waypoints[i + 1];
      
      const pixelDist = pixelDistance(w1.x, w1.y, w2.x, w2.y);
      const meterDist = pixelDist * pixelToMeterScale;
      
      let key1: string;
      let key2: string;
      
      // If waypoints have nodeIds, use them; otherwise create virtual waypoint nodes
      if (w1.nodeId) {
        key1 = nodeKey(w1.nodeId, path.floorId);
      } else {
        // Create virtual node for waypoint
        key1 = `${path.floorId}:waypoint:${pathIndex}:${i}`;
        if (!nodes.has(key1)) {
          nodes.set(key1, {
            id: key1,
            x: w1.x,
            y: w1.y,
            type: 'waypoint',
            floorId: path.floorId
          });
        }
      }
      
      if (w2.nodeId) {
        key2 = nodeKey(w2.nodeId, path.floorId);
      } else {
        // Create virtual node for waypoint
        key2 = `${path.floorId}:waypoint:${pathIndex}:${i + 1}`;
        if (!nodes.has(key2)) {
          nodes.set(key2, {
            id: key2,
            x: w2.x,
            y: w2.y,
            type: 'waypoint',
            floorId: path.floorId
          });
        }
      }
      
      // Create bidirectional edges between consecutive waypoints
      edges.push({ from: key1, to: key2, distance: meterDist });
      edges.push({ from: key2, to: key1, distance: meterDist });
    }
  });

  // Add vertical connections (stairways/elevators between floors)
  indoorNodes.forEach(node => {
    if ((node.type === 'stairway' || node.type === 'elevator') && (node.connectedFloorIds?.length ?? 0) > 0) {
      const currentKey = nodeKey(node.id, node.floorId);
      const connectedFloors = node.connectedFloorIds || [];
      
      // Connect to same node on other floors
      connectedFloors.forEach(connectedFloorId => {
        const connectedNode = indoorNodes.find(n => 
          n.id === node.id && n.floorId === connectedFloorId
        );
        
        if (connectedNode) {
          const connectedKey = nodeKey(connectedNode.id, connectedFloorId);
          const verticalDistance = 5; // 5 meters per floor for stairway/elevator
          
          edges.push({ from: currentKey, to: connectedKey, distance: verticalDistance });
          edges.push({ from: connectedKey, to: currentKey, distance: verticalDistance });
        }
      });
    }
  });

  return { nodes, edges };
}

export function findRoomPath(
  startRoom: Room,
  endRoom: Room,
  indoorGraph: IndoorGraph
): string[] | null {
  if (startRoom.floorId !== endRoom.floorId) {
    console.warn("Rooms on different floors - would need stairway/elevator routing");
    return null;
  }

  const { nodes, edges } = indoorGraph;
  const startKey = nodeKey(startRoom.id, startRoom.floorId);
  const endKey = nodeKey(endRoom.id, endRoom.floorId);

  if (!nodes.has(startKey) || !nodes.has(endKey)) {
    return null;
  }

  // Simple Dijkstra's algorithm
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const unvisited = new Set<string>();

  nodes.forEach((_, key) => {
    distances.set(key, Infinity);
    previous.set(key, null);
    unvisited.add(key);
  });

  distances.set(startKey, 0);

  while (unvisited.size > 0) {
    let current: string | null = null;
    let minDist = Infinity;

    unvisited.forEach(key => {
      const dist = distances.get(key) || Infinity;
      if (dist < minDist) {
        minDist = dist;
        current = key;
      }
    });

    if (!current || current === endKey) break;
    unvisited.delete(current);

    edges
      .filter(e => e.from === current)
      .forEach(edge => {
        if (unvisited.has(edge.to)) {
          const alt = (distances.get(current!) || Infinity) + edge.distance;
          if (alt < (distances.get(edge.to) || Infinity)) {
            distances.set(edge.to, alt);
            previous.set(edge.to, current!);
          }
        }
      });
  }

  if (distances.get(endKey) === Infinity) {
    return null;
  }

  // Reconstruct path
  const path: string[] = [];
  let current: string | null = endKey;

  while (current !== null) {
    path.unshift(current);
    current = previous.get(current) || null;
  }

  return path;
}

export function connectOutdoorToIndoor(
  buildingId: string,
  buildings: Building[],
  indoorNodes: IndoorNode[],
  rooms: Room[]
): Array<{ outdoor: Building; indoor: Room; distance: number }> {
  const building = buildings.find(b => b.id === buildingId);
  if (!building) return [];

  // Find entrances for this building
  const entrances = indoorNodes.filter(n => n.type === 'entrance' && rooms.find(r => r.buildingId === buildingId && r.floorId === n.floorId));
  
  // Find rooms in the building
  const buildingRooms = rooms.filter(r => r.buildingId === buildingId);

  const connections = entrances
    .map(entrance => {
      const closestRoom = buildingRooms.reduce<{ room: Room; distance: number } | null>((closest, room) => {
        if (room.floorId !== entrance.floorId) return closest;
        
        const dist = Math.sqrt(Math.pow(room.x - entrance.x, 2) + Math.pow(room.y - entrance.y, 2));
        if (!closest) return { room, distance: dist };
        
        return dist < closest.distance ? { room, distance: dist } : closest;
      }, null);

      return closestRoom 
        ? { outdoor: building, indoor: closestRoom.room, distance: closestRoom.distance }
        : null;
    })
    .filter((conn): conn is { outdoor: Building; indoor: Room; distance: number } => conn !== null);
    
  return connections;
}
