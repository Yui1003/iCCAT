import type { LatLng, Building, Walkpath, Drivepath } from "@shared/schema";

interface Node {
  lat: number;
  lng: number;
}

interface GraphNode {
  id: string;
  lat: number;
  lng: number;
  pathId?: string;
}

interface Edge {
  from: string;
  to: string;
  distance: number;
}

/**
 * Simplify polyline using Ramer-Douglas-Peucker algorithm
 * Reduces unnecessary waypoints while maintaining route shape
 * @param points - Array of lat/lng points
 * @param tolerance - Distance tolerance in meters (default 5m)
 */
function simplifyPolyline(points: LatLng[], tolerance: number = 5): LatLng[] {
  if (points.length <= 2) return points;

  function perpendicularDistance(point: LatLng, lineStart: LatLng, lineEnd: LatLng): number {
    const dx = lineEnd.lng - lineStart.lng;
    const dy = lineEnd.lat - lineStart.lat;
    const numerator = Math.abs(dy * point.lng - dx * point.lat + lineEnd.lng * lineStart.lat - lineEnd.lat * lineStart.lng);
    const denominator = Math.sqrt(dx * dx + dy * dy);
    return denominator === 0 ? calculateDistance(point.lat, point.lng, lineStart.lat, lineStart.lng) : (numerator / denominator) * 111000; // convert to meters
  }

  let maxDist = 0;
  let maxIndex = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    const leftSide = simplifyPolyline(points.slice(0, maxIndex + 1), tolerance);
    const rightSide = simplifyPolyline(points.slice(maxIndex), tolerance);
    return leftSide.slice(0, -1).concat(rightSide);
  } else {
    return [points[0], points[points.length - 1]];
  }
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function nodeKey(lat: number, lng: number): string {
  return `${lat.toFixed(7)},${lng.toFixed(7)}`;
}

function projectPointOntoSegment(
  point: LatLng,
  segmentStart: LatLng,
  segmentEnd: LatLng
): { lat: number; lng: number; distance: number } {
  const dx = segmentEnd.lng - segmentStart.lng;
  const dy = segmentEnd.lat - segmentStart.lat;
  
  if (dx === 0 && dy === 0) {
    return {
      lat: segmentStart.lat,
      lng: segmentStart.lng,
      distance: calculateDistance(point.lat, point.lng, segmentStart.lat, segmentStart.lng)
    };
  }

  const t = Math.max(0, Math.min(1,
    ((point.lng - segmentStart.lng) * dx + (point.lat - segmentStart.lat) * dy) /
    (dx * dx + dy * dy)
  ));

  const projectedLat = segmentStart.lat + t * dy;
  const projectedLng = segmentStart.lng + t * dx;
  const distance = calculateDistance(point.lat, point.lng, projectedLat, projectedLng);

  return { lat: projectedLat, lng: projectedLng, distance };
}

function findClosestSegmentProjection(
  point: LatLng,
  paths: (Walkpath | Drivepath)[]
): { lat: number; lng: number; pathIndex: number; segmentIndex: number } | null {
  let minDistance = Infinity;
  let bestProjection: { lat: number; lng: number; pathIndex: number; segmentIndex: number } | null = null;

  paths.forEach((path, pathIndex) => {
    const pathNodes = path.nodes as LatLng[];
    for (let i = 0; i < pathNodes.length - 1; i++) {
      const projection = projectPointOntoSegment(point, pathNodes[i], pathNodes[i + 1]);
      if (projection.distance < minDistance) {
        minDistance = projection.distance;
        bestProjection = {
          lat: projection.lat,
          lng: projection.lng,
          pathIndex,
          segmentIndex: i
        };
      }
    }
  });

  return bestProjection;
}

