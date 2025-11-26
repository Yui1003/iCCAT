import type { Room, IndoorNode, RoomPath, Floor, Building } from "@shared/schema";

interface IndoorGraph {
  nodes: Map<string, { id: string; x: number; y: number; type: string; floorId: string }>;
  edges: Array<{ from: string; to: string; distance: number }>;
  waypointNodeMap: Map<string, Array<{ x: number; y: number }>>; // Maps node keys to their waypoints for extraction
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
  const waypointNodeMap = new Map<string, Array<{ x: number; y: number }>>();
  const wpNodeMapping = new Map<string, string>(); // Maps waypoint coordinate key to node key

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

  // First pass: find all unique waypoint coordinates to merge them
  const coordKeyToNodeId = new Map<string, string>(); // Maps "x,y" to final node key
  
  // Create COMPLETE waypoint graph from all room paths
  // This connects EVERY waypoint, not just those with nodeIds
  roomPaths.forEach((path, pathIndex) => {
    const waypoints = path.waypoints as RoomPathWaypoint[];
    if (!waypoints || waypoints.length < 1) return;

    // Create nodes for each waypoint (with or without nodeId)
    const waypointNodes: string[] = [];
    
    waypoints.forEach((wp, wpIndex) => {
      let nodeId: string;
      
      if (wp.nodeId) {
        // Waypoint already has a nodeId (clicking on an indoor node)
        nodeId = nodeKey(wp.nodeId, path.floorId);
      } else {
        // Check if we already have a node at this coordinate
        const coordKey = `${wp.x.toFixed(1)},${wp.y.toFixed(1)}`;
        
        if (coordKeyToNodeId.has(coordKey)) {
          // Reuse existing waypoint node at same coordinate
          nodeId = coordKeyToNodeId.get(coordKey)!;
        } else {
          // Create new virtual node for this waypoint coordinate
          nodeId = `${path.floorId}:waypoint:${pathIndex}:${wpIndex}`;
          coordKeyToNodeId.set(coordKey, nodeId);
          
          // Create the virtual node if it doesn't exist
          if (!nodes.has(nodeId)) {
            nodes.set(nodeId, {
              id: nodeId,
              x: wp.x,
              y: wp.y,
              type: 'waypoint',
              floorId: path.floorId
            });
          }
        }
      }
      
      waypointNodes.push(nodeId);
    });

    // Create edges between consecutive waypoints
    for (let i = 0; i < waypointNodes.length - 1; i++) {
      const fromKey = waypointNodes[i];
      const toKey = waypointNodes[i + 1];
      
      const w1 = waypoints[i];
      const w2 = waypoints[i + 1];
      const pixelDist = pixelDistance(w1.x, w1.y, w2.x, w2.y);
      const meterDist = pixelDist * pixelToMeterScale;
      
      edges.push({ from: fromKey, to: toKey, distance: meterDist });
      edges.push({ from: toKey, to: fromKey, distance: meterDist });
    }

    // Map waypoints to their node keys for extraction later
    for (let i = 0; i < waypointNodes.length; i++) {
      const nodeKey_str = waypointNodes[i];
      if (!waypointNodeMap.has(nodeKey_str)) {
        waypointNodeMap.set(nodeKey_str, []);
      }
      waypointNodeMap.get(nodeKey_str)!.push(waypoints[i]);
    }
  });

  // Add vertical connections (stairways/elevators between floors)
  indoorNodes.forEach(node => {
    if ((node.type === 'stairway' || node.type === 'elevator') && (node.connectedFloorIds?.length ?? 0) > 0) {
      const currentKey = nodeKey(node.id, node.floorId);
      const connectedFloors = node.connectedFloorIds || [];

      connectedFloors.forEach(connectedFloorId => {
        const connectedNode = indoorNodes.find(n => 
          n.id === node.id && n.floorId === connectedFloorId
        );

        if (connectedNode) {
          const connectedKey = nodeKey(connectedNode.id, connectedFloorId);
          const verticalDistance = 5;

          edges.push({ from: currentKey, to: connectedKey, distance: verticalDistance });
          edges.push({ from: connectedKey, to: currentKey, distance: verticalDistance });
        }
      });
    }
  });

  return { nodes, edges, waypointNodeMap };
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
