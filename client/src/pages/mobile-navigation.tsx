import { useState, useEffect, useRef, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, MapPin, Navigation as NavigationIcon, Menu, X, Building2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { SavedRoute, Building, RoutePhase, RouteStep, IndoorNode, Floor, RoomPath, Room } from "@shared/schema";
import { getPhaseColor } from "@shared/phase-colors";
import { trackEvent } from "@/lib/analytics-tracker";
import { AnalyticsEventType } from "@shared/analytics-schema";
import FloorPlanViewer from "@/components/floor-plan-viewer";
import { buildIndoorGraph } from "@/lib/indoor-pathfinding";

declare global {
  interface Window {
    L: any;
  }
}

type NavigationPhase = 'outdoor' | 'indoor';

export default function MobileNavigation() {
  const [, params] = useRoute("/navigate/:routeId");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [showNavPanel, setShowNavPanel] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const touchHandlerRef = useRef<((e: TouchEvent) => void) | null>(null);
  const navigationLayersRef = useRef<any[]>([]); // Track navigation-specific layers for cleanup

  // Indoor navigation states
  const [navigationPhase, setNavigationPhase] = useState<NavigationPhase>('outdoor');
  const [destinationRoom, setDestinationRoom] = useState<IndoorNode | null>(null);
  const [currentIndoorFloor, setCurrentIndoorFloor] = useState<Floor | null>(null);
  const [floorsInRoute, setFloorsInRoute] = useState<Floor[]>([]);

  const { data: route, isLoading, error } = useQuery<SavedRoute>({
    queryKey: ['/api/routes', params?.routeId],
    enabled: !!params?.routeId,
  });

  // Track mobile navigation page load (when user actually opens mobile nav after scanning QR)
  useEffect(() => {
    if (route && params?.routeId) {
      console.log('[MOBILE] User navigating on phone - tracking mobile usage');
      const isAccessibleEndpoint = (route as any).metadata?.isAccessibleEndpoint === true;
      trackEvent(AnalyticsEventType.INTERFACE_ACTION, 0, { 
        action: 'mobile_navigation_opened',
        routeId: params.routeId,
        mode: route.mode,
        isAccessibleEndpoint: isAccessibleEndpoint ? 'yes' : 'no'
      });
    }
  }, [route, params?.routeId]);

  // Fetch buildings for indoor navigation
  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings'],
  });

  // Fetch floors for indoor navigation
  const { data: floors = [] } = useQuery<Floor[]>({
    queryKey: ['/api/floors'],
  });

  // Fetch indoor nodes
  const { data: indoorNodes = [] } = useQuery<IndoorNode[]>({
    queryKey: ['/api/indoor-nodes'],
  });

  // Fetch room paths
  const { data: roomPaths = [] } = useQuery<RoomPath[]>({
    queryKey: ['/api/room-paths'],
  });

  // Fetch rooms for indoor graph building
  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ['/api/rooms'],
  });

  // Check if route has indoor destination
  const hasIndoorDestination = route?.destinationRoomId && route?.destinationBuildingId;

  // Get the destination building for indoor navigation
  const destinationBuilding = useMemo(() => {
    if (!route?.destinationBuildingId || !buildings.length) return null;
    return buildings.find(b => b.id === route.destinationBuildingId) || null;
  }, [route?.destinationBuildingId, buildings]);

  // Get floors for the destination building
  const buildingFloors = useMemo(() => {
    if (!route?.destinationBuildingId || !floors.length) return [];
    return floors.filter(f => f.buildingId === route.destinationBuildingId).sort((a, b) => a.floorNumber - b.floorNumber);
  }, [route?.destinationBuildingId, floors]);

  // Check if all outdoor phases are completed
  const allOutdoorPhasesCompleted = route && completedPhases.length === route.phases.length;

  // Check if navigation is fully complete (outdoor + indoor if applicable)
  const isNavigationComplete = hasIndoorDestination 
    ? navigationPhase === 'indoor' && currentIndoorFloor?.id === destinationRoom?.floorId && floorsInRoute.length > 0 && floorsInRoute[floorsInRoute.length - 1]?.id === currentIndoorFloor?.id
    : allOutdoorPhasesCompleted;

  const handleAdvancePhase = () => {
    if (!route) return;

    const nextPhaseIndex = currentPhaseIndex + 1;
    
    // Mark current phase as completed
    if (!completedPhases.includes(currentPhaseIndex)) {
      setCompletedPhases([...completedPhases, currentPhaseIndex]);
    }

    if (nextPhaseIndex < route.phases.length) {
      setCurrentPhaseIndex(nextPhaseIndex);
      toast({
        title: "Next Phase",
        description: `Navigating to ${route.phases[nextPhaseIndex].endName}`,
      });
    } else {
      // All outdoor phases completed
      if (hasIndoorDestination) {
        // Don't show feedback yet - will transition to indoor mode when user clicks "Reached the Building"
        toast({
          title: "Outdoor Navigation Complete",
          description: "Tap 'Reached the Building' to continue inside.",
        });
      } else {
        // No indoor destination - show feedback dialog
        setShowFeedbackDialog(true);
        toast({
          title: "Destination Reached!",
          description: "You have completed your journey.",
        });
      }
    }
  };

  // Handle reaching the building - transition to indoor navigation
  const handleReachedBuilding = () => {
    if (!route || !route.destinationRoomId || !route.destinationBuildingId || !route.destinationFloorId) {
      console.warn('[MOBILE] Missing indoor navigation data');
      return;
    }

    // Find the destination room node
    const roomNode = indoorNodes.find(n => n.id === route.destinationRoomId && n.type === 'room');
    if (!roomNode) {
      console.error('[MOBILE] Destination room not found:', route.destinationRoomId);
      toast({
        title: "Error",
        description: "Could not find indoor navigation data.",
        variant: "destructive"
      });
      return;
    }

    setDestinationRoom(roomNode);

    // Calculate the indoor path and floors involved
    const roomFloor = floors.find(f => f.id === route.destinationFloorId);
    if (!roomFloor) {
      console.error('[MOBILE] Destination floor not found:', route.destinationFloorId);
      return;
    }

    // Find building entrance (ground floor or floor level 1)
    const buildingFloorsForDest = floors.filter(f => f.buildingId === route.destinationBuildingId).sort((a, b) => a.floorNumber - b.floorNumber);
    const entranceFloor = buildingFloorsForDest.find(f => f.floorNumber === 1) || buildingFloorsForDest[0];

    if (!entranceFloor) {
      console.error('[MOBILE] No entrance floor found');
      return;
    }

    // Calculate floors in route (from entrance to destination floor)
    let floorRoute: Floor[] = [];
    if (entranceFloor.id === roomFloor.id) {
      floorRoute = [entranceFloor];
    } else {
      const entranceLevel = entranceFloor.floorNumber;
      const destLevel = roomFloor.floorNumber;
      
      if (destLevel > entranceLevel) {
        // Going up
        floorRoute = buildingFloorsForDest.filter(f => f.floorNumber >= entranceLevel && f.floorNumber <= destLevel);
      } else {
        // Going down
        floorRoute = buildingFloorsForDest.filter(f => f.floorNumber <= entranceLevel && f.floorNumber >= destLevel).reverse();
      }
    }

    setFloorsInRoute(floorRoute);
    setCurrentIndoorFloor(entranceFloor);
    setNavigationPhase('indoor');

    toast({
      title: "Indoor Navigation",
      description: `Follow the path to ${roomNode.label || route.destinationRoomName || 'your destination'}`,
    });
  };

  // Handle advancing to next floor
  const handleNextFloor = () => {
    if (!currentIndoorFloor || floorsInRoute.length === 0) return;

    const currentIndex = floorsInRoute.findIndex(f => f.id === currentIndoorFloor.id);
    if (currentIndex < floorsInRoute.length - 1) {
      const nextFloor = floorsInRoute[currentIndex + 1];
      setCurrentIndoorFloor(nextFloor);
      toast({
        title: "Floor Change",
        description: `Now on ${nextFloor.floorName}`,
      });
    }
  };

  // Handle going to previous floor
  const handlePrevFloor = () => {
    if (!currentIndoorFloor || floorsInRoute.length === 0) return;

    const currentIndex = floorsInRoute.findIndex(f => f.id === currentIndoorFloor.id);
    if (currentIndex > 0) {
      const prevFloor = floorsInRoute[currentIndex - 1];
      setCurrentIndoorFloor(prevFloor);
      toast({
        title: "Floor Change",
        description: `Now on ${prevFloor.floorName}`,
      });
    }
  };

  // Handle going back to outdoor navigation from indoor mode
  const handleGoBackToOutdoor = () => {
    // Reset indoor navigation states
    setNavigationPhase('outdoor');
    setDestinationRoom(null);
    setCurrentIndoorFloor(null);
    setFloorsInRoute([]);
    
    // Reset completed phases to allow re-navigation
    // Keep the last phase incomplete so user can click "Reached the Building" again
    if (route && route.phases.length > 0) {
      setCurrentPhaseIndex(route.phases.length - 1);
      setCompletedPhases(route.phases.slice(0, -1).map((_, i) => i));
    }
    
    toast({
      title: "Back to Outdoor Navigation",
      description: "You can continue outdoor navigation to the building.",
    });
  };

  // Check if we're on the destination floor
  const isOnDestinationFloor = currentIndoorFloor?.id === destinationRoom?.floorId;
  
  // Get current floor index in route
  const currentFloorIndex = floorsInRoute.findIndex(f => f.id === currentIndoorFloor?.id);

  // Check if we're on the first floor of indoor navigation
  const isOnFirstFloor = currentFloorIndex === 0;
  const isLastFloor = currentFloorIndex === floorsInRoute.length - 1;

  // Handle completing indoor navigation
  const handleCompleteIndoorNavigation = () => {
    setShowFeedbackDialog(true);
    toast({
      title: "Destination Reached!",
      description: "You have completed your journey.",
    });
  };

  const handleFeedbackDecision = (giveFeedback: boolean) => {
    setShowFeedbackDialog(false);
    if (giveFeedback) {
      navigate('/feedback?source=mobile');
    } else {
      navigate('/thank-you');
    }
  };

  // Initialize Leaflet map on mount (not dependent on route)
  useEffect(() => {
    const initMap = () => {
      // Check if ref is ready
      if (!mapRef.current) {
        console.warn("Map ref not ready, retrying in 100ms...");
        setTimeout(initMap, 100);
        return;
      }

      const L = window.L;
      if (!L) {
        console.warn("Leaflet not loaded, retrying in 200ms...");
        setTimeout(initMap, 200);
        return;
      }

      if (mapInstanceRef.current) {
        console.log("Map already initialized");
        return;
      }

      try {
        // Ensure map container has computed dimensions
        const rect = mapRef.current.getBoundingClientRect();
        console.log("Map container dimensions:", { width: rect.width, height: rect.height });

        if (rect.width === 0 || rect.height === 0) {
          console.warn("Map container has zero dimensions, retrying in 100ms...");
          setTimeout(initMap, 100);
          return;
        }

        console.log("Initializing Leaflet map with container:", mapRef.current);
        
        // Create map with SVG renderer for better mobile support (don't use canvas on iOS)
        const map = L.map(mapRef.current, {
          center: [14.4035451, 120.8659794],
          zoom: 17,
          zoomControl: true,
          touchZoom: true,
          bounceAtZoomLimits: false,
          dragging: true,
          attributionControl: false,
          keyboard: false,
          inertia: true,
          inertiaDeceleration: 3000,
          inertiaMaxSpeed: 1500,
        });

        // Use tile layer with better mobile support
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
          minZoom: 15,
          crossOrigin: 'anonymous',
          errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
          keepBuffer: 2,
          updateWhenZooming: false,
          updateWhenIdle: true,
        }).addTo(map);

        mapInstanceRef.current = map;
        console.log("Map initialized successfully");

        // Properly invalidate size with animation disabled
        setTimeout(() => {
          map.invalidateSize(false);
          console.log("Map size invalidated");
        }, 50);
        
        // Second invalidate for stubborn Safari
        setTimeout(() => {
          map.invalidateSize(false);
        }, 300);

      } catch (error) {
        console.error("Error initializing map:", error);
      }
    };

    // Start initialization with a small delay to ensure DOM is ready
    const timer = setTimeout(initMap, 100);
    return () => {
      clearTimeout(timer);
      // Clean up touch event listener
      if (mapRef.current && touchHandlerRef.current) {
        mapRef.current.removeEventListener('touchmove', touchHandlerRef.current);
      }
    };
  }, []);

  // Force map redraw when transitioning back to outdoor mode
  useEffect(() => {
    if (navigationPhase === 'outdoor' && mapInstanceRef.current && window.L) {
      const map = mapInstanceRef.current;
      const L = window.L;
      
      // Force map to recalculate and redraw tiles
      setTimeout(() => {
        map.invalidateSize(false);
        console.log("Map size invalidated for outdoor transition");
      }, 50);
      
      setTimeout(() => {
        map.invalidateSize(false);
      }, 200);
    }
  }, [navigationPhase]);

  // Draw route on map when it updates
  useEffect(() => {
    // If route is undefined/null, clean up any existing navigation layers and exit
    if (!route) {
      if (navigationLayersRef.current.length > 0 && mapInstanceRef.current && window.L) {
        console.log('[MOBILE-NAV] Route cleared - cleaning up navigation layers');
        const L = window.L;
        const map = mapInstanceRef.current;
        navigationLayersRef.current.forEach((layer: any) => {
          try {
            map.removeLayer(layer);
          } catch (e) {
            // Layer may already be removed
          }
        });
        navigationLayersRef.current = [];
      }
      return;
    }
    
    const drawRoute = () => {
      console.log("Route drawing effect triggered", { mapReady: !!mapInstanceRef.current, routeExists: !!route, leafletExists: !!window.L, navigationPhase });
      
      if (!mapInstanceRef.current || !window.L) {
        console.warn("Map not ready yet, retrying in 100ms...");
        setTimeout(drawRoute, 100);
        return;
      }

      const L = window.L;
      const map = mapInstanceRef.current;

      // Clear only previously added navigation layers (preserves base map layers)
      navigationLayersRef.current.forEach((layer: any) => {
        try {
          map.removeLayer(layer);
        } catch (e) {
          // Layer may already be removed
        }
      });
      navigationLayersRef.current = [];

      // Don't draw outdoor route markers if in indoor mode
      if (navigationPhase === 'indoor') {
        console.log("In indoor mode, skipping outdoor route drawing");
        return;
      }

      // Define navigation polygon colors
      const NAVIGATION_COLORS = {
        start: '#22c55e',      // Green for start
        end: '#ef4444',        // Red for destination
        parking: '#3b82f6',    // Blue for parking
        waypoint: '#f59e0b'    // Amber/Orange for waypoints
      };

      // Helper function to draw a building polygon (tracked for cleanup)
      const drawBuildingPolygon = (buildingId: string, color: string, label: string) => {
        const building = buildings.find(b => b.id === buildingId);
        if (building?.polygon && Array.isArray(building.polygon) && building.polygon.length >= 3) {
          const latlngs = building.polygon.map((p: any) => [p.lat, p.lng]);
          const polygon = L.polygon(latlngs, {
            color: color,
            fillColor: color,
            fillOpacity: 0.35,
            weight: 3,
          }).addTo(map).bindPopup(label);
          navigationLayersRef.current.push(polygon);
          console.log(`[MOBILE-NAV] Drew ${label} polygon for ${building.name}`);
        }
      };

      // Draw start building polygon (green)
      if (route.startId) {
        drawBuildingPolygon(route.startId, NAVIGATION_COLORS.start, 'Start');
      }

      // Draw destination building polygon (red) - use destinationBuildingId or endId
      const destinationId = route.destinationBuildingId || route.endId;
      if (destinationId) {
        drawBuildingPolygon(destinationId, NAVIGATION_COLORS.end, 'Destination');
      }

      // Draw waypoint building polygons (amber/orange)
      if (route.waypoints && Array.isArray(route.waypoints)) {
        route.waypoints.forEach((waypointId: string, index: number) => {
          drawBuildingPolygon(waypointId, NAVIGATION_COLORS.waypoint, `Stop ${index + 1}`);
        });
      }

      // Draw parking building polygon (blue) - for driving modes
      // For two-phase driving routes: Phase 1 ends at parking, Phase 2 walks from parking to destination
      if (route.mode === 'driving' && route.phases.length >= 2) {
        const firstPhase = route.phases[0];
        const secondPhase = route.phases[1];
        
        // In a two-phase driving route:
        // - First phase: start → parking (driving)
        // - Second phase: parking → destination (walking)
        // The parking is the endId of first phase AND startId of second phase
        if (firstPhase.endId && secondPhase?.startId === firstPhase.endId && firstPhase.endId !== destinationId) {
          drawBuildingPolygon(firstPhase.endId, NAVIGATION_COLORS.parking, 'Parking');
          console.log(`[MOBILE-NAV] Detected parking from phase transition: ${firstPhase.endId}`);
        }
      }

      console.log("Drawing route with", route.phases.length, "phases");
      console.log("Full route data:", JSON.stringify(route, null, 2).substring(0, 500));

      // Collect all coordinates to calculate bounds
      let allCoordinates: Array<{ lat: number; lng: number }> = [];
      let phasesWithPolylines = 0;

      // Draw each phase
      route.phases.forEach((phase: RoutePhase, index: number) => {
        const color = phase.color || getPhaseColor(index);
        const isCompleted = completedPhases.includes(index);
        const isCurrent = index === currentPhaseIndex;

        console.log(`Phase ${index} check:`, { hasPolyline: !!phase.polyline, isArray: Array.isArray(phase.polyline), length: phase.polyline?.length || 0 });

        if (phase.polyline && Array.isArray(phase.polyline) && phase.polyline.length > 0) {
          phasesWithPolylines++;
          allCoordinates.push(...phase.polyline);

          // Draw polyline for this phase (tracked for cleanup)
          const polyline = L.polyline(
            phase.polyline.map((coord: any) => [coord.lat, coord.lng]),
            {
              color: color,
              weight: isCurrent ? 5 : 3,
              opacity: isCompleted ? 0.5 : 1,
              dashArray: isCompleted ? '5, 5' : 'none',
              lineCap: 'round',
              lineJoin: 'round',
            }
          ).addTo(map);
          navigationLayersRef.current.push(polyline);

          console.log(`Phase ${index}: ${phase.polyline.length} coordinates, color: ${color}, current: ${isCurrent}`);
        } else {
          console.warn(`Phase ${index} has no polyline data!`);
        }
      });

      console.log(`Total phases with polylines: ${phasesWithPolylines}/${route.phases.length}`);

      // Add markers for start and end (tracked for cleanup)
      if (allCoordinates.length > 0) {
        const startMarker = L.circleMarker([allCoordinates[0].lat, allCoordinates[0].lng], {
          radius: 10,
          fillColor: '#22c55e',
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        }).addTo(map).bindPopup('Start');
        navigationLayersRef.current.push(startMarker);

        const endMarker = L.circleMarker(
          [allCoordinates[allCoordinates.length - 1].lat, allCoordinates[allCoordinates.length - 1].lng],
          {
            radius: 10,
            fillColor: '#ef4444',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
          }
        ).addTo(map).bindPopup('End');
        navigationLayersRef.current.push(endMarker);

        // Fit map to all coordinates with padding
        const bounds = L.latLngBounds(allCoordinates.map(c => [c.lat, c.lng]));
        map.fitBounds(bounds, { padding: [50, 50], animate: true });
        console.log("Map fitted to route bounds");
      } else {
        console.error("No coordinates found in any phase!");
      }
    };

    // Start drawing with a small delay to ensure map is ready
    const timer = setTimeout(drawRoute, 100);
    return () => clearTimeout(timer);
  }, [route, currentPhaseIndex, completedPhases, navigationPhase, buildings]);

  // Calculate indoor path polyline for current floor using proper pathfinding
  // NOTE: This useMemo MUST be before any early returns to satisfy React hooks rules
  const indoorPathPolyline = useMemo(() => {
    if (!navigationPhase || navigationPhase !== 'indoor' || !currentIndoorFloor || !destinationRoom) {
      console.log('[MOBILE-PATH] Skipping: not in indoor mode or missing data');
      return undefined;
    }

    console.log('[MOBILE-PATH] Calculating indoor path for floor:', currentIndoorFloor.id);

    // Get floor-specific data
    const floorRoomPaths = roomPaths.filter(rp => rp.floorId === currentIndoorFloor.id);
    const floorRooms = rooms.filter(r => r.floorId === currentIndoorFloor.id);
    const floorIndoorNodes = indoorNodes.filter(n => n.floorId === currentIndoorFloor.id);

    console.log('[MOBILE-PATH] Floor data:', {
      roomPaths: floorRoomPaths.length,
      rooms: floorRooms.length,
      indoorNodes: floorIndoorNodes.length
    });

    if (floorRoomPaths.length === 0) {
      console.log('[MOBILE-PATH] No room paths found for this floor');
      return undefined;
    }

    // Find start node: entrance on first floor, or stairway/elevator on intermediate floors
    let startNode: IndoorNode | undefined;
    const isFirstFloor = currentIndoorFloor.id === floorsInRoute[0]?.id;
    
    if (isFirstFloor) {
      startNode = floorIndoorNodes.find(n => n.type === 'entrance');
    } else {
      // On intermediate floors, start from the stairway/elevator we just entered from
      startNode = floorIndoorNodes.find(n => n.type === 'stairway' || n.type === 'elevator');
    }
    
    // Target: destination room if on same floor, otherwise stairway/elevator to next floor
    let targetNode: IndoorNode | undefined;
    const isDestinationFloor = currentIndoorFloor.id === destinationRoom.floorId;
    
    if (isDestinationFloor) {
      targetNode = destinationRoom;
    } else {
      // Find stairway or elevator to go to next floor (and it should be different from startNode)
      targetNode = floorIndoorNodes.find(n => 
        (n.type === 'stairway' || n.type === 'elevator') && n.id !== startNode?.id
      );
      // If no different stairway found, use any stairway/elevator
      if (!targetNode) {
        targetNode = floorIndoorNodes.find(n => n.type === 'stairway' || n.type === 'elevator');
      }
    }

    if (!startNode || !targetNode) {
      console.log('[MOBILE-PATH] Missing start or target node:', { startNode: !!startNode, targetNode: !!targetNode, isFirstFloor });
      return undefined;
    }

    console.log('[MOBILE-PATH] Finding path from start to target:', {
      start: startNode.id,
      target: targetNode.id,
      isDestinationFloor
    });

    // Build indoor graph
    const indoorGraph = buildIndoorGraph(floorRooms, floorIndoorNodes, floorRoomPaths, currentIndoorFloor.pixelToMeterScale || 0.02);

    console.log('[MOBILE-PATH] Indoor graph built:', {
      nodes: indoorGraph.nodes.size,
      edges: indoorGraph.edges.length
    });

    // Run Dijkstra to find shortest path
    const nodeKey = (id: string, floorId: string) => `${floorId}:${id}`;
    const startKey = nodeKey(startNode.id, currentIndoorFloor.id);
    const destKey = nodeKey(targetNode.id, currentIndoorFloor.id);

    const { nodes, edges } = indoorGraph;

    if (!nodes.has(startKey) || !nodes.has(destKey)) {
      console.log('[MOBILE-PATH] Start or dest node not in graph:', { startKey, destKey });
      return undefined;
    }

    // Dijkstra's algorithm
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
        const dist = distances.get(key) ?? Infinity;
        if (dist < minDist) {
          minDist = dist;
          current = key;
        }
      });

      if (!current) break;
      if (current === destKey) break;

      unvisited.delete(current);

      edges.filter(e => e.from === current).forEach(edge => {
        if (unvisited.has(edge.to)) {
          const alt = (distances.get(current!) ?? Infinity) + edge.distance;
          if (alt < (distances.get(edge.to) ?? Infinity)) {
            distances.set(edge.to, alt);
            previous.set(edge.to, current!);
          }
        }
      });
    }

    // Reconstruct path
    const shortestPath: string[] = [];
    let current: string | null = destKey;
    while (current !== null) {
      shortestPath.unshift(current);
      current = previous.get(current) || null;
    }

    console.log('[MOBILE-PATH] Shortest path found:', shortestPath.length, 'nodes');

    if (shortestPath.length === 0 || shortestPath[0] !== startKey) {
      console.log('[MOBILE-PATH] No valid path found');
      return undefined;
    }

    // Extract waypoints from path edges
    const startNodeData = nodes.get(startKey);
    const endNodeData = nodes.get(destKey);
    if (!startNodeData || !endNodeData) return undefined;

    const polylineWaypoints: Array<{ lat: number; lng: number }> = [
      { lat: startNodeData.x, lng: startNodeData.y }
    ];

    // Helper to check if a point is a duplicate of the last one
    const isDuplicate = (x: number, y: number) => {
      if (polylineWaypoints.length === 0) return false;
      const lastWp = polylineWaypoints[polylineWaypoints.length - 1];
      return Math.abs(lastWp.lat - x) < 1 && Math.abs(lastWp.lng - y) < 1;
    };

    // Helper to add a point if not duplicate
    const addPoint = (x: number, y: number) => {
      if (!isDuplicate(x, y)) {
        polylineWaypoints.push({ lat: x, lng: y });
      }
    };

    for (let i = 0; i < shortestPath.length - 1; i++) {
      const fromNode = shortestPath[i];
      const toNode = shortestPath[i + 1];
      const edge = edges.find(e => e.from === fromNode && e.to === toNode);

      console.log(`[MOBILE-PATH] Edge ${i}: ${fromNode} -> ${toNode}, hasEdge: ${!!edge}, waypoints: ${edge?.pathWaypoints?.length || 0}`);

      if (edge && edge.pathWaypoints && edge.pathWaypoints.length > 0) {
        // Add all edge waypoints, deduplicating
        edge.pathWaypoints.forEach(wp => {
          addPoint(wp.x, wp.y);
        });
      } else {
        // Direct edge without path waypoints - add both from and to nodes to ensure connectivity
        const fromNodeData = nodes.get(fromNode);
        const toNodeData = nodes.get(toNode);
        
        if (fromNodeData) {
          addPoint(fromNodeData.x, fromNodeData.y);
        }
        if (toNodeData) {
          addPoint(toNodeData.x, toNodeData.y);
        }
      }
    }

    // Ensure we end at the destination
    addPoint(endNodeData.x, endNodeData.y);

    console.log('[MOBILE-PATH] Final polyline with', polylineWaypoints.length, 'waypoints');
    console.log('[MOBILE-PATH] Start:', polylineWaypoints[0], 'End:', polylineWaypoints[polylineWaypoints.length - 1]);
    return polylineWaypoints;
  }, [navigationPhase, currentIndoorFloor, destinationRoom, roomPaths, rooms, indoorNodes, floorsInRoute]);

  // Generate indoor turn-by-turn steps for current floor (matching kiosk behavior exactly)
  const currentFloorIndoorSteps = useMemo((): RouteStep[] => {
    if (!navigationPhase || navigationPhase !== 'indoor' || !currentIndoorFloor || !destinationRoom || floorsInRoute.length === 0) {
      return [];
    }

    // Get floor-specific indoor nodes
    const floorIndoorNodes = indoorNodes.filter(n => n.floorId === currentIndoorFloor.id);
    
    if (floorIndoorNodes.length === 0) {
      console.log('[MOBILE-STEPS] No indoor nodes found for floor:', currentIndoorFloor.id);
      return [];
    }

    // Find start node: entrance on first floor, or stairway/elevator on intermediate floors (matching kiosk logic)
    let startNode: IndoorNode | undefined;
    const floorIndex = floorsInRoute.findIndex(f => f.id === currentIndoorFloor.id);
    const isFirstFloor = floorIndex === 0;
    
    if (isFirstFloor) {
      // On entrance floor, start from the building entrance
      startNode = floorIndoorNodes.find(n => n.type === 'entrance');
      // Fallback: if no entrance, try stairway/elevator
      if (!startNode) {
        startNode = floorIndoorNodes.find(n => n.type === 'stairway' || n.type === 'elevator');
      }
    } else {
      // On intermediate floors, start from the stairway/elevator we came from
      startNode = floorIndoorNodes.find(n => n.type === 'stairway' || n.type === 'elevator');
    }
    
    // Target: destination room if on destination floor, otherwise stairway/elevator to next floor
    let targetNode: IndoorNode | undefined;
    const isDestinationFloor = currentIndoorFloor.id === destinationRoom.floorId;
    
    if (isDestinationFloor) {
      // On destination floor, target is the destination room
      targetNode = destinationRoom;
    } else {
      // Not on destination floor, target is stairway/elevator to continue
      // Try to find a different stairway/elevator than the start node
      targetNode = floorIndoorNodes.find(n => 
        (n.type === 'stairway' || n.type === 'elevator') && n.id !== startNode?.id
      );
      // Fallback: use the same stairway if only one exists
      if (!targetNode) {
        targetNode = floorIndoorNodes.find(n => n.type === 'stairway' || n.type === 'elevator');
      }
    }

    if (!startNode || !targetNode) {
      console.log('[MOBILE-STEPS] Missing start or target node:', { 
        startNode: !!startNode, 
        targetNode: !!targetNode, 
        isFirstFloor,
        isDestinationFloor 
      });
      return [];
    }

    // Calculate distance from the indoor path polyline (which is already computed per floor)
    let totalMeterDistance = 0;
    const scale = currentIndoorFloor.pixelToMeterScale || 0.02;
    
    if (indoorPathPolyline && indoorPathPolyline.length > 1) {
      for (let i = 0; i < indoorPathPolyline.length - 1; i++) {
        const dx = indoorPathPolyline[i + 1].lat - indoorPathPolyline[i].lat;
        const dy = indoorPathPolyline[i + 1].lng - indoorPathPolyline[i].lng;
        totalMeterDistance += Math.sqrt(dx * dx + dy * dy) * scale;
      }
    }
    totalMeterDistance = Math.round(totalMeterDistance);

    // Generate labels matching kiosk format
    const startLabel = startNode.label || (isFirstFloor ? 'Main Entrance' : 'Stairway');
    
    // Get next floor name for stairway label
    const nextFloorIndex = floorIndex + 1;
    const nextFloor = nextFloorIndex < floorsInRoute.length ? floorsInRoute[nextFloorIndex] : null;
    
    const targetLabel = isDestinationFloor 
      ? (targetNode.label || route?.destinationRoomName || 'Destination')
      : (targetNode.label || (nextFloor ? `Stairway to ${nextFloor.floorName || `Floor ${nextFloor.floorNumber}`}` : 'Stairway'));

    // Generate steps in the same format as the kiosk (navigation.tsx lines 1570-1586)
    const steps: RouteStep[] = [
      {
        instruction: `Start at ${startLabel}`,
        distance: '0 m',
        icon: 'navigation'
      },
      {
        instruction: `Walk to ${targetLabel}`,
        distance: totalMeterDistance > 0 ? `${totalMeterDistance} m` : '',
        icon: 'arrow-right'
      },
      {
        instruction: `Arrive at ${targetLabel}`,
        distance: '0 m',
        icon: isDestinationFloor ? 'flag' : 'arrow-up'
      }
    ];

    console.log('[MOBILE-STEPS] Generated indoor steps for floor:', currentIndoorFloor.floorName, steps);
    return steps;
  }, [navigationPhase, currentIndoorFloor, destinationRoom, indoorNodes, floorsInRoute, indoorPathPolyline, route?.destinationRoomName]);

  // Handle loading state (after all hooks)
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading route...</p>
        </div>
      </div>
    );
  }

  // Handle error state (after all hooks)
  if (error || !route) {
    return (
      <div className="h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-6 max-w-md w-full text-center">
          <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Route Not Found</h2>
          <p className="text-muted-foreground mb-4">
            This route may have expired or doesn't exist.
          </p>
          <Button 
            className="w-full"
            onClick={() => navigate('/')}
          >
            Return to Kiosk
          </Button>
        </Card>
      </div>
    );
  }

  const currentPhase = route.phases[currentPhaseIndex];
  const phaseColor = currentPhase?.color || getPhaseColor(currentPhaseIndex);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header with Map Toggle */}
      <header className="bg-card border-b border-card-border p-4 flex-shrink-0 flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/thank-you')}
          data-testid="button-back-mobile"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">
            {navigationPhase === 'indoor' ? 'Indoor Navigation' : 'Navigation'}
          </h1>
          <p className="text-xs text-muted-foreground">
            {navigationPhase === 'indoor' 
              ? `${currentIndoorFloor?.floorName || `Floor ${currentIndoorFloor?.floorNumber}` || 'Floor'} - ${destinationRoom?.label || route.destinationRoomName || 'Destination'}`
              : `Phase ${currentPhaseIndex + 1} of ${route.phases.length}`
            }
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowNavPanel(!showNavPanel)}
          data-testid="button-toggle-panel"
        >
          {showNavPanel ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </header>

      {/* Main Layout: Map always visible, Navigation Panel overlays on top */}
      <main className="flex-1 relative w-full h-full overflow-hidden">
        {/* Map Area - Always visible as background */}
        <div
          ref={mapRef}
          id="map"
          className="absolute inset-0 z-0"
          data-testid="map-container"
          style={{
            width: '100%',
            height: '100%',
          }}
        />

        {/* Indoor FloorPlan Overlay - Only visible when in indoor mode */}
        {navigationPhase === 'indoor' && (
          <div className="absolute inset-0 bg-background z-10" data-testid="indoor-navigation-container">
            {currentIndoorFloor && (
              <FloorPlanViewer
                key={currentIndoorFloor.id}
                floor={currentIndoorFloor}
                rooms={indoorNodes
                  .filter(n => n.floorId === currentIndoorFloor.id && n.type === 'room')
                  .map(node => ({
                    id: node.id,
                    name: node.label || node.id,
                    type: 'classroom',
                    description: node.description || null,
                    x: node.x,
                    y: node.y,
                    buildingId: currentIndoorFloor.buildingId,
                    floorId: currentIndoorFloor.id,
                  }))}
                indoorNodes={indoorNodes.filter(n => n.floorId === currentIndoorFloor.id)}
                highlightedRoomId={isOnDestinationFloor ? destinationRoom?.id : undefined}
                showPathTo={isOnDestinationFloor ? destinationRoom : indoorNodes.find(n => n.floorId === currentIndoorFloor.id && (n.type === 'stairway' || n.type === 'elevator'))}
                onClose={() => {}}
                viewOnly={true}
                pathPolyline={indoorPathPolyline}
              />
            )}
          </div>
        )}

        {/* Navigation Panel - Overlays and slides in/out from right */}
        <div
          className={`absolute right-0 top-0 bottom-0 flex flex-col border-l border-card-border bg-card transition-all duration-300 z-20 overflow-hidden ${
            showNavPanel ? 'w-80' : 'w-0'
          }`}
        >
          {/* Progress Indicator */}
          <div className="p-4 border-b border-card-border flex-shrink-0">
            {navigationPhase === 'outdoor' ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  {route.phases.map((phase: RoutePhase, index: number) => {
                    const isCompleted = completedPhases.includes(index);
                    const isCurrent = index === currentPhaseIndex;
                    const phaseColor = phase.color || getPhaseColor(index);

                    return (
                      <div
                        key={index}
                        className="flex items-center gap-2 flex-1"
                      >
                        <div
                          className={`flex-1 h-2 rounded-full transition-all ${
                            isCompleted
                              ? 'opacity-100'
                              : isCurrent
                              ? 'opacity-75'
                              : 'opacity-25'
                          }`}
                          style={{
                            backgroundColor: phaseColor,
                          }}
                        />
                        {index < route.phases.length - 1 && (
                          <div className="w-1 h-1 rounded-full bg-border" />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: phaseColor }}
                    />
                    <span className="text-xs font-medium text-foreground truncate">
                      {currentPhase.startName}
                    </span>
                  </div>
                  <NavigationIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs font-medium text-foreground truncate">
                    {currentPhase.endName}
                  </span>
                </div>
              </>
            ) : (
              <>
                {/* Indoor floor progress */}
                <div className="flex items-center gap-2 mb-3">
                  {floorsInRoute.map((floor, index) => {
                    const isCompleted = currentFloorIndex > index;
                    const isCurrent = floor.id === currentIndoorFloor?.id;

                    return (
                      <div
                        key={floor.id}
                        className="flex items-center gap-2 flex-1"
                      >
                        <div
                          className={`flex-1 h-2 rounded-full transition-all ${
                            isCompleted
                              ? 'bg-green-500'
                              : isCurrent
                              ? 'bg-blue-500'
                              : 'bg-muted'
                          }`}
                        />
                        {index < floorsInRoute.length - 1 && (
                          <div className="w-1 h-1 rounded-full bg-border" />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground truncate">
                      {currentIndoorFloor?.floorName || 'Floor'}
                    </span>
                  </div>
                  <NavigationIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs font-medium text-foreground truncate">
                    {destinationRoom?.label || route.destinationRoomName || 'Destination'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Navigation Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {navigationPhase === 'outdoor' ? (
              <>
                {/* Current Phase Info */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      Current Phase
                    </h2>
                    <Badge
                      variant="secondary"
                      style={{
                        backgroundColor: `${phaseColor}20`,
                        color: phaseColor,
                        borderColor: phaseColor,
                      }}
                      className="text-xs"
                      data-testid="badge-current-phase"
                    >
                      Phase {currentPhaseIndex + 1}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Distance:</span>
                      <span className="font-medium text-foreground">{currentPhase.distance}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">ETA:</span>
                      <span 
                        className="font-medium text-foreground"
                        data-testid={`mobile-eta-${currentPhaseIndex}`}
                      >
                        {(() => {
                          const parseDistance = (distStr: string): number => {
                            const match = distStr.match(/(\d+(?:\.\d+)?)\s*m/);
                            return match ? parseFloat(match[1]) : 0;
                          };
                          const distanceMeters = parseDistance(currentPhase.distance);
                          const speed = currentPhase.mode === 'walking' ? 1.4 : 10;
                          const seconds = distanceMeters / speed;
                          const minutes = Math.ceil(seconds / 60);
                          return minutes > 0 ? `${minutes} min` : '< 1 min';
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Mode:</span>
                      <span className="font-medium text-foreground capitalize">{currentPhase.mode}</span>
                    </div>
                  </div>
                </div>

                {/* Directions */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-2">Directions</h3>
                  <div className="space-y-2">
                    {currentPhase.steps.map((step: RouteStep, stepIndex: number) => (
                      <div
                        key={stepIndex}
                        className="flex gap-2 text-xs"
                        data-testid={`mobile-step-${stepIndex}`}
                      >
                        <div className="flex-shrink-0 w-5 h-5 bg-card border border-border rounded-full flex items-center justify-center text-xs font-medium text-muted-foreground">
                          {stepIndex + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{step.instruction}</p>
                          <p className="text-muted-foreground text-xs">{step.distance}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* All Phases */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-2">All Phases</h3>
                  <div className="space-y-1">
                    {route.phases.map((phase: RoutePhase, index: number) => {
                      const isCompleted = completedPhases.includes(index);
                      const isCurrent = index === currentPhaseIndex;
                      const color = phase.color || getPhaseColor(index);

                      // Check if this is an indoor phase (indoor phases use color #ef4444)
                      const isIndoorPhase = phase.color === '#ef4444';

                      // Calculate ETA for this phase (only for outdoor phases)
                      const parseDistance = (distStr: string): number => {
                        const match = distStr.match(/(\d+(?:\.\d+)?)\s*m/);
                        return match ? parseFloat(match[1]) : 0;
                      };
                      const distanceMeters = parseDistance(phase.distance);
                      const speed = phase.mode === 'walking' ? 1.4 : 10;
                      const seconds = distanceMeters / speed;
                      const minutes = Math.ceil(seconds / 60);
                      const eta = minutes > 0 ? `${minutes}m` : '<1m';

                      return (
                        <div
                          key={index}
                          className={`flex items-center gap-2 p-1.5 rounded-sm text-xs ${
                            isCurrent ? 'bg-accent' : ''
                          }`}
                          data-testid={`phase-overview-${index}`}
                        >
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs"
                            style={{
                              backgroundColor: isCompleted ? color : `${color}20`,
                            }}
                          >
                            {isCompleted ? (
                              <Check className="w-3 h-3 text-white" />
                            ) : (
                              <span style={{ color: color }} className="font-bold">
                                {index + 1}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {phase.startName}
                            </p>
                            {/* Hide distance and time for indoor phases */}
                            {!isIndoorPhase && (
                              <p className="text-muted-foreground text-xs">
                                {phase.distance} • {eta}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Indoor destination info */}
                {hasIndoorDestination && (
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Indoor Destination</span>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      After reaching the building, you'll continue to {route.destinationRoomName || 'the destination room'}.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Indoor Navigation Info */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      Indoor Navigation
                    </h2>
                    <Badge variant="secondary" className="text-xs">
                      {currentIndoorFloor?.floorName || 'Floor'}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Building:</span>
                      <span className="font-medium text-foreground">{destinationBuilding?.name || 'Building'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Destination:</span>
                      <span className="font-medium text-foreground">{destinationRoom?.label || route.destinationRoomName || 'Room'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Floor:</span>
                      <span className="font-medium text-foreground">
                        {currentFloorIndex + 1} of {floorsInRoute.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Current Floor Directions - Turn-by-turn directions matching kiosk */}
                {navigationPhase === 'indoor' && (
                  currentFloorIndoorSteps.length > 0 ? (
                    <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                          <span className="text-xs font-bold text-white">{currentFloorIndex + 1}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-green-800 dark:text-green-200">
                          {isOnDestinationFloor 
                            ? `Walk to ${destinationRoom?.label || route.destinationRoomName || 'Destination'}`
                            : `Walk to Stairway to ${floorsInRoute[currentFloorIndex + 1]?.floorName || 'Next Floor'}`}
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {currentFloorIndoorSteps.map((step, stepIndex) => (
                          <div
                            key={stepIndex}
                            className="flex gap-2 text-xs"
                            data-testid={`indoor-step-${stepIndex}`}
                          >
                            <div className="flex-shrink-0 w-5 h-5 bg-white dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-full flex items-center justify-center text-xs font-medium text-green-700 dark:text-green-300">
                              {stepIndex + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-green-800 dark:text-green-200">{step.instruction}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-muted/50 border border-border rounded-md p-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          Navigate using the floor plan map. Follow the path to reach your destination.
                        </p>
                      </div>
                    </div>
                  )
                )}

                {/* Floor Navigation Controls */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-2">Floor Navigation</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={handlePrevFloor}
                      disabled={currentFloorIndex <= 0}
                      data-testid="button-prev-floor"
                    >
                      <ChevronDown className="w-4 h-4 mr-1" />
                      Down
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={handleNextFloor}
                      disabled={isLastFloor}
                      data-testid="button-next-floor"
                    >
                      Up
                      <ChevronUp className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>

                {/* Floor List */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-2">All Floors</h3>
                  <div className="space-y-1">
                    {floorsInRoute.map((floor, index) => {
                      const isCompleted = currentFloorIndex > index;
                      const isCurrent = floor.id === currentIndoorFloor?.id;
                      const isDestFloor = floor.id === destinationRoom?.floorId;

                      return (
                        <div
                          key={floor.id}
                          className={`flex items-center gap-2 p-1.5 rounded-sm text-xs ${
                            isCurrent ? 'bg-accent' : ''
                          }`}
                          data-testid={`floor-overview-${index}`}
                        >
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${
                              isCompleted ? 'bg-green-500' : isCurrent ? 'bg-blue-500' : 'bg-muted'
                            }`}
                          >
                            {isCompleted ? (
                              <Check className="w-3 h-3 text-white" />
                            ) : (
                              <span className={isCurrent ? 'text-white font-bold' : 'text-muted-foreground'}>
                                {floor.floorNumber}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {floor.floorName || `Floor ${floor.floorNumber}`}
                            </p>
                            {isDestFloor && (
                              <p className="text-xs text-green-600 dark:text-green-400">
                                Destination floor
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Instructions for current floor */}
                <div className="bg-muted/50 rounded-md p-3">
                  <p className="text-xs text-muted-foreground">
                    {isOnDestinationFloor 
                      ? `Follow the highlighted path to reach ${destinationRoom?.label || route.destinationRoomName || 'your destination'}.`
                      : `Navigate to the ${floorsInRoute[currentFloorIndex + 1]?.floorNumber > (currentIndoorFloor?.floorNumber || 0) ? 'stairs or elevator to go up' : 'stairs or elevator to go down'}.`
                    }
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="border-t border-card-border p-4 flex-shrink-0 space-y-3">
            {navigationPhase === 'outdoor' ? (
              <>
                {!allOutdoorPhasesCompleted && (
                  <Button
                    className="w-full text-sm"
                    size="sm"
                    onClick={handleAdvancePhase}
                    data-testid="button-advance-phase"
                    style={{
                      backgroundColor: phaseColor,
                      color: 'white',
                    }}
                  >
                    {currentPhaseIndex < route.phases.length - 1
                      ? `Reached ${currentPhase.endName}`
                      : 'Complete'}
                  </Button>
                )}

                {allOutdoorPhasesCompleted && hasIndoorDestination && (
                  <Button
                    className="w-full text-sm"
                    size="sm"
                    onClick={handleReachedBuilding}
                    data-testid="button-reached-building"
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    Reached the Building
                  </Button>
                )}

                {allOutdoorPhasesCompleted && !hasIndoorDestination && (
                  <div className="text-center py-2">
                    <Check className="w-8 h-8 mx-auto mb-1 text-green-500" />
                    <p className="text-sm font-semibold text-foreground">Journey Complete!</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {isOnDestinationFloor ? (
                  <Button
                    className="w-full text-sm"
                    size="sm"
                    onClick={handleCompleteIndoorNavigation}
                    data-testid="button-complete-indoor"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Complete
                  </Button>
                ) : (
                  <Button
                    className="w-full text-sm"
                    size="sm"
                    onClick={handleNextFloor}
                    disabled={isLastFloor}
                    data-testid="button-continue-floor"
                  >
                    Continue to Next Floor
                  </Button>
                )}
                <Button
                  className="w-full text-sm"
                  size="sm"
                  variant="outline"
                  onClick={isOnFirstFloor ? handleGoBackToOutdoor : handlePrevFloor}
                  data-testid="button-go-back-mobile"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {isOnFirstFloor ? 'Back to Outdoor Navigation' : 'Go Back to Previous Floor'}
                </Button>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-mobile-feedback">
          <DialogHeader>
            <DialogTitle>Give Feedback</DialogTitle>
            <DialogDescription>
              Would you like to help us improve by giving feedback about your navigation experience?
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => handleFeedbackDecision(false)}
              className="flex-1"
              data-testid="button-skip-feedback-mobile"
            >
              No, Skip
            </Button>
            <Button
              onClick={() => handleFeedbackDecision(true)}
              className="flex-1"
              data-testid="button-go-to-feedback-mobile"
            >
              Yes, Give Feedback
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