function mergeNearbyNodes(
  nodes: Map<string, GraphNode>,
  edges: Edge[],
  snapThreshold: number = 10
): { nodes: Map<string, GraphNode>, edges: Edge[], nodeMapping: Map<string, string> } {
  const nodeArray = Array.from(nodes.entries());
  
  const parent = new Map<string, string>();
  nodeArray.forEach(([key]) => parent.set(key, key));
  
  function find(key: string): string {
    if (parent.get(key) !== key) {
      parent.set(key, find(parent.get(key)!));
    }
    return parent.get(key)!;
  }
  
  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootB, rootA);
    }
  }
  
  let mergeCount = 0;
  let skippedSamePathCount = 0;
  let missingPathIdCount = 0;
  for (let i = 0; i < nodeArray.length; i++) {
    const [keyA, nodeA] = nodeArray[i];
    for (let j = i + 1; j < nodeArray.length; j++) {
      const [keyB, nodeB] = nodeArray[j];
      const dist = calculateDistance(nodeA.lat, nodeA.lng, nodeB.lat, nodeB.lng);
      if (dist <= snapThreshold) {
        if (!nodeA.pathId || !nodeB.pathId) {
          missingPathIdCount++;
          console.warn(`[WARN] Skipping merge due to missing pathId: ${keyA.substring(0, 20)}... (${nodeA.pathId || 'MISSING'}) <-> ${keyB.substring(0, 20)}... (${nodeB.pathId || 'MISSING'})`);
          continue;
        }
        
        if (nodeA.pathId === nodeB.pathId) {
          skippedSamePathCount++;
          continue;
        }
        
        console.log(`[DEBUG] Merging nodes ${dist.toFixed(1)}m apart: ${keyA.substring(0, 20)}... <-> ${keyB.substring(0, 20)}... (pathIds: ${nodeA.pathId.substring(0, 8)} <-> ${nodeB.pathId.substring(0, 8)})`);
        union(keyA, keyB);
        mergeCount++;
      }
    }
  }
  console.log(`[DEBUG] Total nodes merged: ${mergeCount}, skipped same-path merges: ${skippedSamePathCount}, missing pathId: ${missingPathIdCount}`);
  
  const clusters = new Map<string, string[]>();
  nodeArray.forEach(([key]) => {
    const root = find(key);
    if (!clusters.has(root)) {
      clusters.set(root, []);
    }
    clusters.get(root)!.push(key);
  });
  
  const nodeMapping = new Map<string, string>();
  const mergedNodes = new Map<string, GraphNode>();
  
  clusters.forEach((clusterKeys, representative) => {
    let sumLat = 0;
    let sumLng = 0;
    const pathIds = new Set<string>();
    
    clusterKeys.forEach(key => {
      const node = nodes.get(key)!;
      sumLat += node.lat;
      sumLng += node.lng;
      if (node.pathId) {
        pathIds.add(node.pathId);
      }
      nodeMapping.set(key, representative);
    });
    
    const avgLat = sumLat / clusterKeys.length;
    const avgLng = sumLng / clusterKeys.length;
    
    const mergedNode: GraphNode = {
      id: representative,
      lat: avgLat,
      lng: avgLng
    };
    
    if (pathIds.size === 1) {
      mergedNode.pathId = Array.from(pathIds)[0];
    }
    
    mergedNodes.set(representative, mergedNode);
  });
  
  const mergedEdges: Edge[] = [];
  const edgeSet = new Set<string>();
  
  edges.forEach(edge => {
    const fromMapped = nodeMapping.get(edge.from) || edge.from;
    const toMapped = nodeMapping.get(edge.to) || edge.to;
    
    if (fromMapped === toMapped) return;
    
    const edgeKey = `${fromMapped}|${toMapped}`;
    const reverseKey = `${toMapped}|${fromMapped}`;
    
    if (!edgeSet.has(edgeKey) && !edgeSet.has(reverseKey)) {
      const fromNode = mergedNodes.get(fromMapped)!;
      const toNode = mergedNodes.get(toMapped)!;
      const distance = calculateDistance(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng);
      
      mergedEdges.push({ from: fromMapped, to: toMapped, distance });
      mergedEdges.push({ from: toMapped, to: fromMapped, distance });
      edgeSet.add(edgeKey);
      edgeSet.add(reverseKey);
    }
  });
  
  return { nodes: mergedNodes, edges: mergedEdges, nodeMapping };
}

