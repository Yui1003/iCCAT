import type { LatLng, Building, Walkpath, Drivepath } from "@shared/schema";

/**
 * Calculate distance between two points in meters
 */
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

function buildGraph(paths: (Walkpath | Drivepath)[], mode?: 'walking' | 'driving' | 'accessible'): {
  nodes: Map<string, GraphNode>,
  edges: Edge[]
} {
  const nodes = new Map<string, GraphNode>();
  const edges: Edge[] = [];

  let filteredPaths = paths;
  if (mode === 'accessible') {
    filteredPaths = paths.filter(path => (path as any).isPwdFriendly === true || (path as any).strictlyPwdOnly === true);
  } else if (mode === 'walking') {
    filteredPaths = paths.filter(path => !(path as any).strictlyPwdOnly === true);
  }

  filteredPaths.forEach((path) => {
    const pathNodes = path.nodes as LatLng[];
    
    // Add nodes
    pathNodes.forEach((node) => {
      const key = nodeKey(node.lat, node.lng);
      if (!nodes.has(key)) {
        nodes.set(key, { id: key, lat: node.lat, lng: node.lng, pathId: path.id });
      }
    });

    // Add edges
    for (let i = 0; i < pathNodes.length - 1; i++) {
      const fromKey = nodeKey(pathNodes[i].lat, pathNodes[i].lng);
      const toKey = nodeKey(pathNodes[i + 1].lat, pathNodes[i + 1].lng);
      const distance = calculateDistance(pathNodes[i].lat, pathNodes[i].lng, pathNodes[i + 1].lat, pathNodes[i + 1].lng);
      edges.push({ from: fromKey, to: toKey, distance });
      edges.push({ from: toKey, to: fromKey, distance });
    }
  });

  return { nodes, edges };
}

function dijkstra(
  startNode: string,
  endNode: string,
  nodes: Map<string, GraphNode>,
  edges: Edge[],
  removedEdges: Set<string> = new Set()
): { path: string[], distance: number } | null {
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const unvisited = new Set<string>();

  nodes.forEach((_, key) => {
    distances.set(key, Infinity);
    previous.set(key, null);
    unvisited.add(key);
  });

  distances.set(startNode, 0);

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

    if (current === null || current === endNode) break;
    unvisited.delete(current);

    const neighbors = edges.filter(e => e.from === current && !removedEdges.has(`${e.from}|${e.to}`));
    neighbors.forEach(edge => {
      if (!unvisited.has(edge.to)) return;
      const alt = distances.get(current!)! + edge.distance;
      if (alt < distances.get(edge.to)!) {
        distances.set(edge.to, alt);
        previous.set(edge.to, current);
      }
    });
  }

  if (distances.get(endNode) === Infinity) return null;

  const path: string[] = [];
  let curr: string | null = endNode;
  while (curr !== null) {
    path.unshift(curr);
    curr = previous.get(curr) || null;
  }

  return { path, distance: distances.get(endNode)! };
}

/**
 * Enhanced Yen's Algorithm with edge penalties for better route diversity
 */
