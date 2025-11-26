import type { Room, IndoorNode, RoomPath, Floor, Building } from "@shared/schema";

interface IndoorGraph {
  nodes: Map<string, { id: string; x: number; y: number; type: string; floorId: string }>;
  edges: Array<{ from: string; to: string; distance: number; pathWaypoints: Array<{ x: number; y: number }> }>;
  roomPaths: RoomPath[];
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
  const edges: Array<{ from: string; to: string; distance: number; pathWaypoints: Array<{ x: number; y: number }> }> = [];
  const coordKeyToNodeId = new Map<string, string>(); // Maps "x,y" to final node key

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

  // Create COMPLETE waypoint graph from all room paths
  roomPaths.forEach((path, pathIndex) => {
    const waypoints = path.waypoints as RoomPathWaypoint[];
    if (!waypoints || waypoints.length < 1) return;

    // Create nodes for each waypoint
    const waypointNodes: string[] = [];
    
    waypoints.forEach((wp, wpIndex) => {
      let nodeId: string;
      
      if (wp.nodeId) {
        nodeId = nodeKey(wp.nodeId, path.floorId);
      } else {
        // Merge waypoints at same coordinates
        const coordKey = `${wp.x.toFixed(1)},${wp.y.toFixed(1)}`;
        
        if (coordKeyToNodeId.has(coordKey)) {
          nodeId = coordKeyToNodeId.get(coordKey)!;
        } else {
          nodeId = `${path.floorId}:waypoint:${pathIndex}:${wpIndex}`;
          coordKeyToNodeId.set(coordKey, nodeId);
          
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

    // Create edges with full waypoint lists
    for (let i = 0; i < waypointNodes.length - 1; i++) {
      const fromKey = waypointNodes[i];
      const toKey = waypointNodes[i + 1];
      
      // Extract waypoints from start to end index
      const edgeWaypoints = waypoints.slice(i, i + 2);
      
      const w1 = waypoints[i];
      const w2 = waypoints[i + 1];
      const pixelDist = pixelDistance(w1.x, w1.y, w2.x, w2.y);
      const meterDist = pixelDist * pixelToMeterScale;
      
      edges.push({ from: fromKey, to: toKey, distance: meterDist, pathWaypoints: edgeWaypoints });
      edges.push({ from: toKey, to: fromKey, distance: meterDist, pathWaypoints: [...edgeWaypoints].reverse() });
    }
  });

  // Connect rooms and indoor nodes to the closest waypoint on any path
  // This bridges rooms/nodes to the waypoint graph so pathfinding can route through it
  const allRoomsAndNodes = [
    ...rooms.map(r => ({ ...r, type: 'room', floorId: r.floorId, x: r.x, y: r.y })),
    ...indoorNodes.map(n => ({ ...n, type: n.type, floorId: n.floorId, x: n.x, y: n.y }))
  ];

  allRoomsAndNodes.forEach((entity: any) => {
    const entityKey = nodeKey(entity.id, entity.floorId);
    if (!nodes.has(entityKey)) return;

    // Find the closest waypoint on any path for this entity's floor
    let closestWaypoint: { nodeKey: string; distance: number } | null = null;

    roomPaths.forEach((path, pathIndex) => {
      if (path.floorId !== entity.floorId) return;

      const waypoints = path.waypoints as RoomPathWaypoint[];
      waypoints.forEach((wp, wpIndex) => {
        let waypointNodeKey: string;

        if (wp.nodeId) {
          waypointNodeKey = nodeKey(wp.nodeId, path.floorId);
        } else {
          const coordKey = `${wp.x.toFixed(1)},${wp.y.toFixed(1)}`;
          waypointNodeKey = coordKeyToNodeId.get(coordKey) || `${path.floorId}:waypoint:${pathIndex}:${wpIndex}`;
        }

        const dist = pixelDistance(entity.x, entity.y, wp.x, wp.y);
        if (!closestWaypoint || dist < closestWaypoint.distance) {
          closestWaypoint = { nodeKey: waypointNodeKey, distance: dist };
        }
      });
    });

    // Connect the entity to the closest waypoint if one exists
    if (closestWaypoint) {
      const meterDist = closestWaypoint.distance * pixelToMeterScale;
      edges.push({ from: entityKey, to: closestWaypoint.nodeKey, distance: meterDist, pathWaypoints: [] });
      edges.push({ from: closestWaypoint.nodeKey, to: entityKey, distance: meterDist, pathWaypoints: [] });
    }
  });

  // Add vertical connections
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
          edges.push({ from: currentKey, to: connectedKey, distance: 5, pathWaypoints: [] });
          edges.push({ from: connectedKey, to: currentKey, distance: 5, pathWaypoints: [] });
        }
      });
    }
  });

  return { nodes, edges, roomPaths };
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