function buildGraph(paths: (Walkpath | Drivepath)[], mode?: 'walking' | 'driving' | 'accessible'): {
  nodes: Map<string, GraphNode>,
  edges: Edge[]
} {
  const nodes = new Map<string, GraphNode>();
  const edges: Edge[] = [];

  // Filter paths based on travel mode
  let filteredPaths = paths;
  if (mode === 'accessible') {
    // Accessible mode: Include PWD-friendly paths OR strictly PWD-only paths
    filteredPaths = paths.filter(path => {
      const isPwdFriendly = (path as any).isPwdFriendly === true;
      const strictlyPwdOnly = (path as any).strictlyPwdOnly === true;
      return isPwdFriendly || strictlyPwdOnly;
    });
    console.log(`[CLIENT] Accessible mode: filtered to ${filteredPaths.length}/${paths.length} accessible paths (PWD-friendly OR strictly PWD-only)`);
  } else if (mode === 'walking') {
    // Walking mode: PWD-friendly AND regular paths, but CANNOT use strictly PWD-only paths
    filteredPaths = paths.filter(path => {
      const strictlyPwdOnly = (path as any).strictlyPwdOnly === true;
      return !strictlyPwdOnly;
    });
    console.log(`[CLIENT] Walking mode: filtered to ${filteredPaths.length}/${paths.length} walkpaths (excluded ${paths.length - filteredPaths.length} strictly-PWD-only paths)`);
  }

  console.log(`[CLIENT] Building graph from ${filteredPaths.length} paths`);

  filteredPaths.forEach((path) => {
    const pathNodes = path.nodes as LatLng[];
    
    pathNodes.forEach((node) => {
      const key = nodeKey(node.lat, node.lng);
      if (!nodes.has(key)) {
        nodes.set(key, { id: key, lat: node.lat, lng: node.lng, pathId: path.id });
      }
    });

    for (let i = 0; i < pathNodes.length - 1; i++) {
      const fromKey = nodeKey(pathNodes[i].lat, pathNodes[i].lng);
      const toKey = nodeKey(pathNodes[i + 1].lat, pathNodes[i + 1].lng);
      const distance = calculateDistance(
        pathNodes[i].lat,
        pathNodes[i].lng,
        pathNodes[i + 1].lat,
        pathNodes[i + 1].lng
      );

      edges.push({ from: fromKey, to: toKey, distance });
      edges.push({ from: toKey, to: fromKey, distance });
    }
  });

  console.log(`[CLIENT] Final graph: ${nodes.size} nodes, ${edges.length} edges`);
  console.log(`[CLIENT] ✅ NO node merging - using exact paths you created`);
  
  return { nodes, edges };
}