export function findAlternativePaths(
  start: Building,
  end: Building,
  paths: (Walkpath | Drivepath)[],
  mode: 'walking' | 'driving' | 'accessible' = 'walking',
  k: number = 3
): LatLng[][] {
  const { nodes, edges } = buildGraph(paths, mode);
  const startPoint = { lat: start.nodeLat ?? start.lat, lng: start.nodeLng ?? start.lng };
  const endPoint = { lat: end.nodeLat ?? end.lat, lng: end.nodeLng ?? end.lng };
  const startKey = nodeKey(startPoint.lat, startPoint.lng);
  const endKey = nodeKey(endPoint.lat, endPoint.lng);

  // Quick check for basic Dijkstra
  const best = dijkstra(startKey, endKey, nodes, edges);
  if (!best) return [];

  const resultSet: { path: string[], distance: number }[] = [best];
  const potentialPaths: { path: string[], distance: number }[] = [];

  // Distance strategy target thresholds
  const targetThresholds = [
    { min: 0, max: 0, label: "Shortest" },      // Option 1
    { min: 5, max: 10, label: "5-10m diff" },   // Option 2
    { min: 11, max: Infinity, label: "11m+" }  // Option 3
  ];

  // Edge usage map to track which segments are already in routes
  const edgeUsage = new Map<string, number>();
  best.path.forEach((node, idx) => {
    if (idx < best.path.length - 1) {
      const key = `${node}|${best.path[idx+1]}`;
      const revKey = `${best.path[idx+1]}|${node}`;
      edgeUsage.set(key, (edgeUsage.get(key) || 0) + 1);
      edgeUsage.set(revKey, (edgeUsage.get(revKey) || 0) + 1);
    }
  });

  // Generate more potential paths to filter through
  const maxIterations = k * 10; 
  for (let i = 1; i < maxIterations; i++) {
    // If we have enough candidates for all buckets, we can stop early
    const bucketsFilled = targetThresholds.every(threshold => {
      if (threshold.min === 0) return true; // Shortest is already in resultSet[0]
      const diff = threshold.min;
      return resultSet.some(r => r.distance - best.distance >= threshold.min && r.distance - best.distance <= threshold.max) ||
             potentialPaths.some(p => p.distance - best.distance >= threshold.min && p.distance - best.distance <= threshold.max);
    });
    
    if (bucketsFilled && resultSet.length >= k) break;

    const previousPath = resultSet[Math.min(i - 1, resultSet.length - 1)].path;
    // Diversity optimization: increase penalty on used edges
    for (let j = 0; j < previousPath.length - 1; j++) {
      const spurNode = previousPath[j];
      const rootPath = previousPath.slice(0, j + 1);

      const removedEdges = new Set<string>();
      resultSet.forEach(p => {
        if (rootPath.every((node, idx) => node === p.path[idx]) && p.path.length > j + 1) {
          removedEdges.add(`${p.path[j]}|${p.path[j+1]}`);
          removedEdges.add(`${p.path[j+1]}|${p.path[j]}`);
        }
      });

      const penalizedEdges = edges.map(e => {
        const usage = edgeUsage.get(`${e.from}|${e.to}`) || 0;
        // Exponential penalty for overlapping paths to force "Google Maps" style diversity (left/right side)
        return usage > 0 ? { ...e, distance: e.distance * (1 + Math.pow(usage, 2) * 50) } : e;
      });

      const spurPath = dijkstra(spurNode, endKey, nodes, penalizedEdges, removedEdges);
      if (spurPath) {
        const totalPath = [...rootPath.slice(0, -1), ...spurPath.path];
        
        // Calculate ACTUAL distance
        let totalDistance = 0;
        for(let idx = 0; idx < totalPath.length - 1; idx++) {
          const from = totalPath[idx];
          const to = totalPath[idx+1];
          const edge = edges.find(e => e.from === from && e.to === to);
          totalDistance += edge?.distance || 0;
        }
        
        if (!potentialPaths.some(p => p.path.join('|') === totalPath.join('|')) &&
            !resultSet.some(p => p.path.join('|') === totalPath.join('|'))) {
          potentialPaths.push({ path: totalPath, distance: totalDistance });
        }
      }
    }

    if (potentialPaths.length === 0) break;
    
    // Sort by distance to find the next best
    potentialPaths.sort((a, b) => a.distance - b.distance);
    const nextBest = potentialPaths.shift()!;
    resultSet.push(nextBest);
    
    // Update usage
    nextBest.path.forEach((node, idx) => {
      if (idx < nextBest.path.length - 1) {
        const key = `${node}|${nextBest.path[idx+1]}`;
        const revKey = `${nextBest.path[idx+1]}|${node}`;
        edgeUsage.set(key, (edgeUsage.get(key) || 0) + 1);
        edgeUsage.set(revKey, (edgeUsage.get(revKey) || 0) + 1);
      }
    });
  }

  // Final Filtering based on User requirements:
  // Option 1: Shortest Path (resultSet[0])
  // Option 2: 5-10m difference (Choose shortest in this range)
  // Option 3: 11m+ difference (Choose shortest in this range)
  
  const finalResultSet: { path: string[], distance: number }[] = [resultSet[0]];
  
  // Option 2 (5-10m)
  const option2 = resultSet.find(r => {
    const diff = r.distance - resultSet[0].distance;
    return diff >= 5 && diff <= 10;
  });
  if (option2) finalResultSet.push(option2);
  
  // Option 3 (11m+)
  const option3 = resultSet.find(r => {
    const diff = r.distance - resultSet[0].distance;
    return diff > 10;
  });
  if (option3) finalResultSet.push(option3);

  // If we couldn't find matches for specific buckets, fall back to best diverse paths found
  if (finalResultSet.length < k) {
    resultSet.forEach(r => {
      if (finalResultSet.length < k && !finalResultSet.includes(r)) {
        finalResultSet.push(r);
      }
    });
  }

  const finalPaths = finalResultSet.map(r => r.path.map(key => {
    const node = nodes.get(key)!;
    return { lat: node.lat, lng: node.lng };
  }));

  console.log(`[K-SHORTEST] Found ${finalPaths.length} diverse paths`);
  return finalPaths;
}
