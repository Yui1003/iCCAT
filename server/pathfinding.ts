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

export function buildGraph(paths: (Walkpath | Drivepath)[]): {
  nodes: Map<string, GraphNode>,
  edges: Edge[]
} {
  const nodes = new Map<string, GraphNode>();
  const edges: Edge[] = [];

  console.log(`[DEBUG] Building graph from ${paths.length} paths`);

  paths.forEach((path) => {
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

  console.log(`[DEBUG] Before merge: ${nodes.size} nodes, ${edges.length} edges`);
  const merged = mergeNearbyNodes(nodes, edges, 10);
  console.log(`[DEBUG] After merge: ${merged.nodes.size} nodes, ${merged.edges.length} edges`);
  
  return { nodes: merged.nodes, edges: merged.edges };
}

function findClosestNode(
  point: LatLng,
  nodes: Map<string, GraphNode>
): string | null {
  let minDist = Infinity;
  let closest: string | null = null;

  nodes.forEach((node, key) => {
    const dist = calculateDistance(point.lat, point.lng, node.lat, node.lng);
    if (dist < minDist) {
      minDist = dist;
      closest = key;
    }
  });

  return closest;
}

export function findShortestPath(
  start: Building,
  end: Building,
  paths: (Walkpath | Drivepath)[]
): LatLng[] | null {
  const { nodes, edges } = buildGraph(paths);

  console.log(`[DEBUG] Pathfinding from "${start.name}" to "${end.name}"`);
  const startPoint = { lat: start.nodeLat ?? start.lat, lng: start.nodeLng ?? start.lng };
  const endPoint = { lat: end.nodeLat ?? end.lat, lng: end.nodeLng ?? end.lng };

  const startProjection = findClosestSegmentProjection(startPoint, paths);
  const endProjection = findClosestSegmentProjection(endPoint, paths);

  if (!startProjection || !endProjection) {
    console.log(`[DEBUG] Could not find projections for buildings`);
    return null;
  }

  let startProjKey = nodeKey(startProjection.lat, startProjection.lng);
  let endProjKey = nodeKey(endProjection.lat, endProjection.lng);
  const startKey = nodeKey(startPoint.lat, startPoint.lng);
  const endKey = nodeKey(endPoint.lat, endPoint.lng);
  
  console.log(`[DEBUG] Start projection: ${startProjKey.substring(0, 30)}... on path ${startProjection.pathIndex}`);
  console.log(`[DEBUG] End projection: ${endProjKey.substring(0, 30)}... on path ${endProjection.pathIndex}`);

  // Use the path network directly
  const augmentedNodes = new Map(nodes);
  let augmentedEdges = [...edges];

  // Add building nodes
  augmentedNodes.set(startKey, { id: startKey, lat: startPoint.lat, lng: startPoint.lng });
  augmentedNodes.set(endKey, { id: endKey, lat: endPoint.lat, lng: endPoint.lng });

  // Add projections to the graph if they don't exist
  [
    { key: startProjKey, ...startProjection },
    { key: endProjKey, ...endProjection }
  ].forEach(proj => {
    if (!augmentedNodes.has(proj.key)) {
      augmentedNodes.set(proj.key, { id: proj.key, lat: proj.lat, lng: proj.lng });
      
      const path = paths[proj.pathIndex];
      const pathNodes = path.nodes as LatLng[];
      const segStart = pathNodes[proj.segmentIndex];
      const segEnd = pathNodes[proj.segmentIndex + 1];
      const segStartKey = nodeKey(segStart.lat, segStart.lng);
      const segEndKey = nodeKey(segEnd.lat, segEnd.lng);

      // Connect projection to segment endpoints
      const distToStart = calculateDistance(proj.lat, proj.lng, segStart.lat, segStart.lng);
      const distToEnd = calculateDistance(proj.lat, proj.lng, segEnd.lat, segEnd.lng);

      if (distToStart > 0) {
        augmentedEdges.push({ from: proj.key, to: segStartKey, distance: distToStart });
        augmentedEdges.push({ from: segStartKey, to: proj.key, distance: distToStart });
      }
      if (distToEnd > 0) {
        augmentedEdges.push({ from: proj.key, to: segEndKey, distance: distToEnd });
        augmentedEdges.push({ from: segEndKey, to: proj.key, distance: distToEnd });
      }
    }
  });

  // Connect buildings to their projections
  const startToProjDist = calculateDistance(startPoint.lat, startPoint.lng, startProjection.lat, startProjection.lng);
  const endToProjDist = calculateDistance(endPoint.lat, endPoint.lng, endProjection.lat, endProjection.lng);

  augmentedEdges.push({ from: startKey, to: startProjKey, distance: startToProjDist });
  augmentedEdges.push({ from: startProjKey, to: startKey, distance: startToProjDist });
  augmentedEdges.push({ from: endKey, to: endProjKey, distance: endToProjDist });
  augmentedEdges.push({ from: endProjKey, to: endKey, distance: endToProjDist });

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
    console.warn(`WARNING: No road connection found between "${start.name}" and "${end.name}" - drivepaths are not connected!`);
    console.warn('TIP: Make sure your drivepaths share common waypoints to form junctions.');
    return [startPoint, endPoint];
  }

  // Reconstruct Dijkstra path
  const dijkstraPath: string[] = [];
  let current: string | null = endKey;

  while (current !== null) {
    dijkstraPath.unshift(current);
    current = previous.get(current) || null;
  }

  console.log(`[DEBUG] Dijkstra found ${dijkstraPath.length} key nodes`);

  // Trace the route following the segments
  const finalRoute: LatLng[] = [];
  for (let i = 0; i < dijkstraPath.length; i++) {
    const node = augmentedNodes.get(dijkstraPath[i]);
    if (node) finalRoute.push({ lat: node.lat, lng: node.lng });
  }

  console.log(`[DEBUG] ✅ Route found with ${finalRoute.length} points`);
  return finalRoute;
}