export function findShortestPath(
  start: Building,
  end: Building,
  paths: (Walkpath | Drivepath)[],
  mode?: 'walking' | 'driving' | 'accessible'
): LatLng[] | null {
  const { nodes, edges } = buildGraph(paths, mode);

  console.log(`[CLIENT] Pathfinding from "${start.name}" to "${end.name}"`);
  console.log(`[CLIENT] Graph has ${nodes.size} nodes and ${edges.length} edges`);
  
  const startPoint = { lat: start.lat, lng: start.lng };
  const endPoint = { lat: end.lat, lng: end.lng };

  // Find closest path nodes to start and end buildings
  let closestStartNode: { key: string; distance: number } | null = null;
  let closestEndNode: { key: string; distance: number } | null = null;

  nodes.forEach((node: GraphNode, key: string) => {
    const distToStart = calculateDistance(startPoint.lat, startPoint.lng, node.lat, node.lng);
    const distToEnd = calculateDistance(endPoint.lat, endPoint.lng, node.lat, node.lng);

    if (closestStartNode === null || distToStart < closestStartNode.distance) {
      closestStartNode = { key, distance: distToStart };
    }

    if (closestEndNode === null || distToEnd < closestEndNode.distance) {
      closestEndNode = { key, distance: distToEnd };
    }
  });

  if (!closestStartNode || !closestEndNode) {
    console.warn(`[CLIENT] Could not find path nodes: start=${closestStartNode !== null}, end=${closestEndNode !== null}`);
    return null;
  }

  const startNodeData = closestStartNode as { key: string; distance: number };
  const endNodeData = closestEndNode as { key: string; distance: number };

  console.log(`[CLIENT] Closest start node: ${startNodeData.distance.toFixed(1)}m away`);
  console.log(`[CLIENT] Closest end node: ${endNodeData.distance.toFixed(1)}m away`);

  const startKey = startNodeData.key;
  const endKey = endNodeData.key;

  // Use the path network directly without projections
  const augmentedNodes = new Map(nodes);
  const augmentedEdges = [...edges];

  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const unvisited = new Set<string>();

  augmentedNodes.forEach((_, key) => {
    distances.set(key, Infinity);
    previous.set(key, null);
    unvisited.add(key);
  });

  distances.set(startKey, 0);

  while (unvisited.size > 0) {
    let current: string | null = null;
    let minDist = Infinity;

    unvisited.forEach((key) => {
      const dist = distances.get(key)!;
      if (dist < minDist) {
        minDist = dist;
        current = key;
      }
    });

    if (current === null || current === endKey) {
      break;
    }

    unvisited.delete(current);

    const neighbors = augmentedEdges.filter(e => e.from === current);

    neighbors.forEach(edge => {
      if (!unvisited.has(edge.to)) return;

      const alt = distances.get(current!)! + edge.distance;
      if (alt < distances.get(edge.to)!) {
        distances.set(edge.to, alt);
        previous.set(edge.to, current);
      }
    });
  }

  if (distances.get(endKey) === Infinity || (previous.get(endKey) === undefined && endKey !== startKey)) {
    console.warn(`[CLIENT] WARNING: No road connection found between "${start.name}" and "${end.name}" - paths are not connected!`);
    console.warn('[CLIENT] TIP: Make sure your paths share common waypoints to form junctions.');
    
    // In accessible mode, do NOT allow fallback direct line - the destination must be reachable via actual paths
    if (mode === 'accessible') {
      console.warn(`[CLIENT] ACCESSIBLE MODE: Destination building is not connected to accessible path network - treating as unreachable`);
      return null;
    }
    
    // For other modes, allow fallback to direct line (legacy behavior for walking/driving)
    return [startPoint, endPoint];
  }

  // Reconstruct Dijkstra path (just the key nodes)
  const dijkstraPath: string[] = [];
  let current: string | null = endKey;

  while (current !== null) {
    dijkstraPath.unshift(current);
    current = previous.get(current) || null;
  }

  console.log(`[CLIENT] Dijkstra found ${dijkstraPath.length} key nodes`);

  // Now expand the path to include ALL waypoints along the segments
  const expandedRoute: LatLng[] = [];

  // Helper function to find segment index for a node key
  function findSegmentForNodeInPath(path: Walkpath | Drivepath, searchKey: string): number {
    const pathNodes = path.nodes as LatLng[];
    for (let i = 0; i < pathNodes.length; i++) {
      if (nodeKey(pathNodes[i].lat, pathNodes[i].lng) === searchKey) {
        return i;
      }
    }
    return -1;
  }

  // Helper to get all waypoints between two nodes on a path
  function getWaypointsBetweenNodes(path: Walkpath | Drivepath, fromKey: string, toKey: string): LatLng[] {
    const pathNodes = path.nodes as LatLng[];
    const fromIdx = findSegmentForNodeInPath(path, fromKey);
    const toIdx = findSegmentForNodeInPath(path, toKey);
    
    if (fromIdx === -1 || toIdx === -1) return [];
    
    const waypoints: LatLng[] = [];
    if (fromIdx <= toIdx) {
      for (let i = fromIdx; i <= toIdx; i++) {
        waypoints.push(pathNodes[i]);
      }
    } else {
      for (let i = fromIdx; i >= toIdx; i--) {
        waypoints.push(pathNodes[i]);
      }
    }
    return waypoints;
  }

  // For each consecutive pair of nodes in Dijkstra path, find and trace all waypoints between them
  for (let i = 0; i < dijkstraPath.length - 1; i++) {
    const fromKey = dijkstraPath[i];
    const toKey = dijkstraPath[i + 1];

    let segmentWaypoints: LatLng[] = [];
    
    // Find the path(s) that contain these nodes and get all waypoints between them
    for (const path of paths) {
      const pathNodes = path.nodes as LatLng[];
      const fromIdx = findSegmentForNodeInPath(path, fromKey);
      const toIdx = findSegmentForNodeInPath(path, toKey);
      
      // If both nodes are in this path, get all waypoints between them
      if (fromIdx !== -1 && toIdx !== -1) {
        if (fromIdx <= toIdx) {
          // Forward direction
          for (let k = fromIdx; k <= toIdx; k++) {
            segmentWaypoints.push(pathNodes[k]);
          }
        } else {
          // Backward direction
          for (let k = fromIdx; k >= toIdx; k--) {
            segmentWaypoints.push(pathNodes[k]);
          }
        }
        break;
      }
    }

    // Add all waypoints from this segment
    for (const wp of segmentWaypoints) {
      if (expandedRoute.length === 0 || 
          Math.abs(wp.lat - expandedRoute[expandedRoute.length - 1].lat) > 0.00001 ||
          Math.abs(wp.lng - expandedRoute[expandedRoute.length - 1].lng) > 0.00001) {
        expandedRoute.push(wp);
      }
    }
  }

  // Add final destination
  if (expandedRoute.length === 0) {
    expandedRoute.push(startPoint);
  }

  const finalRoute = [startPoint, ...expandedRoute.slice(1), endPoint];

  console.log(`[CLIENT] ✅ Route found: Dijkstra ${dijkstraPath.length} nodes → Expanded ${expandedRoute.length} waypoints → Final ${finalRoute.length} with buildings`);
  
  return finalRoute;
}

