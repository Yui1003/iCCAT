const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

// Initialize Firebase Admin
admin.initializeApp();

// Configure Firestore
const db = admin.firestore();

// Use Firestore emulator when running locally
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  db.settings({
    host: 'localhost:8080',
    ssl: false
  });
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ============= BUILDINGS API =============
app.get('/api/buildings', async (req, res) => {
  try {
    const snapshot = await db.collection('buildings').get();
    const buildings = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: parseInt(doc.id),
        ...data
      };
    });
    res.json(buildings);
  } catch (error) {
    console.error('Error fetching buildings:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/buildings/:id', async (req, res) => {
  try {
    const doc = await db.collection('buildings').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Building not found' });
    }
    const data = doc.data();
    res.json({ id: parseInt(doc.id), ...data });
  } catch (error) {
    console.error('Error fetching building:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/buildings', async (req, res) => {
  try {
    // Get the highest ID and increment
    const snapshot = await db.collection('buildings').orderBy('id', 'desc').limit(1).get();
    let newId = 1;
    if (!snapshot.empty) {
      const maxId = snapshot.docs[0].data().id;
      newId = maxId + 1;
    }
    
    const buildingData = { ...req.body, id: newId };
    await db.collection('buildings').doc(newId.toString()).set(buildingData);
    res.json(buildingData);
  } catch (error) {
    console.error('Error creating building:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/buildings/:id', async (req, res) => {
  try {
    const docRef = db.collection('buildings').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Building not found' });
    }
    
    await docRef.update(req.body);
    const updated = await docRef.get();
    res.json({ id: parseInt(updated.id), ...updated.data() });
  } catch (error) {
    console.error('Error updating building:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/buildings/:id', async (req, res) => {
  try {
    await db.collection('buildings').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting building:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= STAFF API =============
app.get('/api/staff', async (req, res) => {
  try {
    const snapshot = await db.collection('staff').get();
    const staff = snapshot.docs.map(doc => ({
      id: parseInt(doc.id),
      ...doc.data()
    }));
    res.json(staff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/staff/:id', async (req, res) => {
  try {
    const doc = await db.collection('staff').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    res.json({ id: parseInt(doc.id), ...doc.data() });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/staff', async (req, res) => {
  try {
    const snapshot = await db.collection('staff').orderBy('id', 'desc').limit(1).get();
    let newId = 1;
    if (!snapshot.empty) {
      newId = snapshot.docs[0].data().id + 1;
    }
    
    const staffData = { ...req.body, id: newId };
    await db.collection('staff').doc(newId.toString()).set(staffData);
    res.json(staffData);
  } catch (error) {
    console.error('Error creating staff:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/staff/:id', async (req, res) => {
  try {
    const docRef = db.collection('staff').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    
    await docRef.update(req.body);
    const updated = await docRef.get();
    res.json({ id: parseInt(updated.id), ...updated.data() });
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/staff/:id', async (req, res) => {
  try {
    await db.collection('staff').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= EVENTS API =============
app.get('/api/events', async (req, res) => {
  try {
    const snapshot = await db.collection('events').get();
    const events = snapshot.docs.map(doc => ({
      id: parseInt(doc.id),
      ...doc.data()
    }));
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    const doc = await db.collection('events').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ id: parseInt(doc.id), ...doc.data() });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const snapshot = await db.collection('events').orderBy('id', 'desc').limit(1).get();
    let newId = 1;
    if (!snapshot.empty) {
      newId = snapshot.docs[0].data().id + 1;
    }
    
    const eventData = { ...req.body, id: newId };
    await db.collection('events').doc(newId.toString()).set(eventData);
    res.json(eventData);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/events/:id', async (req, res) => {
  try {
    const docRef = db.collection('events').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    await docRef.update(req.body);
    const updated = await docRef.get();
    res.json({ id: parseInt(updated.id), ...updated.data() });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    await db.collection('events').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= FLOORS API =============
app.get('/api/floors', async (req, res) => {
  try {
    let query = db.collection('floors');
    
    if (req.query.buildingId) {
      query = query.where('buildingId', '==', parseInt(req.query.buildingId));
    }
    
    const snapshot = await query.get();
    const floors = snapshot.docs.map(doc => ({
      id: parseInt(doc.id),
      ...doc.data()
    }));
    res.json(floors);
  } catch (error) {
    console.error('Error fetching floors:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/floors/:id', async (req, res) => {
  try {
    const doc = await db.collection('floors').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Floor not found' });
    }
    res.json({ id: parseInt(doc.id), ...doc.data() });
  } catch (error) {
    console.error('Error fetching floor:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/floors', async (req, res) => {
  try {
    const snapshot = await db.collection('floors').orderBy('id', 'desc').limit(1).get();
    let newId = 1;
    if (!snapshot.empty) {
      newId = snapshot.docs[0].data().id + 1;
    }
    
    const floorData = { ...req.body, id: newId };
    await db.collection('floors').doc(newId.toString()).set(floorData);
    res.json(floorData);
  } catch (error) {
    console.error('Error creating floor:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/floors/:id', async (req, res) => {
  try {
    const docRef = db.collection('floors').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Floor not found' });
    }
    
    await docRef.update(req.body);
    const updated = await docRef.get();
    res.json({ id: parseInt(updated.id), ...updated.data() });
  } catch (error) {
    console.error('Error updating floor:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/floors/:id', async (req, res) => {
  try {
    await db.collection('floors').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting floor:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= ROOMS API =============
app.get('/api/rooms', async (req, res) => {
  try {
    let query = db.collection('rooms');
    
    if (req.query.floorId) {
      query = query.where('floorId', '==', parseInt(req.query.floorId));
    }
    
    const snapshot = await query.get();
    const rooms = snapshot.docs.map(doc => ({
      id: parseInt(doc.id),
      ...doc.data()
    }));
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rooms/:id', async (req, res) => {
  try {
    const doc = await db.collection('rooms').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json({ id: parseInt(doc.id), ...doc.data() });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rooms', async (req, res) => {
  try {
    const snapshot = await db.collection('rooms').orderBy('id', 'desc').limit(1).get();
    let newId = 1;
    if (!snapshot.empty) {
      newId = snapshot.docs[0].data().id + 1;
    }
    
    const roomData = { ...req.body, id: newId };
    await db.collection('rooms').doc(newId.toString()).set(roomData);
    res.json(roomData);
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/rooms/:id', async (req, res) => {
  try {
    const docRef = db.collection('rooms').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    await docRef.update(req.body);
    const updated = await docRef.get();
    res.json({ id: parseInt(updated.id), ...updated.data() });
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/rooms/:id', async (req, res) => {
  try {
    await db.collection('rooms').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= WALKPATHS API =============
app.get('/api/walkpaths', async (req, res) => {
  try {
    const snapshot = await db.collection('walkpaths').get();
    const walkpaths = snapshot.docs.map(doc => ({
      id: parseInt(doc.id),
      ...doc.data()
    }));
    res.json(walkpaths);
  } catch (error) {
    console.error('Error fetching walkpaths:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/walkpaths', async (req, res) => {
  try {
    const snapshot = await db.collection('walkpaths').orderBy('id', 'desc').limit(1).get();
    let newId = 1;
    if (!snapshot.empty) {
      newId = snapshot.docs[0].data().id + 1;
    }
    
    const pathData = { ...req.body, id: newId };
    await db.collection('walkpaths').doc(newId.toString()).set(pathData);
    res.json(pathData);
  } catch (error) {
    console.error('Error creating walkpath:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/walkpaths/:id', async (req, res) => {
  try {
    const docRef = db.collection('walkpaths').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Walkpath not found' });
    }
    
    await docRef.update(req.body);
    const updated = await docRef.get();
    res.json({ id: parseInt(updated.id), ...updated.data() });
  } catch (error) {
    console.error('Error updating walkpath:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/walkpaths/:id', async (req, res) => {
  try {
    await db.collection('walkpaths').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting walkpath:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= DRIVEPATHS API =============
app.get('/api/drivepaths', async (req, res) => {
  try {
    const snapshot = await db.collection('drivepaths').get();
    const drivepaths = snapshot.docs.map(doc => ({
      id: parseInt(doc.id),
      ...doc.data()
    }));
    res.json(drivepaths);
  } catch (error) {
    console.error('Error fetching drivepaths:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/drivepaths', async (req, res) => {
  try {
    const snapshot = await db.collection('drivepaths').orderBy('id', 'desc').limit(1).get();
    let newId = 1;
    if (!snapshot.empty) {
      newId = snapshot.docs[0].data().id + 1;
    }
    
    const pathData = { ...req.body, id: newId };
    await db.collection('drivepaths').doc(newId.toString()).set(pathData);
    res.json(pathData);
  } catch (error) {
    console.error('Error creating drivepath:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/drivepaths/:id', async (req, res) => {
  try {
    const docRef = db.collection('drivepaths').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Drivepath not found' });
    }
    
    await docRef.update(req.body);
    const updated = await docRef.get();
    res.json({ id: parseInt(updated.id), ...updated.data() });
  } catch (error) {
    console.error('Error updating drivepath:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/drivepaths/:id', async (req, res) => {
  try {
    await db.collection('drivepaths').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting drivepath:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= SETTINGS API =============
app.get('/api/settings/:key', async (req, res) => {
  try {
    const doc = await db.collection('settings').doc(req.params.key).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json(doc.data());
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/settings/:key', async (req, res) => {
  try {
    const settingData = { key: req.params.key, ...req.body };
    await db.collection('settings').doc(req.params.key).set(settingData, { merge: true });
    res.json(settingData);
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= ADMIN AUTH API =============
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Query admins collection for matching username
    const snapshot = await db.collection('admins')
      .where('username', '==', username)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const admin = snapshot.docs[0].data();
    
    // In production, you should use bcrypt to compare hashed passwords
    // For now, assuming plaintext comparison (INSECURE - FIX THIS!)
    if (admin.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Return admin data (without password)
    const { password: _, ...adminData } = admin;
    res.json({
      id: parseInt(snapshot.docs[0].id),
      ...adminData
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  // Since we're using Firebase Functions, sessions are handled client-side
  res.json({ success: true });
});

app.get('/api/auth/me', async (req, res) => {
  // For Firebase, you'd typically use Firebase Authentication
  // This is a placeholder - implement proper auth later
  res.status(401).json({ error: 'Not authenticated' });
});

// ============= ROUTES CALCULATION API =============
app.post('/api/routes/calculate', async (req, res) => {
  try {
    const { startBuildingId, endBuildingId, mode } = req.body;
    
    // Fetch necessary data from Firestore
    const [buildingsSnap, walkpathsSnap, drivepathsSnap] = await Promise.all([
      db.collection('buildings').get(),
      db.collection('walkpaths').get(),
      db.collection('drivepaths').get()
    ]);

    const buildings = buildingsSnap.docs.map(doc => ({
      id: parseInt(doc.id),
      ...doc.data()
    }));
    
    const walkpaths = walkpathsSnap.docs.map(doc => ({
      id: parseInt(doc.id),
      ...doc.data()
    }));
    
    const drivepaths = drivepathsSnap.docs.map(doc => ({
      id: parseInt(doc.id),
      ...doc.data()
    }));

    // Find start and end buildings
    const startBuilding = buildings.find(b => b.id === parseInt(startBuildingId));
    const endBuilding = buildings.find(b => b.id === parseInt(endBuildingId));

    if (!startBuilding || !endBuilding) {
      return res.status(404).json({ error: 'Building not found' });
    }

    // PATHFINDING ALGORITHM (Dijkstra with node snapping)
    const result = calculateRoute(startBuilding, endBuilding, mode, walkpaths, drivepaths);
    
    res.json(result);
  } catch (error) {
    console.error('Error calculating route:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= PATHFINDING HELPER FUNCTIONS =============
function calculateRoute(startBuilding, endBuilding, mode, walkpaths, drivepaths) {
  const SNAPPING_THRESHOLD = 10; // meters
  
  // Select paths based on mode
  const paths = mode === 'driving' ? drivepaths : walkpaths;
  
  // Build graph with node snapping
  const { nodes, edges } = buildGraph(startBuilding, endBuilding, paths, SNAPPING_THRESHOLD);
  
  // Run Dijkstra's algorithm
  const shortestPath = dijkstra(nodes, edges, 'start', 'end');
  
  if (!shortestPath) {
    return {
      waypoints: [
        [startBuilding.latitude, startBuilding.longitude],
        [endBuilding.latitude, endBuilding.longitude]
      ],
      distance: calculateDistance(
        startBuilding.latitude,
        startBuilding.longitude,
        endBuilding.latitude,
        endBuilding.longitude
      ),
      duration: 0,
      mode
    };
  }
  
  // Calculate total distance and duration
  let totalDistance = 0;
  for (let i = 0; i < shortestPath.length - 1; i++) {
    const current = nodes[shortestPath[i]];
    const next = nodes[shortestPath[i + 1]];
    totalDistance += calculateDistance(current.lat, current.lon, next.lat, next.lon);
  }
  
  // Estimate duration (walking: 5 km/h, driving: 20 km/h)
  const speed = mode === 'driving' ? 20 : 5;
  const durationMinutes = (totalDistance / speed) * 60;
  
  return {
    waypoints: shortestPath.map(nodeId => [nodes[nodeId].lat, nodes[nodeId].lon]),
    distance: totalDistance,
    duration: Math.ceil(durationMinutes),
    mode
  };
}

function buildGraph(startBuilding, endBuilding, paths, snapThreshold) {
  const nodes = {};
  const edges = [];
  let nodeId = 0;
  
  // Add start and end nodes
  nodes['start'] = {
    lat: startBuilding.latitude,
    lon: startBuilding.longitude,
    pathId: null
  };
  
  nodes['end'] = {
    lat: endBuilding.latitude,
    lon: endBuilding.longitude,
    pathId: null
  };
  
  // Add path nodes
  paths.forEach(path => {
    const coords = path.coordinates;
    for (let i = 0; i < coords.length; i++) {
      const id = `path${path.id}_node${i}`;
      nodes[id] = {
        lat: coords[i][0],
        lon: coords[i][1],
        pathId: path.id
      };
      
      // Connect consecutive nodes in the path
      if (i > 0) {
        const prevId = `path${path.id}_node${i - 1}`;
        const dist = calculateDistance(
          nodes[prevId].lat,
          nodes[prevId].lon,
          nodes[id].lat,
          nodes[id].lon
        );
        edges.push({ from: prevId, to: id, weight: dist });
        edges.push({ from: id, to: prevId, weight: dist });
      }
    }
  });
  
  // Merge nearby nodes from different paths (node snapping)
  const mergedNodes = mergeNearbyNodes(nodes, snapThreshold);
  
  // Connect start and end to nearest path nodes
  connectBuildingToPath('start', nodes, edges, snapThreshold);
  connectBuildingToPath('end', nodes, edges, snapThreshold);
  
  return { nodes: mergedNodes.nodes, edges: mergedNodes.edges };
}

function mergeNearbyNodes(nodes, threshold) {
  const nodeIds = Object.keys(nodes);
  const clusters = new UnionFind(nodeIds);
  
  // Find nodes within threshold distance
  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const id1 = nodeIds[i];
      const id2 = nodeIds[j];
      const node1 = nodes[id1];
      const node2 = nodes[id2];
      
      // Only merge nodes from different paths
      if (node1.pathId !== node2.pathId || (node1.pathId === null && node2.pathId === null)) {
        const dist = calculateDistance(node1.lat, node1.lon, node2.lat, node2.lon);
        
        if (dist <= threshold) {
          clusters.union(id1, id2);
        }
      }
    }
  }
  
  // Create merged nodes
  const mergedNodes = {};
  const clusterMap = {};
  
  nodeIds.forEach(id => {
    const root = clusters.find(id);
    if (!clusterMap[root]) {
      clusterMap[root] = [];
    }
    clusterMap[root].push(id);
  });
  
  // Average coordinates for merged nodes
  Object.entries(clusterMap).forEach(([root, members]) => {
    const avgLat = members.reduce((sum, id) => sum + nodes[id].lat, 0) / members.length;
    const avgLon = members.reduce((sum, id) => sum + nodes[id].lon, 0) / members.length;
    
    mergedNodes[root] = {
      lat: avgLat,
      lon: avgLon,
      pathId: nodes[root].pathId
    };
  });
  
  return { nodes: mergedNodes, edges: [] };
}

function connectBuildingToPath(buildingId, nodes, edges, threshold) {
  const building = nodes[buildingId];
  let nearest = null;
  let minDist = Infinity;
  
  Object.entries(nodes).forEach(([id, node]) => {
    if (id === buildingId) return;
    
    const dist = calculateDistance(building.lat, building.lon, node.lat, node.lon);
    if (dist < minDist) {
      minDist = dist;
      nearest = id;
    }
  });
  
  if (nearest) {
    edges.push({ from: buildingId, to: nearest, weight: minDist });
    edges.push({ from: nearest, to: buildingId, weight: minDist });
  }
}

function dijkstra(nodes, edges, startId, endId) {
  const distances = {};
  const previous = {};
  const unvisited = new Set(Object.keys(nodes));
  
  Object.keys(nodes).forEach(id => {
    distances[id] = Infinity;
  });
  distances[startId] = 0;
  
  while (unvisited.size > 0) {
    let current = null;
    let minDist = Infinity;
    
    unvisited.forEach(id => {
      if (distances[id] < minDist) {
        minDist = distances[id];
        current = id;
      }
    });
    
    if (current === null || current === endId) break;
    
    unvisited.delete(current);
    
    edges.forEach(edge => {
      if (edge.from === current && unvisited.has(edge.to)) {
        const newDist = distances[current] + edge.weight;
        if (newDist < distances[edge.to]) {
          distances[edge.to] = newDist;
          previous[edge.to] = current;
        }
      }
    });
  }
  
  if (distances[endId] === Infinity) return null;
  
  const path = [];
  let current = endId;
  while (current) {
    path.unshift(current);
    current = previous[current];
  }
  
  return path;
}

// Union-Find data structure
class UnionFind {
  constructor(elements) {
    this.parent = {};
    this.rank = {};
    elements.forEach(e => {
      this.parent[e] = e;
      this.rank[e] = 0;
    });
  }
  
  find(x) {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }
  
  union(x, y) {
    const rootX = this.find(x);
    const rootY = this.find(y);
    
    if (rootX === rootY) return;
    
    if (this.rank[rootX] < this.rank[rootY]) {
      this.parent[rootX] = rootY;
    } else if (this.rank[rootX] > this.rank[rootY]) {
      this.parent[rootY] = rootX;
    } else {
      this.parent[rootY] = rootX;
      this.rank[rootX]++;
    }
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c / 1000; // Return in kilometers
}

// Export Express app as Firebase Function
exports.api = functions.https.onRequest(app);