/**
 * Find the furthest accessible endpoint along paths toward a destination
 * When no complete accessible path exists to the destination building,
 * trace as far as possible and return the final reachable endpoint
 */
export function findFurthestAccessiblePoint(
  start: Building,
  destination: Building,
  paths: (Walkpath | Drivepath)[]
): LatLng | null {
  // Try to find complete route first
  const completeRoute = findShortestPath(start, destination, paths, 'accessible');
  if (completeRoute && completeRoute.length > 0) {
    // Complete path exists, so this function shouldn't be called
    console.log('[CLIENT] Complete accessible path exists to destination');
    return null;
  }

  // No complete route - trace accessible paths as far as possible
  const { nodes: accessibleNodes, edges: accessibleEdges } = buildGraph(paths, 'accessible');
  
  if (accessibleNodes.size === 0) {
    console.log('[CLIENT] No accessible paths available');
    return null;
  }

  // Find the starting node (closest to start building)
  const nodeArray = Array.from(accessibleNodes.values());
  let startNode = nodeArray[0];
  let startNodeDist = calculateDistance(start.lat, start.lng, startNode.lat, startNode.lng);
  
  for (const node of nodeArray) {
    const dist = calculateDistance(start.lat, start.lng, node.lat, node.lng);
    if (dist < startNodeDist) {
      startNodeDist = dist;
      startNode = node;
    }
  }

  // Use Dijkstra to find paths from start within accessible network
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const unvisited = new Set<string>();

  const nodeIds = Array.from(accessibleNodes.keys());
  for (const nodeId of nodeIds) {
    distances.set(nodeId, Infinity);
    unvisited.add(nodeId);
  }

  const startNodeId = nodeKey(startNode.lat, startNode.lng);
  distances.set(startNodeId, 0);

  while (unvisited.size > 0) {
    let current: string | null = null;
    let minDist = Infinity;

    const unvisitedArray = Array.from(unvisited);
    for (const nodeId of unvisitedArray) {
      const dist = distances.get(nodeId) ?? Infinity;
      if (dist < minDist) {
        minDist = dist;
        current = nodeId;
      }
    }

    if (current === null || minDist === Infinity) break;
    unvisited.delete(current);

    // Check edges from current node
    for (const edge of accessibleEdges) {
      if (edge.from === current && unvisited.has(edge.to)) {
        const newDist = (distances.get(current) ?? Infinity) + edge.distance;
        if (newDist < (distances.get(edge.to) ?? Infinity)) {
          distances.set(edge.to, newDist);
          previous.set(edge.to, current);
        }
      }
    }
  }

  // Find the accessible node furthest toward destination
  let furthestNode: GraphNode | null = null;
  let maxProgress = -1;

  for (const node of nodeArray) {
    const nodeId = nodeKey(node.lat, node.lng);
    if (!distances.has(nodeId) || distances.get(nodeId) === Infinity) continue;

    // Calculate progress toward destination
    const distToNode = calculateDistance(start.lat, start.lng, node.lat, node.lng);
    const distNodeToDest = calculateDistance(node.lat, node.lng, destination.lat, destination.lng);
    const distStartToDest = calculateDistance(start.lat, start.lng, destination.lat, destination.lng);
    
    // Progress is: (distance we traveled toward destination) / (total distance to destination)
    const directDist = calculateDistance(start.lat, start.lng, node.lat, node.lng);
    const distToDestFromNode = calculateDistance(node.lat, node.lng, destination.lat, destination.lng);
    const progress = 1 - (distToDestFromNode / distStartToDest); // Higher = closer to destination

    if (progress > maxProgress) {
      maxProgress = progress;
      furthestNode = node;
    }
  }

  if (furthestNode) {
    console.log(`[CLIENT] ✅ Furthest accessible endpoint found: (${furthestNode.lat.toFixed(5)}, ${furthestNode.lng.toFixed(5)}), progress to destination: ${(maxProgress * 100).toFixed(0)}%`);
    return { lat: furthestNode.lat, lng: furthestNode.lng };
  }

  console.log('[CLIENT] ❌ No accessible endpoints found toward destination');
  return null;
}

/**
 * Check if a destination building is actually connected to the accessible path network
 * A building is "connected" if there are accessible path nodes within 3 meters of it
 * (not just nearby, but actually AT the building location)
 */
export function isDestinationConnectedToAccessibleNetwork(
  destination: Building,
  paths: (Walkpath | Drivepath)[]
): boolean {
  const CONNECTION_THRESHOLD = 3; // meters - building is "connected" if nodes within this distance

  // Filter to only accessible paths
  const accessiblePaths = paths.filter(path => {
    const isPwdFriendly = (path as any).isPwdFriendly === true;
    const strictlyPwdOnly = (path as any).strictlyPwdOnly === true;
    return isPwdFriendly || strictlyPwdOnly;
  });

  if (accessiblePaths.length === 0) {
    console.log('[CLIENT] ❌ No accessible paths available at all');
    return false;
  }

  // Check if any accessible path node is actually AT the destination building
  for (const path of accessiblePaths) {
    const pathNodes = path.nodes as LatLng[];
    for (const node of pathNodes) {
      const distToNode = calculateDistance(destination.lat, destination.lng, node.lat, node.lng);
      if (distToNode <= CONNECTION_THRESHOLD) {
        console.log(`[CLIENT] ✅ Destination IS connected to accessible network: node ${distToNode.toFixed(1)}m away`);
        return true;
      }
    }
  }

  console.log(`[CLIENT] ❌ Destination is NOT connected to accessible network (closest node >3m away)`);
  return false;
}

/**
 * Find the nearest endpoint of any accessible path to an unreachable destination building
 * This is used when a building has no connected accessible path - we navigate to the closest path endpoint instead
 */
export function findNearestAccessibleEndpoint(
  destination: Building,
  paths: (Walkpath | Drivepath)[]
): LatLng | null {
  // Filter to only accessible paths
  const accessiblePaths = paths.filter(path => {
    const isPwdFriendly = (path as any).isPwdFriendly === true;
    const strictlyPwdOnly = (path as any).strictlyPwdOnly === true;
    return isPwdFriendly || strictlyPwdOnly;
  });

  if (accessiblePaths.length === 0) {
    console.log('[CLIENT] No accessible paths available');
    return null;
  }

  // Collect all endpoints from all accessible paths
  let nearestEndpoint: LatLng | null = null;
  let minDistance = Infinity;

  for (const path of accessiblePaths) {
    const pathNodes = path.nodes as LatLng[];
    if (pathNodes.length < 2) continue;

    // Check first node
    const firstNode = pathNodes[0];
    const distToFirst = calculateDistance(destination.lat, destination.lng, firstNode.lat, firstNode.lng);
    if (distToFirst < minDistance) {
      minDistance = distToFirst;
      nearestEndpoint = firstNode;
    }

    // Check last node
    const lastNode = pathNodes[pathNodes.length - 1];
    const distToLast = calculateDistance(destination.lat, destination.lng, lastNode.lat, lastNode.lng);
    if (distToLast < minDistance) {
      minDistance = distToLast;
      nearestEndpoint = lastNode;
    }
  }

  if (nearestEndpoint) {
    console.log(`[CLIENT] ✅ Nearest accessible endpoint found: (${nearestEndpoint.lat.toFixed(5)}, ${nearestEndpoint.lng.toFixed(5)}), ${minDistance.toFixed(1)}m from destination`);
    return nearestEndpoint;
  }

  console.log('[CLIENT] ❌ No accessible path endpoints found');
  return null;
}
