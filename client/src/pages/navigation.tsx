import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronUp, Navigation as NavigationIcon, TrendingUp, MapPin, Filter, Search, Users, Car, Bike, QrCode, Plus, X, GripVertical, Clock, ChevronDown, DoorOpen, AlertTriangle, Footprints, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics-tracker";
import { AnalyticsEventType } from "@shared/analytics-schema";
import CampusMap from "@/components/campus-map";
import BuildingInfoModal from "@/components/building-info-modal";
import FloorPlanViewer from "@/components/floor-plan-viewer";
import GetDirectionsDialog from "@/components/get-directions-dialog";
import QRCodeDialog from "@/components/qr-code-dialog";
import RoomFinderDialog from "@/components/room-finder-dialog";
import SearchableStartingPointSelect from "@/components/searchable-starting-point-select";
import SearchableDestinationSelect from "@/components/searchable-destination-select";
import SearchableWaypointSelect from "@/components/searchable-waypoint-select";
import type { Building, NavigationRoute, Staff, Floor, Room, VehicleType, RouteStep, RoutePhase, IndoorNode, RoomPath, LatLng, CustomPoiType } from "@shared/schema";
import { poiTypes, KIOSK_LOCATION } from "@shared/schema";
import { getPoiTypeIconUrl } from "@/lib/poi-type-icons";
import { useGlobalInactivity } from "@/hooks/use-inactivity";
import { findShortestPath, findNearestAccessibleEndpoint } from "@/lib/pathfinding";
import { buildIndoorGraph, findRoomPath, connectOutdoorToIndoor } from "@/lib/indoor-pathfinding";
import { getWalkpaths, getDrivepaths } from "@/lib/offline-data";
import { calculateMultiPhaseRoute, multiPhaseToNavigationRoute, type InaccessibleStopInfo } from "@/lib/multi-phase-routes";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { calculateETA, parseDistance } from "@/lib/eta-calculator";
import { generateIndoorSteps } from "@/lib/indoor-steps";
import { useLocation } from "wouter";
import ThemeToggle from "@/components/theme-toggle";

export default function Navigation() {
  useGlobalInactivity();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const mapOverlayRef = useRef<HTMLDivElement>(null);
  const mapMainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const overlay = mapOverlayRef.current;
    if (!overlay) return;

    overlay.style.opacity = '1';
    overlay.style.display = 'block';

    const timer = setTimeout(() => {
      if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
          if (overlay) {
            overlay.style.display = 'none';
          }
        }, 250);
      }
    }, 1200);

    return () => {
      clearTimeout(timer);
      if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.display = 'none';
      }
    };
  }, []);

  const [selectedStart, setSelectedStart] = useState<Building | null | typeof KIOSK_LOCATION>(null);
  const [selectedEnd, setSelectedEnd] = useState<Building | null>(null);
  const [mode, setMode] = useState<'walking' | 'driving' | 'accessible'>('walking');
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);
  const [pendingNavigationData, setPendingNavigationData] = useState<{start: any, end: Building, mode: 'walking' | 'driving' | 'accessible', waypoints: Building[]} | null>(null);
  const [route, setRoute] = useState<NavigationRoute | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(Array.from(poiTypes).sort());
  const [activeTypesInitialized, setActiveTypesInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [showDirectionsDialog, setShowDirectionsDialog] = useState(false);
  const [directionsDestination, setDirectionsDestination] = useState<Building | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [savedRouteId, setSavedRouteId] = useState<string | null>(null);
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [dragWaypointIndex, setDragWaypointIndex] = useState<number | null>(null);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [showRoomFinder, setShowRoomFinder] = useState(false);
  const [roomFinderFloorPlan, setRoomFinderFloorPlan] = useState<{ floor: Floor; rooms: Room[] } | null>(null);
  const [selectedRoomForNav, setSelectedRoomForNav] = useState<{ id: string; name: string; buildingName: string } | null>(null);
  const [navigationPhase, setNavigationPhase] = useState<'outdoor' | 'indoor' | null>(null);
  const [activeNavPhaseIndex, setActiveNavPhaseIndex] = useState<number | null>(null);
  const [destinationRoom, setDestinationRoom] = useState<IndoorNode | null>(null);
  const [currentIndoorFloor, setCurrentIndoorFloor] = useState<Floor | null>(null);
  const [floorsInRoute, setFloorsInRoute] = useState<string[]>([]);
  const [currentSegmentStartNode, setCurrentSegmentStartNode] = useState<IndoorNode | null>(null);
  const [currentSegmentEndNode, setCurrentSegmentEndNode] = useState<IndoorNode | null>(null);
  const [outdoorRouteSnapshot, setOutdoorRouteSnapshot] = useState<NavigationRoute | null>(null);
  const [showAccessibleFallbackDialog, setShowAccessibleFallbackDialog] = useState(false);
  const [accessibleFallbackEndpoint, setAccessibleFallbackEndpoint] = useState<{ lat: number; lng: number } | null>(null);
  const [originalDestinationName, setOriginalDestinationName] = useState<string | null>(null);

  // Multi-stop accessible warning state
  const [showMultiStopAccessibleWarning, setShowMultiStopAccessibleWarning] = useState(false);
  const [pendingMultiPhaseNavRoute, setPendingMultiPhaseNavRoute] = useState<NavigationRoute | null>(null);
  const [multiStopInaccessibleStops, setMultiStopInaccessibleStops] = useState<InaccessibleStopInfo[]>([]);
  
  // Parking selection state - for when user needs to indicate where their vehicle is parked
  const [showParkingSelector, setShowParkingSelector] = useState(false);
  const [parkingSelectionMode, setParkingSelectionMode] = useState(false);
  const [selectedVehicleParking, setSelectedVehicleParking] = useState<Building | null>(null);
  const [pendingDrivingRoute, setPendingDrivingRoute] = useState<{
    start: Building | typeof KIOSK_LOCATION;
    end: Building;
    vehicleType: VehicleType;
    waypoints: Building[];
  } | null>(null);
  
  // Two-step parking selection state - origin parking then destination parking
  const [drivingParkingMode, setDrivingParkingMode] = useState<'origin' | 'destination' | null>(null);
  const [selectedDestinationParking, setSelectedDestinationParking] = useState<Building | null>(null);
  
  // Waypoint parking selection state - for driving mode with waypoints
  const [waypointParkingMode, setWaypointParkingMode] = useState<'origin' | 'waypoint' | null>(null);
  const [selectedOriginParking, setSelectedOriginParking] = useState<Building | null>(null);
  const [selectedWaypointParking, setSelectedWaypointParking] = useState<Building | null>(null);
  
  const [showDrivingAdvisory, setShowDrivingAdvisory] = useState(false);
  const [pendingDrivingAction, setPendingDrivingAction] = useState<(() => void) | null>(null);
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);
  const [isRouteConfirmed, setIsRouteConfirmed] = useState(false);
  
  const [pendingWaypointDrivingRoute, setPendingWaypointDrivingRoute] = useState<{
    start: Building | typeof KIOSK_LOCATION;
    end: Building;
    waypoints: Building[];
    vehicleType: VehicleType;
    originParking?: Building;
    waypointParking?: Building;
  } | null>(null);

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings']
  });

  const { data: poiTypesData } = useQuery<{
    customTypes: CustomPoiType[];
    hiddenBuiltinTypes: string[];
    iconOverrides: Record<string, string>;
    renames: Record<string, string>;
  }>({ queryKey: ['/api/poi-types'] });

  const activePoiTypes = useMemo(() => {
    const hidden = new Set(poiTypesData?.hiddenBuiltinTypes || []);
    const renames = poiTypesData?.renames || {};
    const builtin = [...poiTypes].filter(t => !hidden.has(t)).map(t => renames[t] ?? t);
    const custom = (poiTypesData?.customTypes || []).map(c => c.name);
    return [...builtin, ...custom].sort();
  }, [poiTypesData]);

  // Reverse rename map: displayName → originalName (for filter matching against building.type)
  const reverseRenames = useMemo(() => {
    const renames = poiTypesData?.renames || {};
    return Object.fromEntries(Object.entries(renames).map(([orig, disp]) => [disp, orig]));
  }, [poiTypesData]);

  useEffect(() => {
    if (poiTypesData && !activeTypesInitialized) {
      setSelectedTypes(activePoiTypes);
      setActiveTypesInitialized(true);
    }
  }, [poiTypesData, activePoiTypes, activeTypesInitialized]);

  const { data: staff = [] } = useQuery<Staff[]>({
    queryKey: ['/api/staff']
  });

  const { data: floors = [] } = useQuery<Floor[]>({
    queryKey: ['/api/floors']
  });

  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ['/api/rooms']
  });

  const { data: indoorNodes = [] } = useQuery<IndoorNode[]>({
    queryKey: ['/api/indoor-nodes'],
    staleTime: 0,
    queryFn: async () => {
      const res = await fetch('/api/indoor-nodes');
      return res.json();
    }
  });

  const { data: roomPaths = [] } = useQuery<RoomPath[]>({
    queryKey: ['/api/room-paths'],
    queryFn: async () => {
      const res = await fetch('/api/room-paths');
      return res.json();
    }
  });

  // Auto-set destinationRoom from URL param ?roomNode=<indoorNodeId> (used when navigating to a staff member's room)
  useEffect(() => {
    if (indoorNodes.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const roomNodeId = params.get('roomNode');
    if (!roomNodeId) return;
    setDestinationRoom(prev => {
      if (prev) return prev; // don't overwrite a user-selected room
      return indoorNodes.find(n => n.id === roomNodeId) ?? null;
    });
  }, [indoorNodes]);

  // Get the Kiosk building from database (fallback to constant if not found)
  const kioskBuilding = buildings.find(b => b.type === 'Kiosk' || b.id === 'kiosk');
  
  useEffect(() => {
    // Use Kiosk building from database if available, otherwise use constant
    if (kioskBuilding) {
        setSelectedStart(kioskBuilding);
      } else if (buildings.length === 0) {
        // Buildings not loaded yet, use constant temporarily
        setSelectedStart(KIOSK_LOCATION as any);
      }
    }, [kioskBuilding, buildings.length]);

  // Track building info modal open
  useEffect(() => {
    if (selectedBuilding) {
      const startTime = performance.now();
      const duration = performance.now() - startTime;
      trackEvent(AnalyticsEventType.INTERFACE_ACTION, Math.max(1, Math.round(duration)), {
        action: 'building_info_opened',
        buildingId: selectedBuilding.id,
        buildingName: selectedBuilding.name
      });
    }
  }, [selectedBuilding]);

  // Track floor plan viewer open
  useEffect(() => {
    if (selectedFloor) {
      const startTime = performance.now();
      const duration = performance.now() - startTime;
      trackEvent(AnalyticsEventType.IMAGE_LOAD, Math.max(1, Math.round(duration)), {
        action: 'floor_plan_opened',
        floorId: selectedFloor.id,
        floorName: selectedFloor.floorName || `Floor ${selectedFloor.floorNumber}`,
        buildingId: selectedFloor.buildingId
      });
    }
  }, [selectedFloor]);

  const autoGenRanRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromId = params.get('from');
    const toId = params.get('to');
    const travelMode = params.get('mode') as 'walking' | 'driving';
    const vehicleParam = params.get('vehicle') as 'car' | 'motorcycle' | 'bike' | null;
    const waypointsParam = params.get('waypoints');
    const autoGenerate = params.get('autoGenerate') === 'true';

    if (fromId && toId && buildings.length > 0) {
      const roomNodeId = params.get('roomNode');
      if (autoGenerate && roomNodeId && indoorNodes.length === 0) {
        return;
      }

      const kioskSource = kioskBuilding || KIOSK_LOCATION;
      const startBuilding = fromId === 'kiosk' 
        ? { ...kioskSource, description: null, departments: null, image: null, markerIcon: null, polygon: null, polygonColor: null, nodeLat: kioskSource.lat, nodeLng: kioskSource.lng }
        : buildings.find(b => b.id === fromId);
      const endBuilding = buildings.find(b => b.id === toId);

      if (startBuilding && endBuilding) {
        setSelectedStart(startBuilding as any);
        setSelectedEnd(endBuilding);
        if (travelMode === 'walking' || travelMode === 'driving') {
          setMode(travelMode);
        }
        if (vehicleParam) {
          setVehicleType(vehicleParam);
        }
        if (waypointsParam) {
          setWaypoints(waypointsParam.split(','));
        }
        
        // Auto-generate route if requested
        if (autoGenerate && !autoGenRanRef.current) {
          autoGenRanRef.current = true;
          setTimeout(async () => {
            const routeStartTime = performance.now();
            try {
              const waypointIds = waypointsParam ? waypointsParam.split(',') : [];
              const effectiveMode = travelMode || 'walking';

              const roomNodeId = params.get('roomNode');
              let autoGenRoomData: typeof indoorNodes[0] | null = null;
              if (roomNodeId && indoorNodes.length > 0) {
                autoGenRoomData = indoorNodes.find(n => n.id === roomNodeId && n.type === 'room') || null;
                if (autoGenRoomData) {
                  setNavigationPhase('outdoor');
                }
              }
              
              // For driving mode, show advisory first then proceed
              if (effectiveMode === 'driving' && vehicleParam) {
                const autoGenDrivingAction = async () => {
                  const drivingStartTime = performance.now();

                  if (waypointIds.length === 0) {
                    const twoPhaseRoute = await generateTwoPhaseRoute(startBuilding as any, endBuilding, vehicleParam);
                    if (twoPhaseRoute) {
                      setRoute(twoPhaseRoute);

                      try {
                        const routeData: any = {
                          startId: (startBuilding as any).id,
                          endId: endBuilding.id,
                          waypoints: [],
                          mode: 'driving',
                          vehicleType: vehicleParam,
                          phases: twoPhaseRoute.phases || [],
                          expiresAt: null
                        };

                        if (autoGenRoomData) {
                          routeData.destinationRoomId = autoGenRoomData.id;
                          routeData.destinationBuildingId = endBuilding.id;
                          routeData.destinationFloorId = autoGenRoomData.floorId;
                          routeData.destinationRoomName = autoGenRoomData.label || 'Room';
                        }

                        const res = await apiRequest('POST', '/api/routes', routeData);
                        const response = await res.json();

                        if (response.id) {
                          setSavedRouteId(response.id);
                        }
                      } catch (error) {
                        console.error('Error saving two-phase route:', error);
                      }

                      const duration = performance.now() - drivingStartTime;
                      trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: effectiveMode, vehicleType: vehicleParam, routeType: 'two-phase', source: 'autoGenerate' });
                    }
                    return;
                  }

                  const waypointBuildings = waypointIds
                    .map(id => buildings.find(b => b.id === id))
                    .filter(Boolean) as Building[];

                  if (waypointBuildings.length > 0) {
                    const parkingAreas = getParkingAreasForVehicle(vehicleParam);
                    if (parkingAreas.length > 0) {
                      const startIsGate = isGate(startBuilding as any);
                      
                      if (startIsGate) {
                        await generateWaypointDrivingRoute(
                          startBuilding as any,
                          endBuilding,
                          waypointBuildings,
                          vehicleParam,
                          null
                        );
                        const duration = performance.now() - drivingStartTime;
                        trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: effectiveMode, vehicleType: vehicleParam, routeType: 'waypoint-driving-auto', source: 'autoGenerate' });
                        return;
                      } else {
                        setPendingWaypointDrivingRoute({
                          start: startBuilding as any,
                          end: endBuilding,
                          waypoints: waypointBuildings,
                          vehicleType: vehicleParam
                        });
                        setWaypointParkingMode('origin');
                        setParkingSelectionMode(true);
                        setShowParkingSelector(true);
                        toast({
                          title: "Select Your Parking Location",
                          description: `Tap on the ${capitalizeVehicleType(vehicleParam)} parking area where your vehicle is parked.`,
                          variant: "default"
                        });
                        const duration = performance.now() - drivingStartTime;
                        trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: effectiveMode, vehicleType: vehicleParam, routeType: 'waypoint-driving-pending', source: 'autoGenerate' });
                        return;
                      }
                    }
                  }

                  const multiPhaseRoute = await calculateMultiPhaseRoute(
                    startBuilding as any,
                    waypointBuildings,
                    endBuilding,
                    effectiveMode
                  );

                  if (multiPhaseRoute) {
                    const navigationRoute = multiPhaseToNavigationRoute(
                      multiPhaseRoute,
                      startBuilding as any,
                      endBuilding,
                      effectiveMode
                    );

                    if (vehicleParam) {
                      navigationRoute.vehicleType = vehicleParam;
                    }

                    setRoute(navigationRoute);

                    try {
                      const routeData: any = {
                        startId: (startBuilding as any).id,
                        endId: endBuilding.id,
                        waypoints: waypointIds,
                        mode: effectiveMode,
                        vehicleType: vehicleParam || null,
                        phases: multiPhaseRoute.phases,
                        expiresAt: null
                      };

                      if (autoGenRoomData) {
                        routeData.destinationRoomId = autoGenRoomData.id;
                        routeData.destinationBuildingId = endBuilding.id;
                        routeData.destinationFloorId = autoGenRoomData.floorId;
                        routeData.destinationRoomName = autoGenRoomData.label || 'Room';
                      }

                      const res = await apiRequest('POST', '/api/routes', routeData);
                      const response = await res.json();

                      if (response.id) {
                        setSavedRouteId(response.id);
                      }
                    } catch (error) {
                      console.error('Error saving multi-phase route:', error);
                    }

                    const duration = performance.now() - drivingStartTime;
                    trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: effectiveMode, hasWaypoints: waypointIds.length > 0, routeType: 'multi-phase', source: 'autoGenerate' });
                  }
                };

                showDrivingAdvisoryThenProceed(autoGenDrivingAction);
                return;
              }

              // Multi-stop navigation (non-driving)
              if (waypointIds.length > 0) {
                const waypointBuildings = waypointIds
                  .map(id => buildings.find(b => b.id === id))
                  .filter(Boolean) as Building[];

                const multiPhaseRoute = await calculateMultiPhaseRoute(
                  startBuilding as any,
                  waypointBuildings,
                  endBuilding,
                  effectiveMode
                );

                if (multiPhaseRoute) {
                  const navigationRoute = multiPhaseToNavigationRoute(
                    multiPhaseRoute,
                    startBuilding as any,
                    endBuilding,
                    effectiveMode
                  );

                  if (vehicleParam) {
                    navigationRoute.vehicleType = vehicleParam;
                  }

                  setRoute(navigationRoute);

                  // Save route
                  try {
                    const routeData: any = {
                      startId: (startBuilding as any).id,
                      endId: endBuilding.id,
                      waypoints: waypointIds,
                      mode: effectiveMode,
                      vehicleType: vehicleParam || null,
                      phases: multiPhaseRoute.phases,
                      expiresAt: null
                    };

                    if (autoGenRoomData) {
                      routeData.destinationRoomId = autoGenRoomData.id;
                      routeData.destinationBuildingId = endBuilding.id;
                      routeData.destinationFloorId = autoGenRoomData.floorId;
                      routeData.destinationRoomName = autoGenRoomData.label || 'Room';
                    }

                    const res = await apiRequest('POST', '/api/routes', routeData);
                    const response = await res.json();

                    if (response.id) {
                      setSavedRouteId(response.id);
                    }
                  } catch (error) {
                    console.error('Error saving multi-phase route:', error);
                  }

                  const duration = performance.now() - routeStartTime;
                  trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: effectiveMode, hasWaypoints: waypointIds.length > 0, routeType: 'multi-phase', source: 'autoGenerate' });
                  return;
                }
              }

              // Single destination route
              let routePolyline = await calculateRouteClientSide(
                startBuilding as any,
                endBuilding,
                effectiveMode
              );
              let finalEndBuilding: Building = endBuilding;

              // Accessible fallback: if no route found, find nearest accessible endpoint
              if (!routePolyline && effectiveMode === 'accessible') {
                try {
                  const walkpathsRes = await fetch('/api/walkpaths', { credentials: 'include', cache: 'no-cache' });
                  if (walkpathsRes.ok) {
                    const walkpaths = await walkpathsRes.json();
                    const nearestEndpoint = findNearestAccessibleEndpoint(endBuilding, walkpaths);
                    if (nearestEndpoint) {
                      setOriginalDestinationName(endBuilding.name);
                      setAccessibleFallbackEndpoint(nearestEndpoint);
                      setShowAccessibleFallbackDialog(true);
                      const endpointBuilding: Building = {
                        id: 'accessible-endpoint',
                        name: 'Accessible Path End',
                        lat: nearestEndpoint.lat,
                        lng: nearestEndpoint.lng,
                        nodeLat: nearestEndpoint.lat,
                        nodeLng: nearestEndpoint.lng,
                        entranceLat: nearestEndpoint.lat,
                        entranceLng: nearestEndpoint.lng,
                        polygon: null,
                        polygonColor: null,
                        description: '',
                        image: null,
                        type: 'building',
                        markerIcon: null,
                        departments: null,
                        polygonOpacity: null
                      };
                      finalEndBuilding = endpointBuilding;
                      routePolyline = await calculateRouteClientSide(startBuilding as any, endpointBuilding, effectiveMode);
                    } else {
                      toast({
                        title: "No Accessible Route",
                        description: "No wheelchair-accessible path found to this destination.",
                        variant: "destructive"
                      });
                    }
                  }
                } catch (fallbackError) {
                  console.error('[ACCESSIBLE] Auto-generate fallback failed:', fallbackError);
                }
              }

              if (routePolyline) {
                const { steps, totalDistance } = generateSmartSteps(
                  routePolyline,
                  effectiveMode,
                  startBuilding.name,
                  finalEndBuilding.name
                );

                setRoute({
                  start: startBuilding as any,
                  end: finalEndBuilding,
                  mode: effectiveMode,
                  polyline: routePolyline,
                  steps,
                  totalDistance
                });

                // Save route
                try {
                  const routeData: any = {
                    startId: (startBuilding as any).id,
                    endId: endBuilding.id,
                    waypoints: [],
                    mode: effectiveMode,
                    vehicleType: vehicleParam || null,
                    phases: [{
                      mode: effectiveMode,
                      polyline: routePolyline,
                      steps,
                      distance: totalDistance,
                      startName: startBuilding.name,
                      endName: finalEndBuilding.name,
                      color: '#3B82F6',
                      phaseIndex: 0,
                      startId: (startBuilding as any).id,
                      endId: endBuilding.id
                    }],
                    expiresAt: null
                  };

                  if (autoGenRoomData) {
                    routeData.destinationRoomId = autoGenRoomData.id;
                    routeData.destinationBuildingId = endBuilding.id;
                    routeData.destinationFloorId = autoGenRoomData.floorId;
                    routeData.destinationRoomName = autoGenRoomData.label || 'Room';
                  }

                  const res = await apiRequest('POST', '/api/routes', routeData);
                  const response = await res.json();

                  if (response.id) {
                    setSavedRouteId(response.id);
                  }
                } catch (error) {
                  console.error('Error saving route:', error);
                }

                const duration = performance.now() - routeStartTime;
                trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: effectiveMode, routeType: 'standard', routeFound: true, hasRoom: !!autoGenRoomData, source: 'autoGenerate' });
              } else {
                const duration = performance.now() - routeStartTime;
                trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: effectiveMode, routeType: 'standard', routeFound: false, source: 'autoGenerate' });
              }
            } catch (error) {
              console.error('Error generating auto route:', error);
              const duration = performance.now() - routeStartTime;
              trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { error: true, source: 'autoGenerate' });
            }
          }, 100);
        }
      }
    }
  }, [buildings, indoorNodes]);

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const capitalizeVehicleType = (type: VehicleType): string => {
    const labels: Record<VehicleType, string> = {
      'car': 'Car',
      'motorcycle': 'Motorcycle',
      'bike': 'Bike'
    };
    return labels[type];
  };

  // Helper predicates for building type detection
  const isGate = (building: Building | typeof KIOSK_LOCATION | null): boolean => {
    if (!building) return false;
    return (building as Building).type === 'Gate';
  };

  const isParking = (building: Building | typeof KIOSK_LOCATION | null): boolean => {
    if (!building) return false;
    const type = (building as Building).type;
    return type === 'Car Parking' || type === 'Motorcycle Parking' || type === 'Bike Parking';
  };

  const isParkingForVehicle = (building: Building | null, vehicleType: VehicleType): boolean => {
    if (!building) return false;
    const vehicleToParkingType: Record<VehicleType, string> = {
      'car': 'Car Parking',
      'motorcycle': 'Motorcycle Parking',
      'bike': 'Bike Parking'
    };
    return building.type === vehicleToParkingType[vehicleType];
  };

  // Get all parking areas for a specific vehicle type
  const getParkingAreasForVehicle = (vehicleType: VehicleType): Building[] => {
    const parkingType = vehicleType === 'car' ? 'Car Parking' : vehicleType === 'motorcycle' ? 'Motorcycle Parking' : 'Bike Parking';
    return buildings.filter(b => b.type === parkingType);
  };

  const findNearestParkingByType = (destination: Building, vehicleType: VehicleType): Building | null => {
    const parkingType = vehicleType === 'car' ? 'Car Parking' : vehicleType === 'motorcycle' ? 'Motorcycle Parking' : 'Bike Parking';
    
    const parkingAreas = buildings.filter(b => b.type === parkingType);
    
    if (parkingAreas.length === 0) {
      return null;
    }

    let nearestParking = parkingAreas[0];
    let minDistance = calculateDistance(destination.lat, destination.lng, parkingAreas[0].lat, parkingAreas[0].lng);

    for (let i = 1; i < parkingAreas.length; i++) {
      const dist = calculateDistance(destination.lat, destination.lng, parkingAreas[i].lat, parkingAreas[i].lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestParking = parkingAreas[i];
      }
    }

    return nearestParking;
  };

  const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);

    return (θ * 180 / Math.PI + 360) % 360;
  };

  const getTurnInstruction = (angleDiff: number, travelMode: string): { instruction: string; icon: string } => {
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
  };

  const generateSmartSteps = (routePolyline: Array<{ lat: number; lng: number }>, travelMode: 'walking' | 'driving' | 'accessible', startName: string, endName: string) => {
    const steps = [];
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

    let accumulatedDistance = 0;

    for (let i = 0; i < routePolyline.length - 1; i++) {
      const dist = calculateDistance(
        routePolyline[i].lat,
        routePolyline[i].lng,
        routePolyline[i + 1].lat,
        routePolyline[i + 1].lng
      );
      totalDist += dist;
      accumulatedDistance += dist;

      const isLastSegment = i === routePolyline.length - 2;

      if (i < bearings.length - 1) {
        const angleDiff = ((bearings[i + 1] - bearings[i] + 540) % 360) - 180;
        const absAngle = Math.abs(angleDiff);

        const isRealTurn = absAngle >= MIN_TURN_ANGLE;
        const isSlightTurn = absAngle >= MIN_SLIGHT_ANGLE && accumulatedDistance >= MIN_SLIGHT_DIST;

        if ((isRealTurn || isSlightTurn) && !isLastSegment) {
          const turnInfo = getTurnInstruction(angleDiff, travelMode);
          steps.push({
            instruction: turnInfo.instruction,
            distance: `${Math.round(accumulatedDistance)} m`,
            icon: turnInfo.icon
          });
          accumulatedDistance = 0;
        }
      }
    }

    // Add final segment if there's accumulated distance
    if (accumulatedDistance > 0) {
      const isWalking = travelMode === 'walking' || travelMode === 'accessible';
      steps.push({
        instruction: `Continue to destination on the ${isWalking ? 'pathway' : 'road'}`,
        distance: `${Math.round(accumulatedDistance)} m`,
        icon: 'straight'
      });
    }

    steps.push({
      instruction: `Arrive at ${endName}`,
      distance: '0 m',
      icon: 'end'
    });

    return { steps, totalDistance: `${Math.round(totalDist)} m` };
  };

  const calculateRouteClientSide = async (
    startBuilding: Building | typeof KIOSK_LOCATION,
    endBuilding: Building,
    travelMode: 'walking' | 'driving' | 'accessible'
  ): Promise<Array<{ lat: number; lng: number }> | null> => {
    try {
      // For route calculations, always fetch fresh paths data to ensure pathfinding uses latest updates
      // For accessible mode, use walkpaths (will be filtered by isPwdFriendly in pathfinding)
      const pathMode = travelMode === 'driving' ? 'driving' : 'walking';
      const endpoint = pathMode === 'walking' ? '/api/walkpaths' : '/api/drivepaths';
      const response = await fetch(endpoint, { 
        credentials: "include",
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        console.error(`[CLIENT] Failed to fetch ${endpoint} for pathfinding`);
        return null;
      }

      const paths = await response.json();

      if (!paths || paths.length === 0) {
        console.error('[CLIENT] No paths available for pathfinding');
        return null;
      }

      console.log(`[CLIENT] Fetched fresh ${travelMode} paths for route calculation:`, paths.length);

      const route = findShortestPath(
        startBuilding as Building,
        endBuilding,
        paths,
        travelMode
      );

      return route;
    } catch (error) {
      console.error('[CLIENT] Error calculating route:', error);
      return null;
    }
  };

  // Check if start location can drive directly (is a gate or parking)
  // KIOSK_LOCATION returns FALSE because the kiosk is where the USER is standing,
  // not where their VEHICLE is parked - user must select their parking location first
  const canStartDriving = (start: Building | typeof KIOSK_LOCATION): boolean => {
    if (start.id === 'kiosk') return false; // Kiosk requires parking selection - user's car isn't at the kiosk
    const startBuilding = start as Building;
    return isGate(startBuilding) || isParking(startBuilding);
  };

  // Generate a direct driving route (single phase)
  const generateDirectDrivingRoute = async (
    start: Building | typeof KIOSK_LOCATION,
    end: Building,
    vehicleType: VehicleType
  ): Promise<NavigationRoute | null> => {
    const drivingPolyline = await calculateRouteClientSide(start, end, 'driving');
    
    if (!drivingPolyline) {
      toast({
        title: "Route Calculation Failed",
        description: `Unable to calculate driving route to ${end.name}. Please try a different destination.`,
        variant: "destructive"
      });
      return null;
    }

    const { steps, totalDistance } = generateSmartSteps(
      drivingPolyline,
      'driving',
      start.name,
      end.name
    );

    toast({
      title: "Route Calculated",
      description: `Direct driving route to ${end.name}`,
      variant: "default"
    });

    return {
      start: { ...start, polygon: null, polygonColor: null } as Building,
      end,
      mode: 'driving',
      vehicleType,
      polyline: drivingPolyline,
      steps,
      totalDistance,
      phases: [
        {
          mode: 'driving',
          polyline: drivingPolyline,
          steps,
          distance: totalDistance,
          startName: start.name,
          endName: end.name,
          color: '#3B82F6',
          phaseIndex: 0,
          startId: (start as any).id,
          endId: end.id
        }
      ]
    };
  };

  // Generate route from driveable location to building (drive to parking, walk to building)
  const generateDriveToBuilding = async (
    start: Building | typeof KIOSK_LOCATION,
    end: Building,
    vehicleType: VehicleType
  ): Promise<NavigationRoute | null> => {
    // Find nearest parking to destination
    const parkingLocation = findNearestParkingByType(end, vehicleType);
    
    if (!parkingLocation) {
      toast({
        title: "No Parking Available",
        description: `No ${capitalizeVehicleType(vehicleType)} parking found near ${end.name}. Please try a different vehicle type.`,
        variant: "destructive"
      });
      return null;
    }

    // Check if parking is too far (>500m)
    const parkingDistance = calculateDistance(end.lat, end.lng, parkingLocation.lat, parkingLocation.lng);
    if (parkingDistance > 500) {
      toast({
        title: "Parking Distance Warning",
        description: `Nearest ${capitalizeVehicleType(vehicleType)} parking is ${Math.round(parkingDistance)}m from your destination. This may require a longer walk.`,
        variant: "default"
      });
    }

    // Phase 1: Drive to parking
    const drivingPolyline = await calculateRouteClientSide(start, parkingLocation, 'driving');
    
    if (!drivingPolyline) {
      toast({
        title: "Route Calculation Failed",
        description: `Unable to calculate driving route to ${parkingLocation.name}. Please try a different destination.`,
        variant: "destructive"
      });
      return null;
    }

    const drivingPhase = generateSmartSteps(drivingPolyline, 'driving', start.name, parkingLocation.name);

    // Phase 2: Walk from parking to destination
    const walkingPolyline = await calculateRouteClientSide(parkingLocation, end, 'walking');
    
    if (!walkingPolyline) {
      toast({
        title: "Route Calculation Failed",
        description: `Unable to calculate walking route from ${parkingLocation.name} to ${end.name}. Please try a different destination.`,
        variant: "destructive"
      });
      return null;
    }

    const walkingPhase = generateSmartSteps(walkingPolyline, 'walking', parkingLocation.name, end.name);

    // Combine both polylines and steps
    const combinedPolyline = [...drivingPolyline, ...walkingPolyline];
    const combinedSteps = [...drivingPhase.steps, ...walkingPhase.steps];

    const drivingDist = parseInt(drivingPhase.totalDistance.replace(' m', ''));
    const walkingDist = parseInt(walkingPhase.totalDistance.replace(' m', ''));
    const totalDist = drivingDist + walkingDist;

    toast({
      title: "Route Calculated",
      description: `You'll park at ${parkingLocation.name} and walk ${walkingPhase.totalDistance} to ${end.name}`,
      variant: "default"
    });

    return {
      start: { ...start, polygon: null, polygonColor: null } as Building,
      end,
      mode: 'driving',
      vehicleType,
      parkingLocation,
      polyline: combinedPolyline,
      steps: combinedSteps,
      totalDistance: `${totalDist} m`,
      phases: [
        {
          mode: 'driving',
          polyline: drivingPolyline,
          steps: drivingPhase.steps,
          distance: drivingPhase.totalDistance,
          startName: start.name,
          endName: parkingLocation.name,
          color: '#3B82F6',
          phaseIndex: 0,
          startId: (start as any).id,
          endId: parkingLocation.id
        },
        {
          mode: 'walking',
          polyline: walkingPolyline,
          steps: walkingPhase.steps,
          distance: walkingPhase.totalDistance,
          startName: parkingLocation.name,
          endName: end.name,
          color: '#10B981',
          phaseIndex: 1,
          startId: parkingLocation.id,
          endId: end.id
        }
      ]
    };
  };

  // Generate route from building using user-selected parking (walk to parking, drive to dest parking, walk to dest)
  const generateBuildingDepartureRoute = async (
    start: Building,
    end: Building,
    vehicleType: VehicleType,
    userSelectedParking: Building,
    userSelectedDestParking?: Building
  ): Promise<NavigationRoute | null> => {
    const phases: RoutePhase[] = [];
    let allPolylines: LatLng[] = [];
    let allSteps: RouteStep[] = [];
    let totalDistanceMeters = 0;

    // Phase 1: Walk from building to user's selected parking
    const walkToCarPolyline = await calculateRouteClientSide(start, userSelectedParking, 'walking');
    
    if (!walkToCarPolyline) {
      toast({
        title: "Route Calculation Failed",
        description: `Unable to calculate walking route to ${userSelectedParking.name}.`,
        variant: "destructive"
      });
      return null;
    }

    const walkToCarPhase = generateSmartSteps(walkToCarPolyline, 'walking', start.name, userSelectedParking.name);
    phases.push({
      mode: 'walking',
      polyline: walkToCarPolyline,
      steps: walkToCarPhase.steps,
      distance: walkToCarPhase.totalDistance,
      startName: start.name,
      endName: userSelectedParking.name,
      color: '#10B981',
      phaseIndex: 0,
      startId: start.id,
      endId: userSelectedParking.id
    });
    allPolylines = [...allPolylines, ...walkToCarPolyline];
    allSteps = [...allSteps, ...walkToCarPhase.steps];
    totalDistanceMeters += parseInt(walkToCarPhase.totalDistance.replace(' m', ''));

    // Determine driving destination and if we need final walking phase
    let drivingDestination: Building;
    let needsFinalWalk = false;

    if (isGate(end) || isParkingForVehicle(end, vehicleType)) {
      // Destination is a gate or matching parking - drive directly there
      drivingDestination = end;
    } else if (userSelectedDestParking) {
      // User selected a destination parking - use that
      drivingDestination = userSelectedDestParking;
      needsFinalWalk = true;
    } else {
      // Fallback to nearest parking (should not happen with new flow)
      const destParking = findNearestParkingByType(end, vehicleType);
      if (!destParking) {
        toast({
          title: "No Parking Available",
          description: `No ${capitalizeVehicleType(vehicleType)} parking found near ${end.name}.`,
          variant: "destructive"
        });
        return null;
      }
      drivingDestination = destParking;
      needsFinalWalk = true;
    }

    // Phase 2: Drive from user's parking to driving destination
    const drivePolyline = await calculateRouteClientSide(userSelectedParking, drivingDestination, 'driving');
    
    if (!drivePolyline) {
      toast({
        title: "Route Calculation Failed",
        description: `Unable to calculate driving route to ${drivingDestination.name}.`,
        variant: "destructive"
      });
      return null;
    }

    const drivePhase = generateSmartSteps(drivePolyline, 'driving', userSelectedParking.name, drivingDestination.name);
    phases.push({
      mode: 'driving',
      polyline: drivePolyline,
      steps: drivePhase.steps,
      distance: drivePhase.totalDistance,
      startName: userSelectedParking.name,
      endName: drivingDestination.name,
      color: '#3B82F6',
      phaseIndex: phases.length,
      startId: userSelectedParking.id,
      endId: drivingDestination.id
    });
    allPolylines = [...allPolylines, ...drivePolyline];
    allSteps = [...allSteps, ...drivePhase.steps];
    totalDistanceMeters += parseInt(drivePhase.totalDistance.replace(' m', ''));

    // Phase 3 (if needed): Walk from destination parking to final building
    if (needsFinalWalk) {
      const finalWalkPolyline = await calculateRouteClientSide(drivingDestination, end, 'walking');
      
      if (!finalWalkPolyline) {
        toast({
          title: "Route Calculation Failed",
          description: `Unable to calculate walking route to ${end.name}.`,
          variant: "destructive"
        });
        return null;
      }

      const finalWalkPhase = generateSmartSteps(finalWalkPolyline, 'walking', drivingDestination.name, end.name);
      phases.push({
        mode: 'walking',
        polyline: finalWalkPolyline,
        steps: finalWalkPhase.steps,
        distance: finalWalkPhase.totalDistance,
        startName: drivingDestination.name,
        endName: end.name,
        color: '#10B981',
        phaseIndex: phases.length,
        startId: drivingDestination.id,
        endId: end.id
      });
      allPolylines = [...allPolylines, ...finalWalkPolyline];
      allSteps = [...allSteps, ...finalWalkPhase.steps];
      totalDistanceMeters += parseInt(finalWalkPhase.totalDistance.replace(' m', ''));
    }

    const phaseDescriptions = phases.map(p => 
      p.mode === 'walking' ? `Walk ${p.distance}` : `Drive ${p.distance}`
    ).join(' then ');
    
    toast({
      title: "Route Calculated",
      description: phaseDescriptions,
      variant: "default"
    });

    return {
      start: { ...start, polygon: null, polygonColor: null },
      end,
      mode: 'driving',
      vehicleType,
      parkingLocation: userSelectedParking,
      polyline: allPolylines,
      steps: allSteps,
      totalDistance: `${totalDistanceMeters} m`,
      phases
    };
  };

  // Generate route from Kiosk location using user-selected parking
  // Route: Kiosk (walk) -> selected origin parking (drive) -> selected destination parking (walk) -> destination
  const generateKioskDepartureRoute = async (
    userSelectedParking: Building,
    end: Building,
    vehicleType: VehicleType,
    userSelectedDestParking?: Building
  ): Promise<NavigationRoute | null> => {
    const phases: RoutePhase[] = [];
    let allPolylines: LatLng[] = [];
    let allSteps: RouteStep[] = [];
    let totalDistanceMeters = 0;

    // Get Kiosk building from database for proper pathfinding
    const kioskBuildingForRoute = kioskBuilding || (KIOSK_LOCATION as any);
    const kioskStartName = kioskBuildingForRoute.name || 'Your Location (Kiosk)';
    const kioskStartId = kioskBuildingForRoute.id || 'kiosk';

    // Phase 1: Walk from Kiosk to user's selected parking
    // Use calculateRouteClientSide if Kiosk is a proper building, fallback to point-based
    let walkToCarPolyline: LatLng[] | null = null;
    
    if (kioskBuilding) {
      // Kiosk is in database - use proper building-to-building pathfinding
      walkToCarPolyline = await calculateRouteClientSide(kioskBuilding, userSelectedParking, 'walking');
    } else {
      // Fallback using KIOSK_LOCATION constant (calculateRouteClientSide accepts typeof KIOSK_LOCATION)
      walkToCarPolyline = await calculateRouteClientSide(KIOSK_LOCATION, userSelectedParking, 'walking');
    }
    
    if (!walkToCarPolyline) {
      toast({
        title: "Route Calculation Failed",
        description: `Unable to calculate walking route to ${userSelectedParking.name}. Please ensure the Kiosk is connected to walking paths.`,
        variant: "destructive"
      });
      return null;
    }

    const walkToCarPhase = generateSmartSteps(walkToCarPolyline, 'walking', kioskStartName, userSelectedParking.name);
    phases.push({
      mode: 'walking',
      polyline: walkToCarPolyline,
      steps: walkToCarPhase.steps,
      distance: walkToCarPhase.totalDistance,
      startName: kioskStartName,
      endName: userSelectedParking.name,
      color: '#10B981',
      phaseIndex: 0,
      startId: kioskStartId,
      endId: userSelectedParking.id
    });
    allPolylines = [...allPolylines, ...walkToCarPolyline];
    allSteps = [...allSteps, ...walkToCarPhase.steps];
    totalDistanceMeters += parseInt(walkToCarPhase.totalDistance.replace(' m', ''));

    // Determine driving destination and if we need final walking phase
    let drivingDestination: Building;
    let needsFinalWalk = false;

    if (isGate(end) || isParkingForVehicle(end, vehicleType)) {
      // Destination is already a gate or parking - drive there directly
      drivingDestination = end;
    } else if (userSelectedDestParking) {
      // User selected a destination parking - use that
      drivingDestination = userSelectedDestParking;
      needsFinalWalk = true;
    } else {
      // Fallback to nearest parking (should not happen with new flow)
      const destParking = findNearestParkingByType(end, vehicleType);
      if (!destParking) {
        toast({
          title: "No Parking Available",
          description: `No ${capitalizeVehicleType(vehicleType)} parking found near ${end.name}.`,
          variant: "destructive"
        });
        return null;
      }
      drivingDestination = destParking;
      needsFinalWalk = true;
    }

    // Phase 2: Drive from user's parking to driving destination
    const drivePolyline = await calculateRouteClientSide(userSelectedParking, drivingDestination, 'driving');
    
    if (!drivePolyline) {
      toast({
        title: "Route Calculation Failed",
        description: `Unable to calculate driving route to ${drivingDestination.name}.`,
        variant: "destructive"
      });
      return null;
    }

    const drivePhase = generateSmartSteps(drivePolyline, 'driving', userSelectedParking.name, drivingDestination.name);
    phases.push({
      mode: 'driving',
      polyline: drivePolyline,
      steps: drivePhase.steps,
      distance: drivePhase.totalDistance,
      startName: userSelectedParking.name,
      endName: drivingDestination.name,
      color: '#3B82F6',
      phaseIndex: phases.length,
      startId: userSelectedParking.id,
      endId: drivingDestination.id
    });
    allPolylines = [...allPolylines, ...drivePolyline];
    allSteps = [...allSteps, ...drivePhase.steps];
    totalDistanceMeters += parseInt(drivePhase.totalDistance.replace(' m', ''));

    // Phase 3 (if needed): Walk from destination parking to final building
    if (needsFinalWalk) {
      const finalWalkPolyline = await calculateRouteClientSide(drivingDestination, end, 'walking');
      
      if (!finalWalkPolyline) {
        toast({
          title: "Route Calculation Failed",
          description: `Unable to calculate walking route to ${end.name}.`,
          variant: "destructive"
        });
        return null;
      }

      const finalWalkPhase = generateSmartSteps(finalWalkPolyline, 'walking', drivingDestination.name, end.name);
      phases.push({
        mode: 'walking',
        polyline: finalWalkPolyline,
        steps: finalWalkPhase.steps,
        distance: finalWalkPhase.totalDistance,
        startName: drivingDestination.name,
        endName: end.name,
        color: '#10B981',
        phaseIndex: phases.length,
        startId: drivingDestination.id,
        endId: end.id
      });
      allPolylines = [...allPolylines, ...finalWalkPolyline];
      allSteps = [...allSteps, ...finalWalkPhase.steps];
      totalDistanceMeters += parseInt(finalWalkPhase.totalDistance.replace(' m', ''));
    }

    const phaseDescriptions = phases.map(p => 
      p.mode === 'walking' ? `Walk ${p.distance}` : `Drive ${p.distance}`
    ).join(' then ');
    
    toast({
      title: "Route Calculated",
      description: phaseDescriptions,
      variant: "default"
    });

    return {
      start: { ...kioskBuildingForRoute, polygon: null, polygonColor: null },
      end,
      mode: 'driving',
      vehicleType,
      parkingLocation: userSelectedParking,
      polyline: allPolylines,
      steps: allSteps,
      totalDistance: `${totalDistanceMeters} m`,
      phases
    };
  };

  // Handler for when user selects a parking location on the map
  const handleParkingSelection = async (parking: Building) => {
    // Handle waypoint driving route parking selection flow
    if (pendingWaypointDrivingRoute && vehicleType && waypointParkingMode) {
      if (waypointParkingMode === 'origin') {
        // User selected origin parking - auto-select parking for all stops
        setSelectedOriginParking(parking);
        setParkingSelectionMode(false);
        setShowParkingSelector(false);
        setWaypointParkingMode(null);
        
        await generateWaypointDrivingRoute(
          pendingWaypointDrivingRoute.start,
          pendingWaypointDrivingRoute.end,
          pendingWaypointDrivingRoute.waypoints,
          pendingWaypointDrivingRoute.vehicleType,
          parking
        );
        
        setPendingWaypointDrivingRoute(null);
        setSelectedOriginParking(null);
        setSelectedWaypointParking(null);
        return;
      } else if (waypointParkingMode === 'waypoint') {
        // Gate start - user selected first stop parking, use it as starting parking
        setParkingSelectionMode(false);
        setShowParkingSelector(false);
        setWaypointParkingMode(null);
        
        // For gate starts, we auto-select from the first parking the user chose
        await generateWaypointDrivingRoute(
          pendingWaypointDrivingRoute.start,
          pendingWaypointDrivingRoute.end,
          pendingWaypointDrivingRoute.waypoints,
          pendingWaypointDrivingRoute.vehicleType,
          null
        );
        
        setPendingWaypointDrivingRoute(null);
        setSelectedOriginParking(null);
        setSelectedWaypointParking(null);
        return;
      }
    }
    
    // Two-step parking selection flow for non-waypoint driving routes
    if (!pendingDrivingRoute || !vehicleType) return;

    const { start, end, vehicleType: vType, waypoints: waypointBuildings } = pendingDrivingRoute;
    const isKioskStart = start.id === 'kiosk';

    // Check if destination is already a parking lot or gate (no need for destination parking selection)
    const destIsParkingOrGate = isParkingForVehicle(end, vType) || isGate(end);

    // Handle two-step parking selection for routes without waypoints
    if (waypointBuildings.length === 0 && drivingParkingMode) {
      if (drivingParkingMode === 'origin') {
        // Step 1: User selected origin parking (where their vehicle is parked)
        setSelectedVehicleParking(parking);
        
        // If destination is already a parking lot or gate, skip destination parking selection
        if (destIsParkingOrGate) {
          // Generate route directly with origin parking and destination as-is
          setParkingSelectionMode(false);
          setShowParkingSelector(false);
          setDrivingParkingMode(null);
          
          if (isKioskStart) {
            const route = await generateKioskDepartureRoute(parking, end, vType, end);
            if (route) {
              setRoute(route);
              try {
                const routeData: any = {
                  startId: start.id,
                  endId: end.id,
                  waypoints: [],
                  mode: 'driving',
                  vehicleType: vType,
                  phases: route.phases || [],
                  expiresAt: null
                };
                if (destinationRoom) {
                  routeData.destinationRoomId = destinationRoom.id;
                  routeData.destinationBuildingId = end.id;
                  routeData.destinationFloorId = destinationRoom.floorId;
                  routeData.destinationRoomName = destinationRoom.label || 'Room';
                }
                const res = await apiRequest('POST', '/api/routes', routeData);
                const response = await res.json();
                if (response.id) setSavedRouteId(response.id);
              } catch (error) {
                console.error('Error saving kiosk departure route:', error);
              }
            }
          } else {
            const route = await generateBuildingDepartureRoute(start as Building, end, vType, parking, end);
            if (route) {
              setRoute(route);
              try {
                const routeData: any = {
                  startId: start.id,
                  endId: end.id,
                  waypoints: [],
                  mode: 'driving',
                  vehicleType: vType,
                  phases: route.phases || [],
                  expiresAt: null
                };
                if (destinationRoom) {
                  routeData.destinationRoomId = destinationRoom.id;
                  routeData.destinationBuildingId = end.id;
                  routeData.destinationFloorId = destinationRoom.floorId;
                  routeData.destinationRoomName = destinationRoom.label || 'Room';
                }
                const res = await apiRequest('POST', '/api/routes', routeData);
                const response = await res.json();
                if (response.id) setSavedRouteId(response.id);
              } catch (error) {
                console.error('Error saving building departure route:', error);
              }
            }
          }
          setPendingDrivingRoute(null);
          setSelectedVehicleParking(null);
          setSelectedDestinationParking(null);
          return;
        }
        
        // Step 2: Now ask user to select destination parking
        setDrivingParkingMode('destination');
        toast({
          title: "Step 2: Select Destination Parking",
          description: `Tap on the ${capitalizeVehicleType(vType)} parking area where you want to park near ${end.name}.`,
          variant: "default"
        });
        return;
      } else if (drivingParkingMode === 'destination') {
        // User selected destination parking
        setSelectedDestinationParking(parking);
        setParkingSelectionMode(false);
        setShowParkingSelector(false);
        setDrivingParkingMode(null);
        
        const originParking = selectedVehicleParking;
        const startIsGate = isGate(start);
        
        // If starting from a gate, no origin parking is needed - user drives directly from gate
        if (startIsGate) {
          // Gate start: Drive from gate to destination parking, then walk to destination
          const drivePolyline = await calculateRouteClientSide(start as Building, parking, 'driving');
          const walkPolyline = await calculateRouteClientSide(parking, end, 'walking');
          
          if (!drivePolyline) {
            toast({
              title: "Route Calculation Failed",
              description: "Unable to calculate driving route from gate to parking.",
              variant: "destructive"
            });
            setPendingDrivingRoute(null);
            return;
          }
          
          const phases: NavigationRoute['phases'] = [];
          let allPolylines: LatLng[] = [...drivePolyline];
          let allSteps: RouteStep[] = [];
          let totalDistanceMeters = 0;
          
          // Phase 1: Drive from gate to destination parking
          const { steps: driveSteps, totalDistance: driveDist } = generateSmartSteps(
            drivePolyline, 'driving', start.name, parking.name
          );
          phases.push({
            mode: 'driving',
            startName: start.name,
            endName: parking.name,
            startId: start.id,
            endId: parking.id,
            distance: driveDist,
            polyline: drivePolyline,
            steps: driveSteps,
            color: '#2563eb',
            phaseIndex: 0
          });
          allSteps = [...driveSteps];
          totalDistanceMeters += parseInt(driveDist.replace(' m', ''));
          
          // Phase 2: Walk from parking to final destination (if not same as parking)
          if (parking.id !== end.id) {
            if (!walkPolyline) {
              toast({
                title: "Route Calculation Failed",
                description: "Unable to calculate walking route from parking to destination.",
                variant: "destructive"
              });
              setPendingDrivingRoute(null);
              return;
            }
            const { steps: walkSteps, totalDistance: walkDist } = generateSmartSteps(
              walkPolyline, 'walking', parking.name, end.name
            );
            phases.push({
              mode: 'walking',
              startName: parking.name,
              endName: end.name,
              startId: parking.id,
              endId: end.id,
              distance: walkDist,
              polyline: walkPolyline,
              steps: walkSteps,
              color: '#16a34a',
              phaseIndex: 1
            });
            allPolylines = [...allPolylines, ...walkPolyline];
            allSteps = [...allSteps, ...walkSteps];
            totalDistanceMeters += parseInt(walkDist.replace(' m', ''));
          }
          
          const route: NavigationRoute = {
            start: { ...start, polygon: null, polygonColor: null } as Building,
            end,
            mode: 'driving',
            vehicleType: vType,
            parkingLocation: parking,
            polyline: allPolylines,
            steps: allSteps,
            totalDistance: `${totalDistanceMeters} m`,
            phases
          };
          
          setRoute(route);
          
          try {
            const routeData: any = {
              startId: start.id,
              endId: end.id,
              waypoints: [],
              mode: 'driving',
              vehicleType: vType,
              phases: route.phases || [],
              expiresAt: null
            };
            if (destinationRoom) {
              routeData.destinationRoomId = destinationRoom.id;
              routeData.destinationBuildingId = end.id;
              routeData.destinationFloorId = destinationRoom.floorId;
              routeData.destinationRoomName = destinationRoom.label || 'Room';
            }
            const res = await apiRequest('POST', '/api/routes', routeData);
            const response = await res.json();
            if (response.id) setSavedRouteId(response.id);
          } catch (error) {
            console.error('Error saving gate departure route:', error);
          }
          
          toast({
            title: "Route Calculated",
            description: `Drive ${phases[0].distance} then Walk ${phases[1]?.distance || '0 m'}`,
            variant: "default"
          });
          
          setPendingDrivingRoute(null);
          setSelectedVehicleParking(null);
          setSelectedDestinationParking(null);
          return;
        }
        
        // Non-gate start: require origin parking
        if (!originParking) {
          toast({
            title: "Error",
            description: "Origin parking was not selected. Please try again.",
            variant: "destructive"
          });
          setPendingDrivingRoute(null);
          return;
        }
        
        // Generate route with both origin and destination parking
        if (isKioskStart) {
          const route = await generateKioskDepartureRoute(originParking, end, vType, parking);
          if (route) {
            setRoute(route);
            try {
              const routeData: any = {
                startId: start.id,
                endId: end.id,
                waypoints: [],
                mode: 'driving',
                vehicleType: vType,
                phases: route.phases || [],
                expiresAt: null
              };
              if (destinationRoom) {
                routeData.destinationRoomId = destinationRoom.id;
                routeData.destinationBuildingId = end.id;
                routeData.destinationFloorId = destinationRoom.floorId;
                routeData.destinationRoomName = destinationRoom.label || 'Room';
              }
              const res = await apiRequest('POST', '/api/routes', routeData);
              const response = await res.json();
              if (response.id) setSavedRouteId(response.id);
            } catch (error) {
              console.error('Error saving kiosk departure route:', error);
            }
          }
        } else {
          const route = await generateBuildingDepartureRoute(start as Building, end, vType, originParking, parking);
          if (route) {
            setRoute(route);
            try {
              const routeData: any = {
                startId: start.id,
                endId: end.id,
                waypoints: [],
                mode: 'driving',
                vehicleType: vType,
                phases: route.phases || [],
                expiresAt: null
              };
              if (destinationRoom) {
                routeData.destinationRoomId = destinationRoom.id;
                routeData.destinationBuildingId = end.id;
                routeData.destinationFloorId = destinationRoom.floorId;
                routeData.destinationRoomName = destinationRoom.label || 'Room';
              }
              const res = await apiRequest('POST', '/api/routes', routeData);
              const response = await res.json();
              if (response.id) setSavedRouteId(response.id);
            } catch (error) {
              console.error('Error saving building departure route:', error);
            }
          }
        }
        
        setPendingDrivingRoute(null);
        setSelectedVehicleParking(null);
        setSelectedDestinationParking(null);
        return;
      }
    }

    // Legacy fallback for routes with waypoints (uses existing logic)
    setSelectedVehicleParking(parking);
    setParkingSelectionMode(false);
    setShowParkingSelector(false);
    setDrivingParkingMode(null);

    const waypointIds = waypointBuildings.map(w => w.id);
    const startName = start.id === 'kiosk' ? (kioskBuilding?.name || KIOSK_LOCATION.name) : (start as Building).name;

    // Route with waypoints only - no waypoints means we already handled it above
    if (waypointBuildings.length > 0) {
      // Route with waypoints - build multi-phase route with user-selected parking
      try {
        const phases: NavigationRoute['phases'] = [];
        let allPolylines: LatLng[] = [];
        let allSteps: RouteStep[] = [];
        let totalDistanceMeters = 0;

        // Phase 1: Walk from starting location (building or kiosk) to user-selected parking
        let initialWalkPolyline: LatLng[] | null;
        if (isKioskStart) {
          // Use Kiosk building from database for proper pathfinding
          if (kioskBuilding) {
            initialWalkPolyline = await calculateRouteClientSide(kioskBuilding, parking, 'walking');
          } else {
            // Fallback using KIOSK_LOCATION constant (calculateRouteClientSide accepts typeof KIOSK_LOCATION)
            initialWalkPolyline = await calculateRouteClientSide(KIOSK_LOCATION, parking, 'walking');
          }
        } else {
          initialWalkPolyline = await calculateRouteClientSide(start as Building, parking, 'walking');
        }
        
        if (!initialWalkPolyline) {
          toast({
            title: "Route Calculation Failed",
            description: `Unable to calculate walking route to ${parking.name}.`,
            variant: "destructive"
          });
          setPendingDrivingRoute(null);
          return;
        }

        const initialWalkPhase = generateSmartSteps(initialWalkPolyline, 'walking', startName, parking.name);
        phases.push({
          mode: 'walking',
          polyline: initialWalkPolyline,
          steps: initialWalkPhase.steps,
          distance: initialWalkPhase.totalDistance,
          startName: startName,
          endName: parking.name,
          color: '#10B981',
          phaseIndex: 0,
          startId: start.id,
          endId: parking.id
        });
        allPolylines = [...allPolylines, ...initialWalkPolyline];
        allSteps = [...allSteps, ...initialWalkPhase.steps];
        totalDistanceMeters += parseInt(initialWalkPhase.totalDistance.replace(' m', ''));

        // Build multi-stop driving route with proper walk segments to actual buildings
        // Pattern for each waypoint: Drive to parking -> Walk to building -> Walk back -> Drive to next
        
        let currentLocation = parking; // Start driving from user-selected parking

        // Process each waypoint with drive + walk + walk back segments
        for (let i = 0; i < waypointBuildings.length; i++) {
          const waypoint = waypointBuildings[i];
          
          // For gates/parking waypoints, just drive there directly (no walk segments needed)
          if (isGate(waypoint) || isParking(waypoint)) {
            const drivePolyline = await calculateRouteClientSide(currentLocation, waypoint, 'driving');
            if (!drivePolyline) {
              toast({
                title: "Route Calculation Failed",
                description: `Unable to calculate driving route to ${waypoint.name}.`,
                variant: "destructive"
              });
              setPendingDrivingRoute(null);
              return;
            }

            const drivePhase = generateSmartSteps(drivePolyline, 'driving', currentLocation.name, waypoint.name);
            phases.push({
              mode: 'driving',
              polyline: drivePolyline,
              steps: drivePhase.steps,
              distance: drivePhase.totalDistance,
              startName: currentLocation.name,
              endName: waypoint.name,
              color: '#3B82F6',
              phaseIndex: phases.length,
              startId: currentLocation.id,
              endId: waypoint.id
            });
            allPolylines = [...allPolylines, ...drivePolyline];
            allSteps = [...allSteps, ...drivePhase.steps];
            totalDistanceMeters += parseInt(drivePhase.totalDistance.replace(' m', ''));
            
            currentLocation = waypoint;
          } else {
            // For regular buildings: Drive to nearby parking, walk to building, walk back
            const waypointParking = findNearestParkingByType(waypoint, vType);
            if (!waypointParking) {
              toast({
                title: "No Parking Near Waypoint",
                description: `No ${capitalizeVehicleType(vType)} parking found near ${waypoint.name}.`,
                variant: "destructive"
              });
              setPendingDrivingRoute(null);
              return;
            }

            // Segment A: Drive from current location to waypoint parking
            const driveToWaypointParkingPolyline = await calculateRouteClientSide(currentLocation, waypointParking, 'driving');
            if (!driveToWaypointParkingPolyline) {
              toast({
                title: "Route Calculation Failed",
                description: `Unable to calculate driving route to ${waypointParking.name}.`,
                variant: "destructive"
              });
              setPendingDrivingRoute(null);
              return;
            }

            const driveToWaypointPhase = generateSmartSteps(driveToWaypointParkingPolyline, 'driving', currentLocation.name, waypointParking.name);
            phases.push({
              mode: 'driving',
              polyline: driveToWaypointParkingPolyline,
              steps: driveToWaypointPhase.steps,
              distance: driveToWaypointPhase.totalDistance,
              startName: currentLocation.name,
              endName: waypointParking.name,
              color: '#3B82F6',
              phaseIndex: phases.length,
              startId: currentLocation.id,
              endId: waypointParking.id
            });
            allPolylines = [...allPolylines, ...driveToWaypointParkingPolyline];
            allSteps = [...allSteps, ...driveToWaypointPhase.steps];
            totalDistanceMeters += parseInt(driveToWaypointPhase.totalDistance.replace(' m', ''));

            // Segment B: Walk from parking to waypoint building
            const walkToWaypointPolyline = await calculateRouteClientSide(waypointParking, waypoint, 'walking');
            if (!walkToWaypointPolyline) {
              toast({
                title: "Route Calculation Failed",
                description: `Unable to calculate walking route to ${waypoint.name}.`,
                variant: "destructive"
              });
              setPendingDrivingRoute(null);
              return;
            }

            const walkToWaypointPhase = generateSmartSteps(walkToWaypointPolyline, 'walking', waypointParking.name, waypoint.name);
            phases.push({
              mode: 'walking',
              polyline: walkToWaypointPolyline,
              steps: walkToWaypointPhase.steps,
              distance: walkToWaypointPhase.totalDistance,
              startName: waypointParking.name,
              endName: waypoint.name,
              color: '#10B981',
              phaseIndex: phases.length,
              startId: waypointParking.id,
              endId: waypoint.id
            });
            allPolylines = [...allPolylines, ...walkToWaypointPolyline];
            allSteps = [...allSteps, ...walkToWaypointPhase.steps];
            totalDistanceMeters += parseInt(walkToWaypointPhase.totalDistance.replace(' m', ''));

            // Segment C: Walk back from waypoint building to parking
            const walkBackPolyline = await calculateRouteClientSide(waypoint, waypointParking, 'walking');
            if (!walkBackPolyline) {
              toast({
                title: "Route Calculation Failed",
                description: `Unable to calculate return walking route from ${waypoint.name}.`,
                variant: "destructive"
              });
              setPendingDrivingRoute(null);
              return;
            }

            const walkBackPhase = generateSmartSteps(walkBackPolyline, 'walking', waypoint.name, waypointParking.name);
            phases.push({
              mode: 'walking',
              polyline: walkBackPolyline,
              steps: walkBackPhase.steps,
              distance: walkBackPhase.totalDistance,
              startName: waypoint.name,
              endName: waypointParking.name,
              color: '#10B981',
              phaseIndex: phases.length,
              startId: waypoint.id,
              endId: waypointParking.id
            });
            allPolylines = [...allPolylines, ...walkBackPolyline];
            allSteps = [...allSteps, ...walkBackPhase.steps];
            totalDistanceMeters += parseInt(walkBackPhase.totalDistance.replace(' m', ''));

            currentLocation = waypointParking; // Continue driving from waypoint parking
          }
        }

        // Determine final driving destination
        const needsFinalWalk = !isGate(end) && !isParkingForVehicle(end, vType);
        let finalDriveStop: Building;
        if (needsFinalWalk) {
          const nearbyParking = findNearestParkingByType(end, vType);
          if (!nearbyParking) {
            toast({
              title: "No Nearby Parking",
              description: `No ${capitalizeVehicleType(vType)} parking found near ${end.name}.`,
              variant: "destructive"
            });
            setPendingDrivingRoute(null);
            return;
          }
          finalDriveStop = nearbyParking;
        } else {
          finalDriveStop = end;
        }

        // Drive from current location (last waypoint parking) to final destination/parking
        const finalDrivePolyline = await calculateRouteClientSide(currentLocation, finalDriveStop, 'driving');
        if (!finalDrivePolyline) {
          toast({
            title: "Route Calculation Failed",
            description: `Unable to calculate driving route to ${finalDriveStop.name}.`,
            variant: "destructive"
          });
          setPendingDrivingRoute(null);
          return;
        }

        const finalDrivePhase = generateSmartSteps(finalDrivePolyline, 'driving', currentLocation.name, finalDriveStop.name);
        phases.push({
          mode: 'driving',
          polyline: finalDrivePolyline,
          steps: finalDrivePhase.steps,
          distance: finalDrivePhase.totalDistance,
          startName: currentLocation.name,
          endName: finalDriveStop.name,
          color: '#3B82F6',
          phaseIndex: phases.length,
          startId: currentLocation.id,
          endId: finalDriveStop.id
        });
        allPolylines = [...allPolylines, ...finalDrivePolyline];
        allSteps = [...allSteps, ...finalDrivePhase.steps];
        totalDistanceMeters += parseInt(finalDrivePhase.totalDistance.replace(' m', ''));

        // Final phase: Walk from final parking to destination building (if needed)
        if (needsFinalWalk) {
          const finalWalkPolyline = await calculateRouteClientSide(finalDriveStop, end, 'walking');
          if (!finalWalkPolyline) {
            toast({
              title: "Route Calculation Failed",
              description: `Unable to calculate walking route to ${end.name}.`,
              variant: "destructive"
            });
            setPendingDrivingRoute(null);
            return;
          }

          const finalWalkPhase = generateSmartSteps(finalWalkPolyline, 'walking', finalDriveStop.name, end.name);
          phases.push({
            mode: 'walking',
            polyline: finalWalkPolyline,
            steps: finalWalkPhase.steps,
            distance: finalWalkPhase.totalDistance,
            startName: finalDriveStop.name,
            endName: end.name,
            color: '#10B981',
            phaseIndex: phases.length,
            startId: finalDriveStop.id,
            endId: end.id
          });
          allPolylines = [...allPolylines, ...finalWalkPolyline];
          allSteps = [...allSteps, ...finalWalkPhase.steps];
          totalDistanceMeters += parseInt(finalWalkPhase.totalDistance.replace(' m', ''));
        }

        // Construct start object - handle both Kiosk and Building
        const startForRoute = isKioskStart 
          ? { ...(kioskBuilding || KIOSK_LOCATION as any), polygon: null, polygonColor: null }
          : { ...(start as Building), polygon: null, polygonColor: null };

        const route: NavigationRoute = {
          start: startForRoute,
          end,
          mode: 'driving',
          vehicleType: vType,
          parkingLocation: parking,
          polyline: allPolylines,
          steps: allSteps,
          totalDistance: `${totalDistanceMeters} m`,
          phases
        };

        setRoute(route);

        // Save route for QR code
        try {
          const routeData: any = {
            startId: start.id,
            endId: end.id,
            waypoints: waypointIds,
            mode: 'driving',
            vehicleType: vType,
            phases: route.phases || [],
            expiresAt: null
          };
          if (destinationRoom) {
            routeData.destinationRoomId = destinationRoom.id;
            routeData.destinationBuildingId = end.id;
            routeData.destinationFloorId = destinationRoom.floorId;
            routeData.destinationRoomName = destinationRoom.label || 'Room';
          }

          const res = await apiRequest('POST', '/api/routes', routeData);
          const response = await res.json();
          if (response.id) {
            setSavedRouteId(response.id);
          }
        } catch (error) {
          console.error('Error saving waypoint driving route:', error);
        }

        const phaseDescriptions = phases.map(p => 
          p.mode === 'walking' ? `Walk ${p.distance}` : `Drive ${p.distance}`
        ).join(' then ');
        
        toast({
          title: "Route Calculated",
          description: phaseDescriptions,
          variant: "default"
        });
      } catch (error) {
        console.error('Error generating waypoint route:', error);
        toast({
          title: "Route Calculation Failed",
          description: "Unable to calculate route with waypoints.",
          variant: "destructive"
        });
      }
    }

    setPendingDrivingRoute(null);
  };

  // Cancel parking selection mode
  const cancelParkingSelection = () => {
    setParkingSelectionMode(false);
    setShowParkingSelector(false);
    setPendingDrivingRoute(null);
    setPendingWaypointDrivingRoute(null);
    setWaypointParkingMode(null);
    setSelectedVehicleParking(null);
    setSelectedOriginParking(null);
    setSelectedWaypointParking(null);
    toast({
      title: "Route Cancelled",
      description: "Parking selection was cancelled.",
      variant: "default"
    });
  };

  // Generate driving route with waypoints using auto-selected parking locations
  const generateWaypointDrivingRoute = async (
    start: Building | typeof KIOSK_LOCATION,
    end: Building,
    waypointBuildings: Building[],
    vType: VehicleType,
    originParking: Building | null
  ) => {
    setIsGeneratingRoute(true);
    try {
      const WALK_PROXIMITY_THRESHOLD = 100;
      const phases: NavigationRoute['phases'] = [];
      let allPolylines: LatLng[] = [];
      let allSteps: RouteStep[] = [];
      let totalDistanceMeters = 0;
      
      const startName = start.id === 'kiosk' ? (kioskBuilding?.name || KIOSK_LOCATION.name) : (start as Building).name;
      const isKioskStart = start.id === 'kiosk';
      const startIsGate = isGate(start);
      const waypointIds = waypointBuildings.map(w => w.id);
      
      let currentLocation: Building;
      let currentParking: Building | null = originParking;

      // Build allStops early so we can check first-stop proximity before the initial walk
      const allStops = [...waypointBuildings, end];
      
      if (startIsGate) {
        currentLocation = start as Building;
        currentParking = null;
      } else if (originParking) {
        // If the first stop is already close to the parked vehicle, skip the
        // "walk to parking" opening phase and start directly from the building.
        const firstStop = allStops[0];
        const distToFirstStop = calculateDistance(
          originParking.lat, originParking.lng,
          firstStop.lat, firstStop.lng
        );
        const firstStopIsClose = distToFirstStop <= WALK_PROXIMITY_THRESHOLD;

        if (firstStopIsClose) {
          currentLocation = isKioskStart ? (kioskBuilding || start as Building) : (start as Building);
        } else {
          let initialWalkPolyline: LatLng[] | null;
          if (isKioskStart) {
            if (kioskBuilding) {
              initialWalkPolyline = await calculateRouteClientSide(kioskBuilding, originParking, 'walking');
            } else {
              initialWalkPolyline = await calculateRouteClientSide(KIOSK_LOCATION, originParking, 'walking');
            }
          } else {
            initialWalkPolyline = await calculateRouteClientSide(start as Building, originParking, 'walking');
          }
          
          if (!initialWalkPolyline) {
            toast({
              title: "Route Calculation Failed",
              description: `Unable to calculate walking route to ${originParking.name}.`,
              variant: "destructive"
            });
            return;
          }
          
          const initialWalkPhase = generateSmartSteps(initialWalkPolyline, 'walking', startName, originParking.name);
          phases.push({
            mode: 'walking',
            polyline: initialWalkPolyline,
            steps: initialWalkPhase.steps,
            distance: initialWalkPhase.totalDistance,
            startName: startName,
            endName: originParking.name,
            color: '#10B981',
            phaseIndex: 0,
            startId: start.id,
            endId: originParking.id
          });
          allPolylines = [...allPolylines, ...initialWalkPolyline];
          allSteps = [...allSteps, ...initialWalkPhase.steps];
          totalDistanceMeters += parseInt(initialWalkPhase.totalDistance.replace(' m', ''));
          
          currentLocation = originParking;
        }
      } else {
        currentLocation = start as Building;
      }
      
      for (let i = 0; i < allStops.length; i++) {
        const destination = allStops[i];
        const isLastStop = i === allStops.length - 1;
        
        if (isGate(destination) || isParkingForVehicle(destination, vType)) {
          const drivePolyline = await calculateRouteClientSide(currentLocation, destination, 'driving');
          if (!drivePolyline) {
            toast({ title: "Route Calculation Failed", description: `Unable to calculate driving route to ${destination.name}.`, variant: "destructive" });
            return;
          }
          const drivePhase = generateSmartSteps(drivePolyline, 'driving', currentLocation.name, destination.name);
          phases.push({
            mode: 'driving', polyline: drivePolyline, steps: drivePhase.steps, distance: drivePhase.totalDistance,
            startName: currentLocation.name, endName: destination.name, color: '#3B82F6',
            phaseIndex: phases.length, startId: currentLocation.id, endId: destination.id
          });
          allPolylines = [...allPolylines, ...drivePolyline];
          allSteps = [...allSteps, ...drivePhase.steps];
          totalDistanceMeters += parseInt(drivePhase.totalDistance.replace(' m', ''));
          currentLocation = destination;
          currentParking = isParkingForVehicle(destination, vType) ? destination : null;
          continue;
        }
        
        const nearestParking = findNearestParkingByType(destination, vType);
        
        if (currentParking) {
          const distFromCurrentParking = calculateDistance(
            currentParking.lat, currentParking.lng,
            destination.lat, destination.lng
          );
          
          if (distFromCurrentParking <= WALK_PROXIMITY_THRESHOLD || !nearestParking) {
            const walkPolyline = await calculateRouteClientSide(currentLocation, destination, 'walking');
            if (!walkPolyline) {
              toast({ title: "Route Calculation Failed", description: `Unable to calculate walking route to ${destination.name}.`, variant: "destructive" });
              return;
            }
            const walkPhase = generateSmartSteps(walkPolyline, 'walking', currentLocation.name, destination.name);
            phases.push({
              mode: 'walking', polyline: walkPolyline, steps: walkPhase.steps, distance: walkPhase.totalDistance,
              startName: currentLocation.name, endName: destination.name, color: '#10B981',
              phaseIndex: phases.length, startId: currentLocation.id, endId: destination.id,
              note: `Your vehicle is parked nearby at ${currentParking.name}. No need to drive — just walk to ${destination.name}.`
            });
            allPolylines = [...allPolylines, ...walkPolyline];
            allSteps = [...allSteps, ...walkPhase.steps];
            totalDistanceMeters += parseInt(walkPhase.totalDistance.replace(' m', ''));
            currentLocation = destination;
            
            if (!isLastStop) {
              // Only walk back to parking if the NEXT stop is too far to walk directly.
              // If the next stop is also close to currentParking, skip the detour and
              // walk straight from this stop to the next one in the next iteration.
              const nextStop = allStops[i + 1];
              const nextDistFromParking = calculateDistance(
                currentParking.lat, currentParking.lng,
                nextStop.lat, nextStop.lng
              );
              const nextStopIsAlsoClose = nextDistFromParking <= WALK_PROXIMITY_THRESHOLD;

              if (!nextStopIsAlsoClose) {
                const walkBackPolyline = await calculateRouteClientSide(destination, currentParking, 'walking');
                if (walkBackPolyline) {
                  const walkBackPhase = generateSmartSteps(walkBackPolyline, 'walking', destination.name, currentParking.name);
                  phases.push({
                    mode: 'walking', polyline: walkBackPolyline, steps: walkBackPhase.steps, distance: walkBackPhase.totalDistance,
                    startName: destination.name, endName: currentParking.name, color: '#10B981',
                    phaseIndex: phases.length, startId: destination.id, endId: currentParking.id,
                    note: `Walk back to your vehicle at ${currentParking.name}.`
                  });
                  allPolylines = [...allPolylines, ...walkBackPolyline];
                  allSteps = [...allSteps, ...walkBackPhase.steps];
                  totalDistanceMeters += parseInt(walkBackPhase.totalDistance.replace(' m', ''));
                  currentLocation = currentParking;
                }
              }
              // else: next stop is also walkable from same parking — stay at destination
            }
            continue;
          }
        }
        
        if (!nearestParking) {
          const walkPolyline = await calculateRouteClientSide(currentLocation, destination, 'walking');
          if (!walkPolyline) {
            toast({ title: "Route Calculation Failed", description: `Unable to calculate walking route to ${destination.name}.`, variant: "destructive" });
            return;
          }
          const walkPhase = generateSmartSteps(walkPolyline, 'walking', currentLocation.name, destination.name);
          phases.push({
            mode: 'walking', polyline: walkPolyline, steps: walkPhase.steps, distance: walkPhase.totalDistance,
            startName: currentLocation.name, endName: destination.name, color: '#10B981',
            phaseIndex: phases.length, startId: currentLocation.id, endId: destination.id,
            note: `No parking available nearby. Walking to ${destination.name}.`
          });
          allPolylines = [...allPolylines, ...walkPolyline];
          allSteps = [...allSteps, ...walkPhase.steps];
          totalDistanceMeters += parseInt(walkPhase.totalDistance.replace(' m', ''));
          currentLocation = destination;
          continue;
        }
        
        const driveToParking = await calculateRouteClientSide(currentLocation, nearestParking, 'driving');
        if (!driveToParking) {
          toast({ title: "Route Calculation Failed", description: `Unable to calculate driving route to ${nearestParking.name}.`, variant: "destructive" });
          return;
        }
        const drivePhase = generateSmartSteps(driveToParking, 'driving', currentLocation.name, nearestParking.name);
        phases.push({
          mode: 'driving', polyline: driveToParking, steps: drivePhase.steps, distance: drivePhase.totalDistance,
          startName: currentLocation.name, endName: nearestParking.name, color: '#3B82F6',
          phaseIndex: phases.length, startId: currentLocation.id, endId: nearestParking.id,
          note: `Driving to ${nearestParking.name} — the nearest parking to ${destination.name}.`
        });
        allPolylines = [...allPolylines, ...driveToParking];
        allSteps = [...allSteps, ...drivePhase.steps];
        totalDistanceMeters += parseInt(drivePhase.totalDistance.replace(' m', ''));
        
        const walkToDestination = await calculateRouteClientSide(nearestParking, destination, 'walking');
        if (!walkToDestination) {
          toast({ title: "Route Calculation Failed", description: `Unable to calculate walking route to ${destination.name}.`, variant: "destructive" });
          return;
        }
        const walkPhase = generateSmartSteps(walkToDestination, 'walking', nearestParking.name, destination.name);
        phases.push({
          mode: 'walking', polyline: walkToDestination, steps: walkPhase.steps, distance: walkPhase.totalDistance,
          startName: nearestParking.name, endName: destination.name, color: '#10B981',
          phaseIndex: phases.length, startId: nearestParking.id, endId: destination.id,
          note: `Walk from ${nearestParking.name} to ${destination.name}. Parking and stopping along the road is prohibited.`
        });
        allPolylines = [...allPolylines, ...walkToDestination];
        allSteps = [...allSteps, ...walkPhase.steps];
        totalDistanceMeters += parseInt(walkPhase.totalDistance.replace(' m', ''));
        
        currentLocation = destination;
        currentParking = nearestParking;
        
        if (!isLastStop) {
          // Only walk back to parking if the NEXT stop is too far to walk directly from it.
          const nextStop = allStops[i + 1];
          const nextDistFromParking = calculateDistance(
            nearestParking.lat, nearestParking.lng,
            nextStop.lat, nextStop.lng
          );
          const nextStopIsAlsoClose = nextDistFromParking <= WALK_PROXIMITY_THRESHOLD;

          if (!nextStopIsAlsoClose) {
            const walkBackPolyline = await calculateRouteClientSide(destination, nearestParking, 'walking');
            if (walkBackPolyline) {
              const walkBackPhase = generateSmartSteps(walkBackPolyline, 'walking', destination.name, nearestParking.name);
              phases.push({
                mode: 'walking', polyline: walkBackPolyline, steps: walkBackPhase.steps, distance: walkBackPhase.totalDistance,
                startName: destination.name, endName: nearestParking.name, color: '#10B981',
                phaseIndex: phases.length, startId: destination.id, endId: nearestParking.id,
                note: `Walk back to your vehicle at ${nearestParking.name}.`
              });
              allPolylines = [...allPolylines, ...walkBackPolyline];
              allSteps = [...allSteps, ...walkBackPhase.steps];
              totalDistanceMeters += parseInt(walkBackPhase.totalDistance.replace(' m', ''));
              currentLocation = nearestParking;
            }
          }
          // else: next stop is also walkable — stay at destination, walk directly next iteration
        }
      }
      
      // Construct the start object for the route
      const startForRoute = isKioskStart 
        ? { ...(kioskBuilding || KIOSK_LOCATION as any), polygon: null, polygonColor: null }
        : { ...(start as Building), polygon: null, polygonColor: null };
      
      const route: NavigationRoute = {
        start: startForRoute,
        end,
        mode: 'driving',
        vehicleType: vType,
        parkingLocation: currentParking ?? undefined,
        polyline: allPolylines,
        steps: allSteps,
        totalDistance: `${totalDistanceMeters} m`,
        phases,
        waypoints: waypointBuildings
      };
      
      setRoute(route);
      
      // Save route for QR code
      try {
        const routeData = {
          startId: start.id,
          endId: end.id,
          waypoints: waypointIds,
          mode: 'driving',
          vehicleType: vType,
          phases: route.phases || [],
          expiresAt: null
        };
        
        const res = await apiRequest('POST', '/api/routes', routeData);
        const response = await res.json();
        if (response.id) {
          setSavedRouteId(response.id);
        }
      } catch (error) {
        console.error('Error saving waypoint driving route:', error);
      }
      
      const phaseDescriptions = phases.map(p => 
        p.mode === 'walking' ? `Walk ${p.distance}` : `Drive ${p.distance}`
      ).join(' then ');
      
      toast({
        title: "Route Calculated",
        description: phaseDescriptions,
        variant: "default"
      });
    } catch (error) {
      console.error('Error generating waypoint driving route:', error);
      toast({
        title: "Route Calculation Failed",
        description: "Unable to calculate route with waypoints.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingRoute(false);
    }
  };

  const generateTwoPhaseRoute = async (
    start: Building | typeof KIOSK_LOCATION,
    end: Building,
    vehicleType: VehicleType
  ): Promise<NavigationRoute | null> => {
    setIsGeneratingRoute(true);
    try {
      // SCENARIO 1: Destination is a matching parking lot - just drive there directly
      if (isParkingForVehicle(end, vehicleType)) {
        return await generateDirectDrivingRoute(start, end, vehicleType);
      }

      // SCENARIO 2: Destination is a Gate - drive there directly (no parking needed)
      if (isGate(end)) {
        return await generateDirectDrivingRoute(start, end, vehicleType);
      }

      // SCENARIO 3: Prompt user to choose parking location
      const parkingAreas = getParkingAreasForVehicle(vehicleType);
      
      if (parkingAreas.length === 0) {
        toast({
          title: "No Parking Available",
          description: `No ${capitalizeVehicleType(vehicleType)} parking areas found on campus.`,
          variant: "destructive"
        });
        return null;
      }

      // Check if starting from a Gate - user is already driving, skip origin parking
      const startIsGate = isGate(start);

      setPendingDrivingRoute({
        start: start as Building,
        end,
        vehicleType,
        waypoints: []
      });
      setParkingSelectionMode(true);
      setShowParkingSelector(true);

      if (startIsGate) {
        // Starting from a gate = user is already in a vehicle driving in
        // Skip origin parking, go directly to destination parking selection
        setDrivingParkingMode('destination');
        toast({
          title: "Select Destination Parking",
          description: `Tap on the ${capitalizeVehicleType(vehicleType)} parking area where you want to park near ${end.name}.`,
          variant: "default"
        });
      } else {
        // Starting from a building/kiosk - user needs to walk to their parked vehicle first
        setDrivingParkingMode('origin');
        toast({
          title: "Step 1: Select Your Parking Location",
          description: `Tap on the ${capitalizeVehicleType(vehicleType)} parking area where your vehicle is currently parked.`,
          variant: "default"
        });
      }

      // Return null - route will be generated after user selects parking
      return null;
    } catch (error) {
      console.error('Error generating two-phase route:', error);
      toast({
        title: "Navigation Error",
        description: "An unexpected error occurred while calculating your route. Please try again.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsGeneratingRoute(false);
    }
  };

  const generateRouteAfterAdvisory = async () => {
    if (!selectedStart || !selectedEnd || !vehicleType) return;

    const routeStartTime = performance.now();
    const validWaypoints = waypoints.filter(w => w !== '');

    try {
      if (validWaypoints.length > 0) {
        const waypointBuildings = validWaypoints
          .map(id => buildings.find(b => b.id === id))
          .filter(Boolean) as Building[];

        const parkingAreas = getParkingAreasForVehicle(vehicleType);
        if (parkingAreas.length === 0) {
          toast({
            title: "No Parking Available",
            description: `No ${capitalizeVehicleType(vehicleType)} parking areas found on campus.`,
            variant: "destructive"
          });
          return;
        }

        if (canStartDriving(selectedStart)) {
          await generateWaypointDrivingRoute(selectedStart, selectedEnd, waypointBuildings, vehicleType, null);
          const duration = performance.now() - routeStartTime;
          trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode, vehicleType, routeType: 'waypoint-driving-auto' });
          return;
        }

        setPendingWaypointDrivingRoute({
          start: selectedStart as Building,
          end: selectedEnd,
          waypoints: waypointBuildings,
          vehicleType
        });
        setWaypointParkingMode('origin');
        setParkingSelectionMode(true);
        setShowParkingSelector(true);

        toast({
          title: "Select Your Parking Location",
          description: `Tap on the ${capitalizeVehicleType(vehicleType)} parking area where your vehicle is parked.`,
          variant: "default"
        });
        return;
      }

      const twoPhaseRoute = await generateTwoPhaseRoute(selectedStart, selectedEnd, vehicleType);
      if (twoPhaseRoute) {
        setRoute(twoPhaseRoute);

        try {
          const routeData = {
            startId: selectedStart.id,
            endId: selectedEnd.id,
            waypoints: [],
            mode: 'driving',
            vehicleType: vehicleType,
            phases: twoPhaseRoute.phases || [],
            expiresAt: null
          };

          const res = await apiRequest('POST', '/api/routes', routeData);
          const response = await res.json();

          if (response.id) {
            setSavedRouteId(response.id);
          }
        } catch (error) {
          console.error('Error saving two-phase route:', error);
        }

        const duration = performance.now() - routeStartTime;
        trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode, vehicleType, routeType: 'two-phase' });
        return;
      }

      // generateTwoPhaseRoute returned null — it has already set up parking selection mode
      // or shown an error toast. Either way, just return and wait for the user.
      const duration = performance.now() - routeStartTime;
      trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode, vehicleType, routeType: 'two-phase-pending' });
    } catch (error) {
      console.error('Error generating driving route:', error);
      toast({
        title: "Navigation Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }
  };

  const generateRoute = async () => {
    if (!selectedStart || !selectedEnd) return;

    const routeStartTime = performance.now();

    // Filter out empty waypoints
    const validWaypoints = waypoints.filter(w => w !== '');

    // If driving mode and no vehicle type selected, show vehicle selector
    // Skip vehicle selection for accessible mode - it uses PWD-friendly walkpaths only
    if (mode === 'driving' && !vehicleType) {
      const pendingWaypoints = validWaypoints
        .map(id => buildings.find(b => b.id === id))
        .filter(Boolean) as Building[];
      setPendingNavigationData({ start: selectedStart, end: selectedEnd, mode, waypoints: pendingWaypoints });
      setShowVehicleSelector(true);
      const duration = performance.now() - routeStartTime;
      trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode, hasWaypoints: validWaypoints.length > 0, vehicleSelected: false });
      return;
    }

    if (mode === 'driving' && vehicleType) {
      showDrivingAdvisoryThenProceed(() => {
        generateRouteAfterAdvisory();
      });
      return;
    }

    setIsGeneratingRoute(true);
    try {
      // Multi-stop navigation: use multi-phase route calculator
      if (validWaypoints.length > 0) {
        const waypointBuildings = validWaypoints
          .map(id => buildings.find(b => b.id === id))
          .filter(Boolean) as Building[];

        // For driving mode with waypoints
        if (mode === 'driving' && vehicleType) {
          const parkingAreas = getParkingAreasForVehicle(vehicleType);
          
          if (parkingAreas.length === 0) {
            toast({
              title: "No Parking Available",
              description: `No ${capitalizeVehicleType(vehicleType)} parking areas found on campus.`,
              variant: "destructive"
            });
            return;
          }

          if (canStartDriving(selectedStart)) {
            await generateWaypointDrivingRoute(selectedStart, selectedEnd, waypointBuildings, vehicleType, null);
            const duration = performance.now() - routeStartTime;
            trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode, vehicleType, routeType: 'waypoint-driving-auto' });
            return;
          }

          setPendingWaypointDrivingRoute({
            start: selectedStart as Building,
            end: selectedEnd,
            waypoints: waypointBuildings,
            vehicleType
          });
          setWaypointParkingMode('origin');
          setParkingSelectionMode(true);
          setShowParkingSelector(true);

          toast({
            title: "Select Your Parking Location",
            description: `Tap on the ${capitalizeVehicleType(vehicleType)} parking area where your vehicle is parked.`,
            variant: "default"
          });
          return;
        }

        const multiPhaseRoute = await calculateMultiPhaseRoute(
          selectedStart,
          waypointBuildings,
          selectedEnd,
          mode
        );

        if (!multiPhaseRoute) {
          toast({
            title: "Navigation Error",
            description: "Unable to calculate route with stops. Please try again.",
            variant: "destructive"
          });
          return;
        }

        // Convert to NavigationRoute format
        const navigationRoute = multiPhaseToNavigationRoute(
          multiPhaseRoute,
          selectedStart as Building,
          selectedEnd,
          mode
        );

        if (vehicleType) {
          navigationRoute.vehicleType = vehicleType;
        }

        // For accessible mode: if some stops are inaccessible, warn before proceeding
        if (mode === 'accessible' && multiPhaseRoute.inaccessibleStops && multiPhaseRoute.inaccessibleStops.length > 0) {
          setMultiStopInaccessibleStops(multiPhaseRoute.inaccessibleStops);
          setPendingMultiPhaseNavRoute(navigationRoute);
          setShowMultiStopAccessibleWarning(true);
          return;
        }

        setRoute(navigationRoute);

        // Save route to database for QR code generation
        try {
          const routeData = {
            startId: selectedStart.id,
            endId: selectedEnd.id,
            waypoints: validWaypoints,
            mode,
            vehicleType: vehicleType || null,
            phases: multiPhaseRoute.phases,
            expiresAt: null
          };

          const res = await apiRequest('POST', '/api/routes', routeData);
          const response = await res.json();

          if (response.id) {
            setSavedRouteId(response.id);
          }
        } catch (error) {
          console.error('Error saving multi-phase route:', error);
        }

        const duration = performance.now() - routeStartTime;
        trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode, hasWaypoints: validWaypoints.length > 0, routeType: 'multi-phase' });
        return;
      }

      // For driving with vehicle type, try two-phase routing first
      if (mode === 'driving' && vehicleType) {
        const twoPhaseRoute = await generateTwoPhaseRoute(selectedStart, selectedEnd, vehicleType);
        if (twoPhaseRoute) {
          setRoute(twoPhaseRoute);

          // Save two-phase route for QR code generation
          try {
            const routeData = {
              startId: selectedStart.id,
              endId: selectedEnd.id,
              waypoints: [],
              mode: 'driving',
              vehicleType: vehicleType,
              phases: twoPhaseRoute.phases || [],
              expiresAt: null
            };

            const res = await apiRequest('POST', '/api/routes', routeData);
            const response = await res.json();

            if (response.id) {
              setSavedRouteId(response.id);
            }
          } catch (error) {
            console.error('Error saving two-phase route:', error);
          }

          const duration = performance.now() - routeStartTime;
          trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode, vehicleType, routeType: 'two-phase' });
          return;
        }
        // If parking selection mode was activated, user needs to interact with map first
        // Don't fall through to fallback - wait for parking selection
        if (parkingSelectionMode) {
          const duration = performance.now() - routeStartTime;
          trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode, vehicleType, routeType: 'two-phase-pending' });
          return;
        }
        // If two-phase routing fails, fall back appropriately
        // Bikes should fall back to walking, cars/motorcycles to direct driving
        const fallbackMode = vehicleType === 'bike' ? 'walking' : 'driving';
        
        // Update mode state to match fallback and clear vehicle type
        setMode(fallbackMode);
        if (vehicleType === 'bike') {
          setVehicleType(null);
        }
        
        toast({
          title: "Using Direct Route",
          description: `Parking navigation unavailable. Showing direct ${fallbackMode} route instead.`,
          variant: "default"
        });
        
        const routePolyline = await calculateRouteClientSide(
          selectedStart,
          selectedEnd,
          fallbackMode
        );
        
        if (!routePolyline) {
          toast({
            title: "Route Not Found",
            description: `Unable to calculate ${fallbackMode} route. Please try a different destination.`,
            variant: "destructive"
          });
          const duration = performance.now() - routeStartTime;
          trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: fallbackMode, routeType: 'fallback', routeFound: false });
          return;
        }

        const { steps, totalDistance } = generateSmartSteps(
          routePolyline,
          fallbackMode,
          selectedStart.name,
          selectedEnd.name
        );

        setRoute({
          start: { ...selectedStart, polygon: null, polygonColor: null } as Building,
          end: selectedEnd,
          mode: fallbackMode,
          polyline: routePolyline,
          steps,
          totalDistance
        });

        // Save fallback route for QR code generation
        try {
          const routeData = {
            startId: selectedStart.id,
            endId: selectedEnd.id,
            waypoints: [],
            mode: fallbackMode,
            vehicleType: vehicleType || null,
            phases: [{
              mode: fallbackMode,
              polyline: routePolyline,
              steps,
              distance: totalDistance,
              startName: selectedStart.name,
              endName: selectedEnd.name,
              color: '#3B82F6',
              phaseIndex: 0,
              startId: selectedStart.id,
              endId: selectedEnd.id
            }],
            expiresAt: null
          };

          const res = await apiRequest('POST', '/api/routes', routeData);
          const response = await res.json();

          if (response.id) {
            setSavedRouteId(response.id);
          }
        } catch (error) {
          console.error('Error saving fallback route:', error);
        }
        return;
      }

      // For walking and accessible, use regular routing
      let finalEnd = selectedEnd;
      let routePolyline: LatLng[] | null = null;
      let needsAccessibleFallback = false;

      // Pre-check for accessible mode: verify destination is actually reachable via accessible paths
      if (mode === 'accessible') {
        try {
          const walkpathsRes = await fetch('/api/walkpaths', { 
            credentials: "include",
            cache: 'no-cache'
          });
          if (walkpathsRes.ok) {
            const walkpaths = await walkpathsRes.json();
            const testRoute = findShortestPath(selectedStart as Building, selectedEnd, walkpaths, 'accessible');
            
            if (!testRoute || testRoute.length === 0) {
              console.log('[ACCESSIBLE] Destination not reachable via accessible paths - triggering fallback');
              needsAccessibleFallback = true;
            }
          }
        } catch (error) {
          console.error('[ACCESSIBLE] Pre-check failed:', error);
        }
      }

      // If pre-check passed or not accessible mode, attempt normal routing
      if (!needsAccessibleFallback) {
        routePolyline = await calculateRouteClientSide(
          selectedStart,
          selectedEnd,
          mode
        );
      }

      // Fallback for accessible mode: if no route found or pre-check failed, find nearest accessible endpoint
      if ((!routePolyline || needsAccessibleFallback) && mode === 'accessible') {
        console.log('[ACCESSIBLE] No route found to destination. Finding nearest accessible endpoint...');
        
        try {
          const walkpathsRes = await fetch('/api/walkpaths', { 
            credentials: "include",
            cache: 'no-cache'
          });
          if (!walkpathsRes.ok) throw new Error('Failed to fetch accessible paths');
          const walkpaths = await walkpathsRes.json();
          
          const nearestEndpoint = findNearestAccessibleEndpoint(
            selectedEnd,
            walkpaths
          );
          
          if (nearestEndpoint) {
            console.log(`[ACCESSIBLE] ✅ Found nearest accessible endpoint at (${nearestEndpoint.lat.toFixed(5)}, ${nearestEndpoint.lng.toFixed(5)})`);
            setOriginalDestinationName(selectedEnd.name);
            setAccessibleFallbackEndpoint(nearestEndpoint);
            setShowAccessibleFallbackDialog(true);
            
            // Create synthetic building at endpoint for routing
            const endpointBuilding: Building = {
              id: 'accessible-endpoint',
              name: 'Accessible Path End',
              lat: nearestEndpoint.lat,
              lng: nearestEndpoint.lng,
              nodeLat: nearestEndpoint.lat,
              nodeLng: nearestEndpoint.lng,
              entranceLat: nearestEndpoint.lat,
              entranceLng: nearestEndpoint.lng,
              polygon: null,
              polygonColor: null,
              description: '',
              image: null,
              type: 'building',
              markerIcon: null,
              departments: null,
              polygonOpacity: null
            };
            
            finalEnd = endpointBuilding;
            routePolyline = await calculateRouteClientSide(
              selectedStart,
              endpointBuilding,
              mode
            );
          } else {
            console.log('[ACCESSIBLE] ❌ No accessible endpoints found');
          }
        } catch (fallbackError) {
          console.error('[ACCESSIBLE] Error searching for accessible endpoint:', fallbackError);
        }
      }

      if (!routePolyline) {
        toast({
          title: "Route Not Found",
          description: `Unable to calculate ${mode} route. Please try a different destination.`,
          variant: "destructive"
        });
        const duration = performance.now() - routeStartTime;
        trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode, routeType: 'standard', routeFound: false });
        return;
      }

      const { steps, totalDistance } = generateSmartSteps(
        routePolyline,
        mode,
        selectedStart.name,
        finalEnd.name
      );

      setRoute({
        start: { ...selectedStart, polygon: null, polygonColor: null } as Building,
        end: finalEnd,
        mode,
        polyline: routePolyline,
        steps,
        totalDistance
      });

      // Save single-destination route for QR code generation
      try {
        const routeData = {
          startId: selectedStart.id,
          endId: finalEnd.id,
          waypoints: [],
          mode,
          vehicleType: vehicleType || null,
          phases: [{
            mode,
            polyline: routePolyline,
            steps,
            distance: totalDistance,
            startName: selectedStart.name,
            endName: finalEnd.name,
            color: '#3B82F6',
            phaseIndex: 0,
            startId: selectedStart.id,
            endId: finalEnd.id
          }],
          expiresAt: null
        };

        const res = await apiRequest('POST', '/api/routes', routeData);
        const response = await res.json();

        if (response.id) {
          setSavedRouteId(response.id);
        }
      } catch (error) {
        console.error('Error saving single route:', error);
      }

      const duration = performance.now() - routeStartTime;
      trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode, routeType: 'standard', routeFound: true });
    } catch (error) {
      console.error('Error generating route:', error);
      const duration = performance.now() - routeStartTime;
      trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode, error: true });
      toast({
        title: "Navigation Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingRoute(false);
    }
  };

  const showDrivingAdvisoryThenProceed = (action: () => void) => {
    setPendingDrivingAction(() => action);
    setShowDrivingAdvisory(true);
  };

  const handleDrivingAdvisoryAcknowledge = () => {
    setShowDrivingAdvisory(false);
    if (pendingDrivingAction) {
      pendingDrivingAction();
      setPendingDrivingAction(null);
    }
  };

  const handleVehicleSelection = (selectedVehicle: VehicleType) => {
    setVehicleType(selectedVehicle);
    setShowVehicleSelector(false);

    showDrivingAdvisoryThenProceed(() => {
      proceedAfterVehicleSelection(selectedVehicle);
    });
  };

  const proceedAfterVehicleSelection = async (selectedVehicle: VehicleType) => {
    if (pendingNavigationData) {
      const { start, end, mode, waypoints: pendingWaypoints } = pendingNavigationData;
      
      setSelectedStart(start);
      setSelectedEnd(end);
      setMode(mode);
      setPendingNavigationData(null);

      // If there are waypoints, route through the proper waypoint parking flow
      if (pendingWaypoints && pendingWaypoints.length > 0) {
        const parkingAreas = getParkingAreasForVehicle(selectedVehicle);
        if (parkingAreas.length === 0) {
          toast({
            title: "No Parking Available",
            description: `No ${capitalizeVehicleType(selectedVehicle)} parking areas found on campus.`,
            variant: "destructive"
          });
          return;
        }

        const startIsGate = isGate(start);
        if (startIsGate) {
          await generateWaypointDrivingRoute(start, end, pendingWaypoints, selectedVehicle, null);
        } else {
          setPendingWaypointDrivingRoute({
            start,
            end,
            waypoints: pendingWaypoints,
            vehicleType: selectedVehicle
          });
          setWaypointParkingMode('origin');
          setParkingSelectionMode(true);
          setShowParkingSelector(true);

          toast({
            title: "Select Your Parking Location",
            description: `Tap on the ${capitalizeVehicleType(selectedVehicle)} parking area where your vehicle is parked.`,
            variant: "default"
          });
        }
        return;
      }
      
      // No waypoints - try two-phase route with selected vehicle
      const twoPhaseRoute = await generateTwoPhaseRoute(start, end, selectedVehicle);
      if (twoPhaseRoute) {
        setRoute(twoPhaseRoute);

        // Save two-phase route for QR code generation
        try {
          const routeData = {
            startId: start.id,
            endId: end.id,
            waypoints: [],
            mode: 'driving',
            vehicleType: selectedVehicle,
            phases: twoPhaseRoute.phases || [],
            expiresAt: null
          };

          const res = await apiRequest('POST', '/api/routes', routeData);
          const response = await res.json();

          if (response.id) {
            setSavedRouteId(response.id);
          }
        } catch (error) {
          console.error('Error saving two-phase route:', error);
        }
        return;
      }
      
      // Fall back appropriately - bikes to walking, cars/motorcycles to driving
      const fallbackMode = selectedVehicle === 'bike' ? 'walking' : 'driving';
      toast({
        title: "Using Direct Route",
        description: `Parking navigation unavailable. Showing direct ${fallbackMode} route instead.`,
        variant: "default"
      });
      
      try {
        const routePolyline = await calculateRouteClientSide(start, end, fallbackMode);
        
        if (routePolyline) {
          const { steps, totalDistance } = generateSmartSteps(
            routePolyline,
            fallbackMode,
            start.name,
            end.name
          );
          
          setRoute({
            start,
            end,
            mode: fallbackMode,
            polyline: routePolyline,
            steps,
            totalDistance
          });

          // Save fallback route for QR code generation
          try {
            const routeData = {
              startId: start.id,
              endId: end.id,
              waypoints: [],
              mode: fallbackMode,
              vehicleType: selectedVehicle,
              phases: [{
                mode: fallbackMode,
                polyline: routePolyline,
                steps,
                distance: totalDistance,
                startName: start.name,
                endName: end.name,
                color: '#3B82F6',
                phaseIndex: 0,
                startId: start.id,
                endId: end.id
              }],
              expiresAt: null
            };

            const res = await apiRequest('POST', '/api/routes', routeData);
            const response = await res.json();

            if (response.id) {
              setSavedRouteId(response.id);
            }
          } catch (error) {
            console.error('Error saving fallback route:', error);
          }
        }
      } catch (error) {
        console.error('Error generating fallback route:', error);
        toast({
          title: "Navigation Error",
          description: "Unable to calculate route. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  const resetNavigation = () => {
    setSelectedStart(null);
    setSelectedEnd(null);
    setRoute(null);
    setVehicleType(null);
    setPendingNavigationData(null);
    setSavedRouteId(null);
    setWaypoints([]);
    setNavigationPhase(null);
    setActiveNavPhaseIndex(null);
    setDestinationRoom(null);
    setSelectedRoomForNav(null);
    setSelectedFloor(null);
    setCurrentIndoorFloor(null);
    setFloorsInRoute([]);
    setOutdoorRouteSnapshot(null);
    setShowDrivingAdvisory(false);
    setPendingDrivingAction(null);
    setIsRouteConfirmed(false);
  };

  const handleNavigateToAccessibleEndpoint = async () => {
    console.log('[ACCESSIBLE-ENDPOINT] Button clicked', {
      selectedStart: !!selectedStart,
      selectedEnd: !!selectedEnd,
      accessibleFallbackEndpoint: accessibleFallbackEndpoint,
      originalDestinationName
    });
    
    if (!selectedStart || !selectedEnd || !accessibleFallbackEndpoint) {
      console.error('[ACCESSIBLE-ENDPOINT] Missing required data to navigate', {
        selectedStart: selectedStart ? selectedStart.name : 'null',
        selectedEnd: selectedEnd ? selectedEnd.name : 'null',
        endpoint: accessibleFallbackEndpoint
      });
      toast({
        title: "Navigation Error",
        description: "Unable to navigate: Missing destination or endpoint data.",
        variant: "destructive"
      });
      return;
    }
    
    setShowAccessibleFallbackDialog(false);
    
    try {
      // Create synthetic endpoint building at the accessible coordinates
      const endpointBuilding: Building = {
        id: 'accessible-endpoint-temp',
        name: `Accessible Endpoint (${selectedEnd.name})`,
        type: 'Building',
        lat: accessibleFallbackEndpoint.lat,
        lng: accessibleFallbackEndpoint.lng,
        nodeLat: accessibleFallbackEndpoint.lat,
        nodeLng: accessibleFallbackEndpoint.lng,
        entranceLat: accessibleFallbackEndpoint.lat,
        entranceLng: accessibleFallbackEndpoint.lng,
        description: 'Furthest accessible point toward destination',
        polygon: null,
        polygonColor: null,
        polygonOpacity: null,
        image: null,
        markerIcon: null,
        departments: null
      };
      
      console.log('[ACCESSIBLE-ENDPOINT] Calculating route to endpoint', {
        from: selectedStart.name,
        to: endpointBuilding.name,
        coords: { lat: accessibleFallbackEndpoint.lat, lng: accessibleFallbackEndpoint.lng }
      });
      
      // Generate route to the accessible endpoint
      const routePolyline = await calculateRouteClientSide(selectedStart, endpointBuilding, 'accessible');
      
      if (!routePolyline) {
        console.error('[ACCESSIBLE-ENDPOINT] Route calculation returned null');
        toast({
          title: "Route Calculation Failed",
          description: "Unable to calculate route to accessible endpoint.",
          variant: "destructive"
        });
        setShowAccessibleFallbackDialog(true);
        return;
      }
      
      console.log('[ACCESSIBLE-ENDPOINT] Route calculated successfully', { 
        pointsCount: routePolyline.length 
      });
      
      const { steps, totalDistance } = generateSmartSteps(
        routePolyline,
        'accessible',
        (selectedStart as Building).name || 'Your Location',
        `Accessible Endpoint (${selectedEnd.name})`
      );
      
      setRoute({
        start: selectedStart as Building,
        end: endpointBuilding,
        mode: 'accessible',
        polyline: routePolyline,
        steps,
        totalDistance
      });
      
      console.log('[ACCESSIBLE-ENDPOINT] Route set successfully');
      
      // Save route for QR code / Track on Phone functionality
      try {
        const routeData = {
          startId: selectedStart.id,
          endId: selectedEnd.id, // Use original destination ID for tracking
          waypoints: [],
          mode: 'accessible',
          vehicleType: null,
          phases: [{
            mode: 'accessible',
            polyline: routePolyline,
            steps,
            distance: totalDistance,
            startName: (selectedStart as Building).name || 'Your Location',
            endName: `Accessible Endpoint (${selectedEnd.name})`,
            color: '#3B82F6',
            phaseIndex: 0,
            startId: selectedStart.id,
            endId: 'accessible-endpoint-temp'
          }],
          expiresAt: null,
          metadata: {
            isAccessibleEndpoint: true,
            originalDestinationName: selectedEnd.name,
            accessibleEndpointLat: accessibleFallbackEndpoint.lat,
            accessibleEndpointLng: accessibleFallbackEndpoint.lng
          }
        };

        const res = await apiRequest('POST', '/api/routes', routeData);
        const response = await res.json();

        if (response.id) {
          setSavedRouteId(response.id);
          console.log('[ACCESSIBLE-ENDPOINT] Route saved for QR tracking:', response.id);
        }
      } catch (saveError) {
        console.error('[ACCESSIBLE-ENDPOINT] Error saving route for QR:', saveError);
        // Don't block navigation even if save fails
      }
      
      trackEvent(AnalyticsEventType.ROUTE_GENERATION, 0, { 
        mode: 'accessible', 
        routeType: 'accessible-endpoint', 
        destinationName: selectedEnd.name, 
        source: 'fallback-dialog' 
      });
    } catch (error) {
      console.error('[ACCESSIBLE-ENDPOINT] Error generating accessible endpoint route:', error);
      toast({
        title: "Navigation Error",
        description: "Unable to navigate to accessible endpoint.",
        variant: "destructive"
      });
      setShowAccessibleFallbackDialog(true);
    }
  };

  const handleReachedBuilding = () => {
    if (!selectedEnd || !destinationRoom || !route) return;
    
    // Load the floor plan for the building
    const buildingFloors = floors.filter(f => f.buildingId === selectedEnd.id).sort((a, b) => (a.floorNumber || 0) - (b.floorNumber || 0));
    
    // Find entrance floor (typically lowest floor number)
    const entranceFloor = buildingFloors[0];
    const roomFloor = buildingFloors.find(f => f.id === destinationRoom.floorId);
    
    if (!entranceFloor || !roomFloor) return;
    
    // Build list of floors to visit if multi-floor
    let floorsToVisit = [entranceFloor.id];
    if (roomFloor.id !== entranceFloor.id) {
      // Add intermediate floors if needed (via stairways)
      const startFloorNum = entranceFloor.floorNumber || 0;
      const endFloorNum = roomFloor.floorNumber || 0;
      const direction = endFloorNum > startFloorNum ? 1 : -1;
      for (let i = startFloorNum + direction; direction > 0 ? i <= endFloorNum : i >= endFloorNum; i += direction) {
        const intermediateFloor = buildingFloors.find(f => f.floorNumber === i);
        if (intermediateFloor) floorsToVisit.push(intermediateFloor.id);
      }
    }
    
    setFloorsInRoute(floorsToVisit);
    setCurrentIndoorFloor(entranceFloor);
    setSelectedFloor(entranceFloor);
    
    // Find ALL entrance nodes on current floor
    const allEntrances = indoorNodes.filter(n =>
      n.type === 'entrance' && n.floorId === entranceFloor.id
    );

    if (allEntrances.length === 0) return;

    // Determine target for this floor: either destination room (if same floor) or nearest stairway (if multi-floor)
    let targetNode: IndoorNode | undefined;
    if (roomFloor.id === entranceFloor.id) {
      targetNode = destinationRoom;
    } else {
      const stairways = indoorNodes.filter(n => (n.type === 'stairway' || n.type === 'elevator') && n.floorId === entranceFloor.id);
      if (stairways.length === 0) return;
      targetNode = stairways[0];
    }

    // Get floor-specific data
    const floorRoomPaths = roomPaths.filter(rp => rp.floorId === entranceFloor.id);
    const floorRooms = rooms.filter(r => r.floorId === entranceFloor.id);
    const floorIndoorNodes = indoorNodes.filter(n => n.floorId === entranceFloor.id);

    // Build indoor graph once (shared across all entrance candidates)
    const indoorGraph = buildIndoorGraph(floorRooms, floorIndoorNodes, floorRoomPaths, roomFloor.pixelToMeterScale || 1);
    const { nodes, edges } = indoorGraph;

    type RoomPathWaypoint = { x: number; y: number; nodeId?: string };

    // Try every entrance and keep the one that yields the shortest valid path to targetNode
    let bestEntranceNode: IndoorNode | null = null;
    let bestPolylineWaypoints: Array<{ lat: number; lng: number }> | null = null;
    let bestCost = Infinity;

    for (const candidateEntrance of allEntrances) {
      // First check for a direct drawn path between this entrance and target
      const directPath = floorRoomPaths.find(rp => {
        const wps = rp.waypoints as RoomPathWaypoint[];
        if (!wps || wps.length < 2) return false;
        const firstId = wps[0].nodeId;
        const lastId = wps[wps.length - 1].nodeId;
        return (firstId === candidateEntrance.id && lastId === targetNode!.id) ||
               (lastId === candidateEntrance.id && firstId === targetNode!.id);
      });

      if (directPath) {
        const wps = directPath.waypoints as RoomPathWaypoint[];
        const firstId = wps[0].nodeId;
        const ordered = firstId === candidateEntrance.id ? wps : [...wps].reverse();
        const candidateWaypoints = ordered.map(wp => ({ lat: wp.x, lng: wp.y }));
        let cost = 0;
        for (let i = 0; i < candidateWaypoints.length - 1; i++) {
          const dx = candidateWaypoints[i + 1].lat - candidateWaypoints[i].lat;
          const dy = candidateWaypoints[i + 1].lng - candidateWaypoints[i].lng;
          cost += Math.sqrt(dx * dx + dy * dy);
        }
        if (cost < bestCost) {
          bestCost = cost;
          bestEntranceNode = candidateEntrance;
          bestPolylineWaypoints = candidateWaypoints;
        }
        continue;
      }

      // Run full Dijkstra from this entrance (no iteration cap)
      const entranceKey = `${entranceFloor.id}:${candidateEntrance.id}`;
      const destKey = `${entranceFloor.id}:${targetNode!.id}`;

      const distances = new Map<string, number>();
      const previous = new Map<string, string | null>();
      const unvisited = new Set<string>();

      nodes.forEach((_, key) => {
        distances.set(key, Infinity);
        previous.set(key, null);
        unvisited.add(key);
      });

      distances.set(entranceKey, 0);

      while (unvisited.size > 0) {
        let current: string | null = null;
        let minDist = Infinity;

        unvisited.forEach(key => {
          const dist = distances.get(key) ?? Infinity;
          if (dist < minDist) { minDist = dist; current = key; }
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

      const destCost = distances.get(destKey) ?? Infinity;
      if (destCost >= bestCost) continue;

      // Reconstruct path for this entrance
      const shortestPath: string[] = [];
      let cur: string | null = destKey;
      while (cur !== null) {
        shortestPath.unshift(cur);
        cur = previous.get(cur) || null;
      }

      // Extract waypoints along the path
      const candidateWaypoints: Array<{ lat: number; lng: number }> = [
        { lat: candidateEntrance.x, lng: candidateEntrance.y }
      ];

      for (let i = 0; i < shortestPath.length - 1; i++) {
        const fromNode = shortestPath[i];
        const toNode = shortestPath[i + 1];
        const edge = edges.find(e => e.from === fromNode && e.to === toNode);
        if (edge && edge.pathWaypoints && edge.pathWaypoints.length > 0) {
          for (let j = 1; j < edge.pathWaypoints.length; j++) {
            candidateWaypoints.push({ lat: edge.pathWaypoints[j].x, lng: edge.pathWaypoints[j].y });
          }
        }
      }

      candidateWaypoints.push({ lat: targetNode!.x, lng: targetNode!.y });

      bestCost = destCost;
      bestEntranceNode = candidateEntrance;
      bestPolylineWaypoints = candidateWaypoints;
    }

    // Use best entrance; fall back to first entrance with straight line if nothing found
    const entranceNode = bestEntranceNode || allEntrances[0];
    let polylineWaypoints: Array<{ lat: number; lng: number }> = bestPolylineWaypoints || [
      { lat: entranceNode.x, lng: entranceNode.y },
      { lat: targetNode!.x, lng: targetNode!.y }
    ];

    // Remove duplicates
    const seen = new Set<string>();
    polylineWaypoints = polylineWaypoints.filter(wp => {
      const key = `${wp.lat.toFixed(2)},${wp.lng.toFixed(2)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    // Calculate total distance
    let totalPixelDistance = 0;
    for (let i = 0; i < polylineWaypoints.length - 1; i++) {
      const dx = polylineWaypoints[i + 1].lat - polylineWaypoints[i].lat;
      const dy = polylineWaypoints[i + 1].lng - polylineWaypoints[i].lng;
      totalPixelDistance += Math.sqrt(dx * dx + dy * dy);
    }
    
    const scale = roomFloor.pixelToMeterScale || 1;
    const totalMeterDistance = Math.round(totalPixelDistance * scale);
    
    // Generate indoor turn-by-turn directions
    const isMultiFloor = roomFloor.id !== entranceFloor.id;
    const indoorSteps: RouteStep[] = generateIndoorSteps(
      polylineWaypoints,
      floorIndoorNodes,
      floorRooms,
      scale,
      entranceNode.label || 'Entrance',
      targetNode.label || targetNode.type,
      isMultiFloor
    );
    
    // Create indoor phase
    const indoorPhase: RoutePhase = {
      mode: 'walking',
      polyline: polylineWaypoints,
      steps: indoorSteps,
      distance: totalMeterDistance > 0 ? `${totalMeterDistance} m` : '0 m',
      startName: entranceNode.label || 'Entrance',
      endName: targetNode.label || targetNode.type,
      color: '#ef4444',
      phaseIndex: 1,
      startId: selectedEnd.id,
      endId: targetNode.id
    };
    
    // Save the outdoor route snapshot before adding indoor phases
    // This allows us to restore outdoor navigation if user goes back
    // Use deep copy to prevent mutation of the snapshot - clone each waypoint object
    if (!outdoorRouteSnapshot) {
      const snapshot: NavigationRoute = {
        ...route,
        phases: route.phases?.map(phase => ({
          ...phase,
          steps: phase.steps.map(step => ({ ...step })),
          polyline: phase.polyline ? phase.polyline.map(wp => ({ ...wp })) : []
        })),
        steps: route.steps.map(step => ({ ...step }))
      };
      setOutdoorRouteSnapshot(snapshot);
    }
    
    // Update route with indoor phase
    const updatedRoute: NavigationRoute = {
      ...route,
      phases: [...(route.phases || []), indoorPhase]
    };
    
    setRoute(updatedRoute);
    setCurrentSegmentStartNode(entranceNode);
    setCurrentSegmentEndNode(targetNode as IndoorNode);
    setNavigationPhase('indoor');
  };

  const handleProceedToNextFloor = () => {
    console.log('[FLOOR2-START] handleProceedToNextFloor called');
    if (!selectedEnd || !destinationRoom || !route || floorsInRoute.length === 0 || !currentIndoorFloor) {
      console.log('[FLOOR2-ERROR] Missing required state:', { selectedEnd: !!selectedEnd, destinationRoom: !!destinationRoom, route: !!route, floorsInRoute: floorsInRoute.length, currentIndoorFloor: !!currentIndoorFloor });
      return;
    }
    
    const currentFloorIndex = floorsInRoute.indexOf(currentIndoorFloor.id);
    console.log('[FLOOR2-START] currentFloorIndex:', currentFloorIndex, 'floorsInRoute:', floorsInRoute);
    if (currentFloorIndex >= floorsInRoute.length - 1) {
      console.log('[FLOOR2-ERROR] Already on last floor');
      return;
    }
    
    const nextFloorId = floorsInRoute[currentFloorIndex + 1];
    const buildingFloors = floors.filter(f => f.buildingId === selectedEnd.id);
    const nextFloor = buildingFloors.find(f => f.id === nextFloorId);
    const roomFloor = buildingFloors.find(f => f.id === destinationRoom.floorId);
    
    console.log('[FLOOR2-START] nextFloor:', nextFloor?.floorName, 'roomFloor:', roomFloor?.floorName);
    if (!nextFloor || !roomFloor) {
      console.log('[FLOOR2-ERROR] Floor not found');
      return;
    }
    
    try {
      // Find the entrance stairway on the next floor.
      // Priority 1: use pairedNodeId from the stair we just arrived at (currentSegmentEndNode)
      const prevStair = currentSegmentEndNode;
      const prevStairPairedId = prevStair ? (prevStair as any).pairedNodeId : null;

      const entranceNode = (prevStairPairedId
        ? indoorNodes.find(n => n.id === prevStairPairedId && n.floorId === nextFloor.id)
        : null
      ) || indoorNodes.find(n => {
        if ((n.type !== 'stairway' && n.type !== 'elevator') || n.floorId !== nextFloor.id) {
          return false;
        }
        const connectedFloors = (n as any).connectedFloorIds || [];
        return connectedFloors.includes(currentIndoorFloor.id);
      }) || indoorNodes.find(n => (n.type === 'stairway' || n.type === 'elevator') && n.floorId === nextFloor.id);
      
      console.log('[FLOOR2-START] Entrance node on next floor found:', !!entranceNode, entranceNode?.label);
      if (!entranceNode) {
        console.log('[FLOOR2-ERROR] No stairways at all on next floor');
        return;
      }
      
      // Determine target: either destination room (final floor) or the departure stairway (intermediate floor)
      let targetNode: IndoorNode | undefined;
      if (roomFloor.id === nextFloor.id) {
        targetNode = destinationRoom;
        console.log('[FLOOR2-START] Target is destination room:', targetNode?.label);
      } else {
        // Intermediate floor: find a stairway that connects to the floor AFTER the next one
        const floorAfterNext = floorsInRoute[currentFloorIndex + 2];
        const stairways = indoorNodes.filter(n => (n.type === 'stairway' || n.type === 'elevator') && n.floorId === nextFloor.id);
        console.log('[FLOOR2-START] Found', stairways.length, 'stairways on floor, looking for one connecting to', floorAfterNext);
        if (stairways.length === 0) {
          console.log('[FLOOR2-ERROR] No stairways on floor');
          return;
        }
        // Prefer a stairway that connects to the next floor in the route and is different from entranceNode
        const departureStairway = stairways.find(n => {
          const connectedFloors = (n as any).connectedFloorIds || [];
          return n.id !== entranceNode.id && connectedFloors.includes(floorAfterNext);
        }) || stairways.find(n => {
          const connectedFloors = (n as any).connectedFloorIds || [];
          return connectedFloors.includes(floorAfterNext);
        }) || stairways.find(n => n.id !== entranceNode.id) || stairways[0];
        targetNode = departureStairway;
        console.log('[FLOOR2-START] Target is departure stairway:', targetNode?.label);
      }
      
      // Build indoor path for next floor
      const floorRoomPaths = roomPaths.filter(rp => rp.floorId === nextFloor.id);
      const floorRooms = rooms.filter(r => r.floorId === nextFloor.id);
      const floorIndoorNodes = indoorNodes.filter(n => n.floorId === nextFloor.id);
      
      console.log('[FLOOR2-START] Building graph with', floorIndoorNodes.length, 'nodes,', floorRoomPaths.length, 'paths');
      const indoorGraph = buildIndoorGraph(floorRooms, floorIndoorNodes, floorRoomPaths, nextFloor.pixelToMeterScale || 1);
      const { nodes, edges } = indoorGraph;
      console.log('[FLOOR2-START] Graph built:', nodes.size, 'nodes,', edges.length, 'edges');
      
      // Use fallback stairway if needed
      const startNode = entranceNode || indoorNodes.find(n => (n.type === 'stairway' || n.type === 'elevator') && n.floorId === nextFloor.id);
      if (!startNode) {
        console.log('[FLOOR2-ERROR] Could not find any stairway to start from');
        return;
      }

      // Try to find a direct roomPath connecting startNode -> targetNode (or reversed)
      type F2RoomPathWaypoint = { x: number; y: number; nodeId?: string };
      const f2DirectPath = floorRoomPaths.find(rp => {
        const wps = rp.waypoints as F2RoomPathWaypoint[];
        if (!wps || wps.length < 2) return false;
        const firstId = wps[0].nodeId;
        const lastId = wps[wps.length - 1].nodeId;
        return (firstId === startNode.id && lastId === targetNode.id) ||
               (lastId === startNode.id && firstId === targetNode.id);
      });

      let polylineWaypoints: Array<{ lat: number; lng: number }>;

      if (f2DirectPath) {
        console.log('[FLOOR2] Direct roomPath found, skipping Dijkstra');
        const wps = f2DirectPath.waypoints as F2RoomPathWaypoint[];
        const firstId = wps[0].nodeId;
        const ordered = firstId === startNode.id ? wps : [...wps].reverse();
        polylineWaypoints = ordered.map(wp => ({ lat: wp.x, lng: wp.y }));
      } else {
      
      const entranceKey = `${nextFloor.id}:${startNode.id}`;
      const destKey = `${nextFloor.id}:${targetNode.id}`;
      console.log('[FLOOR2-START] Starting from:', startNode.label, 'Entrance key:', entranceKey, 'Dest key:', destKey);
      
      // Dijkstra
      const distances = new Map<string, number>();
      const previous = new Map<string, string | null>();
      const unvisited = new Set<string>();
      
      nodes.forEach((_, key) => {
        distances.set(key, Infinity);
        previous.set(key, null);
        unvisited.add(key);
      });
      
      distances.set(entranceKey, 0);
      
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
      
      console.log('[FLOOR2-DIJKSTRA] Shortest path found:', shortestPath.length, shortestPath);
      if (shortestPath.length === 0) {
        console.log('[FLOOR2-ERROR] Dijkstra returned empty path - no route between entrance and target');
      }
      
      // Extract waypoints
      polylineWaypoints = [
        { lat: startNode.x, lng: startNode.y }
      ];
      
      for (let i = 0; i < shortestPath.length - 1; i++) {
        const fromNode = shortestPath[i];
        const toNode = shortestPath[i + 1];
        const edge = edges.find(e => e.from === fromNode && e.to === toNode);
        
        console.log(`[FLOOR2] Edge ${i}: ${fromNode} -> ${toNode}, has edge: ${!!edge}, waypoints: ${edge?.pathWaypoints?.length || 0}`);
        
        if (edge && edge.pathWaypoints && edge.pathWaypoints.length > 0) {
          for (let j = 1; j < edge.pathWaypoints.length; j++) {
            const wp = edge.pathWaypoints[j];
            polylineWaypoints.push({ lat: wp.x, lng: wp.y });
          }
        }
      }
      
      polylineWaypoints.push({ lat: targetNode.x, lng: targetNode.y });

      } // end else (Dijkstra branch)
      
      console.log('[FLOOR2-DIJKSTRA] Polyline waypoints before dedup:', polylineWaypoints.length);
      
      // Remove duplicates
      const seen = new Set<string>();
      polylineWaypoints = polylineWaypoints.filter(wp => {
        const key = `${wp.lat.toFixed(2)},${wp.lng.toFixed(2)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      
      console.log('[FLOOR2-DIJKSTRA] Final polyline waypoints:', polylineWaypoints.length, polylineWaypoints);
      
      // Update route
      const isMultiFloor = roomFloor.id !== nextFloor.id;
      const f2Scale = nextFloor.pixelToMeterScale || 1;
      const indoorPhase: RoutePhase = {
        mode: 'walking',
        polyline: polylineWaypoints,
        steps: generateIndoorSteps(
          polylineWaypoints,
          floorIndoorNodes,
          floorRooms,
          f2Scale,
          startNode.label || `Floor ${nextFloor.floorNumber}`,
          targetNode.label || targetNode.type,
          isMultiFloor
        ),
        distance: '0 m',
        startName: startNode.label || 'Floor ' + nextFloor.floorNumber,
        endName: targetNode.label || targetNode.type,
        color: '#ef4444',
        phaseIndex: (route.phases?.length || 0),
        startId: selectedEnd.id,
        endId: targetNode.id
      };
      
      const updatedRoute: NavigationRoute = {
        ...route,
        phases: [...(route.phases || []), indoorPhase]
      };
      
      console.log('[FLOOR2] Updated route phases count:', updatedRoute.phases?.length);
      console.log('[FLOOR2] Last phase polyline:', indoorPhase.polyline?.length);
      
      // NOW update state after all calculations are done
      setRoute(updatedRoute);
      setCurrentSegmentStartNode(startNode);
      setCurrentSegmentEndNode(targetNode as IndoorNode);
      setCurrentIndoorFloor(nextFloor);
      setSelectedFloor(nextFloor);
      console.log('[FLOOR2-END] State updated successfully');
    } catch (err) {
      console.error('[FLOOR2-ERROR] Exception in handleProceedToNextFloor:', err);
    }
  };

  const handleDoneNavigatingIndoor = () => {
    setShowFeedbackDialog(true);
  };

  // Handle going back from indoor to outdoor navigation
  const handleGoBackToOutdoor = () => {
    if (!selectedEnd) return;
    
    // Restore the original outdoor route if we have a snapshot
    if (outdoorRouteSnapshot) {
      setRoute(outdoorRouteSnapshot);
    }
    
    // Reset indoor navigation states but KEEP destinationRoom to show "Reached the Building" button again
    setNavigationPhase('outdoor');
    setCurrentIndoorFloor(null);
    setFloorsInRoute([]);
    setOutdoorRouteSnapshot(null);
    setSelectedFloor(null);  // Clear floor plan viewer
    setSelectedRoomForNav(null);  // Clear room selection
    
    toast({
      title: "Back to Outdoor Navigation",
      description: "You can continue outdoor navigation to the building.",
    });
  };

  // Handle going back to previous floor during indoor navigation
  const handleGoBackToPreviousFloor = () => {
    if (!selectedEnd || !route || floorsInRoute.length === 0 || !currentIndoorFloor) return;
    
    const currentFloorIndex = floorsInRoute.indexOf(currentIndoorFloor.id);
    if (currentFloorIndex <= 0) {
      // Already on first floor, go back to outdoor
      handleGoBackToOutdoor();
      return;
    }
    
    const prevFloorId = floorsInRoute[currentFloorIndex - 1];
    const buildingFloors = floors.filter(f => f.buildingId === selectedEnd.id);
    const prevFloor = buildingFloors.find(f => f.id === prevFloorId);
    
    if (!prevFloor) return;
    
    // Remove the last indoor phase from the route to prevent accumulation
    // Each floor adds a new phase, so when going back we need to remove it
    if (route.phases && route.phases.length > 1) {
      // Find how many indoor phases we have (color #ef4444 indicates indoor)
      const indoorPhases = route.phases.filter(p => p.color === '#ef4444');
      if (indoorPhases.length > 1) {
        // Remove the last indoor phase (the one for current floor)
        const updatedPhases = route.phases.slice(0, -1);
        const updatedRoute: NavigationRoute = {
          ...route,
          phases: updatedPhases
        };
        setRoute(updatedRoute);
        console.log('[FLOOR-BACK] Removed last indoor phase, remaining phases:', updatedPhases.length);
      }
    }
    
    setCurrentIndoorFloor(prevFloor);
    setSelectedFloor(prevFloor);

    // Re-derive the correct start/end markers for the previous floor
    const prevFloorIndex = currentFloorIndex - 1;

    // End node on prevFloor = stairway/elevator that connects TO the floor we're leaving (currentIndoorFloor)
    const prevFloorEndNode = indoorNodes.find(n => {
      if ((n.type !== 'stairway' && n.type !== 'elevator') || n.floorId !== prevFloorId) return false;
      return ((n as any).connectedFloorIds || []).includes(currentIndoorFloor.id);
    }) || indoorNodes.find(n => (n.type === 'stairway' || n.type === 'elevator') && n.floorId === prevFloorId) || null;

    // Start node on prevFloor
    let prevFloorStartNode: IndoorNode | null = null;
    if (prevFloorIndex === 0) {
      // First floor in route: start at the entrance
      prevFloorStartNode = indoorNodes.find(n => n.type === 'entrance' && n.floorId === prevFloorId) || null;
    } else {
      // Intermediate floor: start at stairway coming from the floor before it
      const floorBeforePrev = floorsInRoute[prevFloorIndex - 1];
      prevFloorStartNode = indoorNodes.find(n => {
        if ((n.type !== 'stairway' && n.type !== 'elevator') || n.floorId !== prevFloorId) return false;
        return n.id !== prevFloorEndNode?.id && ((n as any).connectedFloorIds || []).includes(floorBeforePrev);
      }) || null;
    }

    setCurrentSegmentStartNode(prevFloorStartNode);
    setCurrentSegmentEndNode(prevFloorEndNode);

    toast({
      title: "Floor Changed",
      description: `Back to ${prevFloor.floorName || `Floor ${prevFloor.floorNumber}`}`,
    });
  };

  const recalculateRoute = () => {
    setRoute(null);
    setIsRouteConfirmed(false);
    if (mode === 'driving' && vehicleType) {
      generateRouteAfterAdvisory();
    } else {
      generateRoute();
    }
  };

  const handleAddWaypoint = () => {
    setWaypoints([...waypoints, '']);
  };

  const handleRemoveWaypoint = (index: number) => {
    setWaypoints(waypoints.filter((_, i) => i !== index));
  };

  const handleWaypointChange = (index: number, buildingId: string) => {
    const newWaypoints = [...waypoints];
    newWaypoints[index] = buildingId;
    setWaypoints(newWaypoints);
  };

  const handleMoveWaypoint = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === waypoints.length - 1)
    ) {
      return;
    }

    const newWaypoints = [...waypoints];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newWaypoints[index], newWaypoints[targetIndex]] = [newWaypoints[targetIndex], newWaypoints[index]];
    setWaypoints(newWaypoints);
  };

  const handleWaypointDragDrop = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const newWaypoints = [...waypoints];
    const [removed] = newWaypoints.splice(fromIndex, 1);
    newWaypoints.splice(toIndex, 0, removed);
    setWaypoints(newWaypoints);
  };

  const handleGetDirections = () => {
    if (selectedBuilding) {
      setDirectionsDestination(selectedBuilding);
      setShowDirectionsDialog(true);
    }
  };

  const handleNavigateFromDialog = async (
    startId: string,
    waypointIds: string[],
    travelMode: 'walking' | 'driving' | 'accessible',
    selectedVehicle?: VehicleType
  ) => {
    if (!directionsDestination) return;

    setIsGeneratingRoute(true);
    const routeStartTime = performance.now();

    try {

    const start = startId === 'kiosk' 
      ? (kioskBuilding || KIOSK_LOCATION) as any
      : buildings.find(b => b.id === startId);
    
    if (!start) return;

    // Get waypoint buildings
    const waypointBuildings = waypointIds
      .map(id => buildings.find(b => b.id === id))
      .filter(Boolean) as Building[];

    // Set the navigation parameters
    setSelectedStart(start);
    setSelectedEnd(directionsDestination);
    setMode(travelMode);

    // Close modals
    setShowDirectionsDialog(false);
    setSelectedBuilding(null);

    // For driving mode with vehicle type and no waypoints, use two-phase routing
    if (travelMode === 'driving' && selectedVehicle && waypointBuildings.length === 0) {
      setVehicleType(selectedVehicle);
      
      try {
        const twoPhaseRoute = await generateTwoPhaseRoute(start, directionsDestination, selectedVehicle);
        if (twoPhaseRoute) {
          setRoute(twoPhaseRoute);

          // Save two-phase route for QR code generation
          try {
            const routeData = {
              startId: start.id,
              endId: directionsDestination.id,
              waypoints: [],
              mode: 'driving',
              vehicleType: selectedVehicle,
              phases: twoPhaseRoute.phases || [],
              expiresAt: null
            };

            const res = await apiRequest('POST', '/api/routes', routeData);
            const response = await res.json();

            if (response.id) {
              setSavedRouteId(response.id);
            }
          } catch (error) {
            console.error('Error saving two-phase route:', error);
          }

          const duration = performance.now() - routeStartTime;
          trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: travelMode, vehicleType: selectedVehicle, routeType: 'two-phase', source: 'dialog' });
        }
      } catch (error) {
        console.error('Error generating two-phase route:', error);
      }
      return;
    }

    // For driving mode with waypoints, prompt for parking selection
    if (travelMode === 'driving' && selectedVehicle && waypointBuildings.length > 0) {
      setVehicleType(selectedVehicle);
      
      const parkingAreas = getParkingAreasForVehicle(selectedVehicle);
      if (parkingAreas.length === 0) {
        toast({
          title: "No Parking Available",
          description: `No ${capitalizeVehicleType(selectedVehicle)} parking areas found on campus.`,
          variant: "destructive"
        });
        return;
      }

      // Check if start is a gate (user is already in vehicle)
      const startIsGate = isGate(start);
      
      if (startIsGate) {
        await generateWaypointDrivingRoute(start, directionsDestination, waypointBuildings, selectedVehicle, null);
        const duration = performance.now() - routeStartTime;
        trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: travelMode, vehicleType: selectedVehicle, routeType: 'waypoint-driving-auto', source: 'dialog' });
      } else {
        setPendingWaypointDrivingRoute({
          start,
          end: directionsDestination,
          waypoints: waypointBuildings,
          vehicleType: selectedVehicle
        });
        setWaypointParkingMode('origin');
        setParkingSelectionMode(true);
        setShowParkingSelector(true);
        
        toast({
          title: "Select Your Parking Location",
          description: `Tap on the ${capitalizeVehicleType(selectedVehicle)} parking area where your vehicle is parked.`,
          variant: "default"
        });
        const duration = performance.now() - routeStartTime;
        trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: travelMode, vehicleType: selectedVehicle, routeType: 'waypoint-driving-pending', source: 'dialog' });
      }
      return;
    }

    // Single destination without waypoints
    if (waypointBuildings.length === 0) {
      try {
        // Pre-check for accessible routes to detect unreachable destinations
        if (travelMode === 'accessible') {
          // Fetch walkpaths for accessible route checking
          const response = await fetch('/api/walkpaths', { 
            credentials: "include",
            cache: 'no-cache'
          });
          
          if (response.ok) {
            const walkpaths = await response.json();
            
            // Check if destination is connected by attempting to find a complete accessible route
            const completeRoute = findShortestPath(
              start as Building,
              directionsDestination,
              walkpaths,
              'accessible'
            );
            
            // If complete route found, proceed with normal routing (no dialog)
            if (completeRoute && completeRoute.length > 0) {
              console.log('[ACCESSIBLE] Connected accessible path exists, proceeding with normal routing');
              // Fall through to normal routing below
            } else {
              // No connected path - find nearest accessible path waypoint to destination
              console.log('[ACCESSIBLE] NO connected accessible path, finding nearest accessible waypoint');
              const nearestWaypoint = findNearestAccessibleEndpoint(
                directionsDestination,
                walkpaths
              );
              
              if (nearestWaypoint) {
                // Accessible waypoint found - show fallback dialog
                console.log('[ACCESSIBLE] Nearest accessible waypoint found, showing fallback dialog');
                setOriginalDestinationName(directionsDestination.name);
                setSelectedStart(start);
                setSelectedEnd(directionsDestination);
                setMode(travelMode);
                setAccessibleFallbackEndpoint(nearestWaypoint);
                setShowAccessibleFallbackDialog(true);
                const duration = performance.now() - routeStartTime;
                trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: travelMode, routeType: 'standard', routeFound: false, accessible: 'waypoint', source: 'dialog' });
                return;
              } else {
                // Completely unreachable - no accessible paths available
                console.log('[ACCESSIBLE] NO accessible paths available on campus');
                setOriginalDestinationName(directionsDestination.name);
                setSelectedStart(start);
                setSelectedEnd(directionsDestination);
                setMode(travelMode);
                setAccessibleFallbackEndpoint(null); // Null means completely unreachable
                setShowAccessibleFallbackDialog(true);
                const duration = performance.now() - routeStartTime;
                trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: travelMode, routeType: 'standard', routeFound: false, accessible: 'unreachable', source: 'dialog' });
                return;
              }
            }
          }
        }

        const routePolyline = await calculateRouteClientSide(start, directionsDestination, travelMode);
        
        if (!routePolyline) {
          toast({
            title: "Route Not Found",
            description: `Unable to calculate ${travelMode} route. Please try again.`,
            variant: "destructive"
          });
          const duration = performance.now() - routeStartTime;
          trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: travelMode, routeType: 'standard', routeFound: false, source: 'dialog' });
          return;
        }

        // Check if routing to a specific room (outdoor-to-indoor navigation)
        let endpointName = directionsDestination.name;
        let endpointId = directionsDestination.id;
        let destinationRoomData: IndoorNode | null = null;

        if (selectedRoomForNav?.id) {
          const selectedRoom = indoorNodes.find(n => n.id === selectedRoomForNav.id && n.type === 'room');
          if (selectedRoom) {
            // For two-phase navigation: outdoor phase only goes to building
            // Store the room info to use later when user reaches the building
            destinationRoomData = selectedRoom;
            setDestinationRoom(selectedRoom);
            setNavigationPhase('outdoor');
            
            // Outdoor phase endpoint is the building (not the room)
            endpointName = directionsDestination.name;
            endpointId = directionsDestination.id;
          }
        }

        const { steps, totalDistance } = generateSmartSteps(
          routePolyline,
          travelMode,
          start.name,
          endpointName
        );

        setRoute({
          start: start as Building,
          end: directionsDestination,
          mode: travelMode,
          polyline: routePolyline,
          steps,
          totalDistance
        });

        // Save single-destination route for QR code generation
        try {
          const routeData: any = {
            startId: start.id,
            endId: endpointId,
            waypoints: [],
            mode: travelMode,
            vehicleType: selectedVehicle || null,
            phases: [{
              mode: travelMode,
              polyline: routePolyline,
              steps,
              distance: totalDistance,
              startName: start.name,
              endName: endpointName,
              color: '#3B82F6',
              phaseIndex: 0,
              startId: start.id,
              endId: endpointId
            }],
            expiresAt: null,
            metadata: {}
          };

          // Mark as accessible endpoint fallback if this is the accessible fallback dialog
          if (accessibleFallbackEndpoint && directionsDestination.id !== selectedEnd?.id) {
            routeData.metadata.isAccessibleEndpoint = true;
            console.log('[NAVIGATION] Marked route as accessible endpoint fallback for mobile tracking');
          }

          // Include destination room info for indoor navigation on mobile
          if (destinationRoomData) {
            routeData.destinationRoomId = destinationRoomData.id;
            routeData.destinationBuildingId = directionsDestination.id;
            routeData.destinationFloorId = destinationRoomData.floorId;
            routeData.destinationRoomName = destinationRoomData.label || selectedRoomForNav?.name || 'Room';
          }

          const res = await apiRequest('POST', '/api/routes', routeData);
          const response = await res.json();

          if (response.id) {
            setSavedRouteId(response.id);
          }
        } catch (error) {
          console.error('Error saving single-destination route:', error);
        }

        const duration = performance.now() - routeStartTime;
        trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: travelMode, routeType: 'standard', routeFound: true, hasRoom: !!destinationRoomData, source: 'dialog' });
      } catch (error) {
        console.error('Error generating single-destination route:', error);
        toast({
          title: "Navigation Error",
          description: "Unable to calculate route. Please try again.",
          variant: "destructive"
        });
        const duration = performance.now() - routeStartTime;
        trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: travelMode, error: true, source: 'dialog' });
      }
      return;
    }

    // Multi-stop navigation: use multi-phase route calculator
    if (waypointBuildings.length > 0) {
      try {
        const multiPhaseRoute = await calculateMultiPhaseRoute(
          start,
          waypointBuildings,
          directionsDestination,
          travelMode
        );

        if (!multiPhaseRoute) {
          toast({
            title: "Navigation Error",
            description: "Unable to calculate route with stops. Please try again.",
            variant: "destructive"
          });
          const duration = performance.now() - routeStartTime;
          trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: travelMode, routeType: 'multi-phase', routeFound: false, source: 'dialog' });
          return;
        }

        // Convert to NavigationRoute format
        const navigationRoute = multiPhaseToNavigationRoute(
          multiPhaseRoute,
          start as Building,
          directionsDestination,
          travelMode
        );

        if (selectedVehicle) {
          navigationRoute.vehicleType = selectedVehicle;
          setVehicleType(selectedVehicle);
        }

        setRoute(navigationRoute);

        // Save route to database for QR code generation
        try {
          console.log('Attempting to save multi-phase route...');
          const routeData = {
            startId: start.id,
            endId: directionsDestination.id,
            waypoints: waypointIds,
            mode: travelMode,
            vehicleType: selectedVehicle || null,
            phases: multiPhaseRoute.phases,
            expiresAt: null
          };
          console.log('Route data:', routeData);
          
          const res = await apiRequest('POST', '/api/routes', routeData);
          const response = await res.json();
          console.log('Route save response:', response);
          
          if (response.id) {
            console.log('Route saved with ID:', response.id);
            setSavedRouteId(response.id);
          } else {
            console.warn('No ID in response:', response);
          }
        } catch (error) {
          console.error('Error saving multi-phase route:', error);
          // Continue even if save fails - route is still usable on kiosk
        }

        const duration = performance.now() - routeStartTime;
        trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: travelMode, hasWaypoints: waypointBuildings.length > 0, routeType: 'multi-phase', source: 'dialog' });
        return;
      } catch (error) {
        console.error('Error generating multi-phase route:', error);
        toast({
          title: "Navigation Error",
          description: "Unable to calculate route with stops.",
          variant: "destructive"
        });
        const duration = performance.now() - routeStartTime;
        trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: travelMode, error: true, source: 'dialog' });
        return;
      }
    }

    // Single destination route (backward compatible)
    try {
      const routePolyline = await calculateRouteClientSide(
        start,
        directionsDestination,
        travelMode
      );

      if (!routePolyline) {
        console.error('Failed to calculate route');
        return;
      }

      const { steps, totalDistance } = generateSmartSteps(
        routePolyline,
        travelMode,
        start.name,
        directionsDestination.name
      );

      setRoute({
        start,
        end: directionsDestination,
        mode: travelMode,
        polyline: routePolyline,
        steps,
        totalDistance
      });

      // Save simple route for QR code
      try {
        console.log('Attempting to save simple route...');
        const routeData = {
          startId: start.id,
          endId: directionsDestination.id,
          waypoints: [],
          mode: travelMode,
          vehicleType: selectedVehicle || null,
          phases: [{
            mode: travelMode,
            polyline: routePolyline,
            steps,
            distance: totalDistance,
            startName: start.name,
            endName: directionsDestination.name,
            color: '#3B82F6',
            phaseIndex: 0,
            startId: start.id,
            endId: directionsDestination.id
          }],
          expiresAt: null
        };
        console.log('Route data:', routeData);
        
        const res = await apiRequest('POST', '/api/routes', routeData);
        const response = await res.json();
        console.log('Route save response:', response);
        
        if (response.id) {
          console.log('Route saved with ID:', response.id);
          setSavedRouteId(response.id);
        } else {
          console.warn('No ID in response:', response);
        }
      } catch (error) {
        console.error('Error saving simple route:', error);
      }
    } catch (error) {
      console.error('Error generating route:', error);
    }

    } finally {
      setIsGeneratingRoute(false);
    }
  };

  const buildingStaff = selectedBuilding
    ? staff.filter(s => s.buildingId === selectedBuilding.id)
    : [];

  const buildingFloors = selectedBuilding
    ? floors.filter(f => f.buildingId === selectedBuilding.id)
    : [];

  const floorRooms = selectedFloor
    ? rooms.filter(r => r.floorId === selectedFloor.id)
    : [];

  // Handle starting active navigation (from preview mode)
  const handleStartNavigating = () => {
    setActiveNavPhaseIndex(0);
  };

  // Handle proceeding to the next phase during active navigation
  const handleProceedToNextPhase = () => {
    setActiveNavPhaseIndex(prev => (prev ?? 0) + 1);
  };

  // Handle going back to the previous phase during active navigation
  const handleGoBackToPreviousPhase = () => {
    setActiveNavPhaseIndex(prev => Math.max(0, (prev ?? 0) - 1));
  };

  // Handle done navigating
  const handleDoneNavigating = () => {
    setShowFeedbackDialog(true);
  };

  // Handle feedback decision
  const handleGiveFeedback = (giveFeedback: boolean) => {
    setShowFeedbackDialog(false);
    if (giveFeedback) {
      navigate('/feedback');
    } else {
      resetNavigation();
    }
  };

  // Filter buildings by type and search query
  // If in active navigation phase, only show buildings relevant to that phase
  const filteredBuildings = buildings.filter(b => {
    const matchesType = selectedTypes.some(sel => sel === b.type || reverseRenames[sel] === b.type);
    const matchesSearch = searchQuery === "" || 
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // If actively navigating a specific phase, filter to only show buildings in that phase
    if (route && activeNavPhaseIndex !== null && route.phases && route.phases[activeNavPhaseIndex]) {
      const currentPhase = route.phases[activeNavPhaseIndex];
      const isPhaseBuilding = b.id === currentPhase.startId || b.id === currentPhase.endId;
      return matchesType && matchesSearch && isPhaseBuilding;
    }
    
    return matchesType && matchesSearch;
  });

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="bg-card border-b border-card-border px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button className="rounded-full bg-primary text-primary-foreground px-5 gap-1" data-testid="button-back">
                <ChevronLeft className="w-5 h-5" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Campus Navigation</h1>
              <p className="text-sm text-muted-foreground">Find your way around CVSU CCAT</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button 
              variant="outline" 
              onClick={() => { if (!route) setShowRoomFinder(true); }}
              disabled={!!route}
              className={route ? 'pointer-events-none' : ''}
              data-testid="button-room-finder"
            >
              <DoorOpen className="w-4 h-4 mr-2" />
              Room Finder
            </Button>
            <Button
              variant="default"
              onClick={() => { if (!route) navigate('/staff'); }}
              disabled={!!route}
              className={route ? 'pointer-events-none' : ''}
              data-testid="button-staff-finder"
            >
              <Users className="w-4 h-4 mr-2" />
              Staff Finder
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <aside className="w-full md:w-96 bg-card md:border-r border-b md:border-b-0 border-card-border p-6 overflow-y-auto flex-shrink-0">
          {!route ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Search Buildings
                </label>
                <Input
                  type="text"
                  placeholder="Search by name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-buildings"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filter Map Markers
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full justify-between"
                      data-testid="select-marker-filter"
                    >
                      <span>
                        {selectedTypes.length === activePoiTypes.length 
                          ? "All Types" 
                          : `${selectedTypes.length} Selected`}
                      </span>
                      <ChevronDown className="w-4 h-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3">
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedTypes(activePoiTypes)}
                          className="flex-1"
                        >
                          Select All
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedTypes([])}
                          className="flex-1"
                        >
                          Clear All
                        </Button>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {activePoiTypes.map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              id={`type-${type}`}
                              checked={selectedTypes.includes(type)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedTypes([...selectedTypes, type]);
                                } else {
                                  setSelectedTypes(selectedTypes.filter(t => t !== type));
                                }
                              }}
                              data-testid={`checkbox-marker-type-${type}`}
                            />
                            <img
                              src={getPoiTypeIconUrl(type, poiTypesData?.iconOverrides, poiTypesData?.customTypes, poiTypesData?.renames)}
                              alt={type}
                              className="w-4 h-4 object-contain flex-shrink-0"
                            />
                            <label 
                              htmlFor={`type-${type}`}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {type}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Starting Point
                </label>
                <SearchableStartingPointSelect
                  selectedId={selectedStart?.id === kioskBuilding?.id ? 'kiosk' : selectedStart?.id}
                  onSelect={(id) => {
                    if (id === 'kiosk') {
                      setSelectedStart((kioskBuilding || KIOSK_LOCATION) as any);
                    } else {
                      const building = buildings.find(b => b.id === id);
                      setSelectedStart(building || null);
                    }
                  }}
                  buildings={buildings}
                  testId="select-start"
                />
              </div>

              {/* Stops Along the Way - between Start and Destination */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">
                    Stops Along the Way
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddWaypoint}
                    data-testid="button-add-waypoint"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Stop
                  </Button>
                </div>

                {waypoints.length > 0 && (
                  <div className="space-y-2 bg-secondary/30 p-3 rounded-md">
                    {waypoints.map((waypointId, index) => (
                      <div
                        key={index}
                        className={`flex gap-2 items-center rounded-md transition-colors ${dragWaypointIndex === index ? 'opacity-50' : ''}`}
                        draggable
                        onDragStart={() => setDragWaypointIndex(index)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragWaypointIndex !== null) {
                            handleWaypointDragDrop(dragWaypointIndex, index);
                          }
                          setDragWaypointIndex(null);
                        }}
                        onDragEnd={() => setDragWaypointIndex(null)}
                        data-testid={`waypoint-row-${index}`}
                      >
                        <div
                          className="cursor-grab active:cursor-grabbing flex-shrink-0 text-muted-foreground p-1"
                          title="Drag to reorder"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <SearchableWaypointSelect
                            selectedId={waypointId}
                            onSelect={(id) => handleWaypointChange(index, id)}
                            buildings={buildings}
                            excludeIds={[
                              selectedStart?.id || '',
                              selectedEnd?.id || '',
                            ].filter(Boolean)}
                            onRemove={() => handleRemoveWaypoint(index)}
                            testId="select-waypoint"
                            index={index}
                          />
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-destructive flex-shrink-0"
                          onClick={() => handleRemoveWaypoint(index)}
                          data-testid={`button-remove-waypoint-${index}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Destination
                </label>
                <SearchableDestinationSelect
                  selectedId={selectedEnd?.id}
                  onSelect={(id) => {
                    const building = buildings.find(b => b.id === id);
                    setSelectedEnd(building || null);
                  }}
                  buildings={buildings}
                  testId="select-destination"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Travel Mode
                </label>
                <Tabs value={mode} onValueChange={(v) => setMode(v as 'walking' | 'driving' | 'accessible')}>
                  <TabsList className="w-full">
                    <TabsTrigger value="walking" className="flex-1" data-testid="tab-walking">
                      🚶 Walking
                    </TabsTrigger>
                    <TabsTrigger value="driving" className="flex-1" data-testid="tab-driving">
                      🚗 Driving
                    </TabsTrigger>
                    <TabsTrigger value="accessible" className="flex-1" data-testid="tab-accessible">
                      ♿ Accessible
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <Button
                className="w-full"
                onClick={generateRoute}
                disabled={!selectedStart || !selectedEnd}
                data-testid="button-generate-route"
              >
                <NavigationIcon className="w-4 h-4 mr-2" />
                Generate Route
              </Button>

              {/* Track on Your Phone Button - Show when route is generated and can be saved */}
              {route && savedRouteId && (
                <Button
                  className="w-full"
                  variant="default"
                  onClick={() => setShowQRCode(true)}
                  data-testid="button-track-on-phone"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Track on Your Phone
                </Button>
              )}

              <div className="pt-4 border-t border-border">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  {selectedTypes.length === activePoiTypes.length ? "All Locations" : "Filtered Locations"}
                </h3>
                <div className="space-y-2">
                  {buildings.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">No locations available</p>
                    </div>
                  ) : (() => {
                    const sortedBuildings = [...buildings].sort((a, b) => a.name.localeCompare(b.name));
                    const filteredBuildings = sortedBuildings.filter((building) => {
                      const matchesSearch = searchQuery === "" || 
                        building.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (building.description || "").toLowerCase().includes(searchQuery.toLowerCase());
                      
                      const matchesType = selectedTypes.some(sel => sel === (building.type || "") || reverseRenames[sel] === (building.type || ""));
                      
                      return matchesSearch && matchesType;
                    });
                    
                    if (filteredBuildings.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No locations found
                        </p>
                      );
                    }

                    return filteredBuildings.map(building => (
                      <div
                        key={building.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg hover-elevate cursor-pointer"
                        onClick={() => setSelectedBuilding(building)}
                        data-testid={`building-list-${building.id}`}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="text-sm text-foreground">{building.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{building.type}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          ) : route && waypoints.filter(w => w !== '').length > 0 && !isRouteConfirmed ? (
            /* Route Preview panel — shown after multi-stop route generation, before navigation starts */
            <div className="space-y-5" data-testid="panel-route-preview">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Route Preview</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetNavigation}
                  data-testid="button-reset-preview"
                >
                  Restart
                </Button>
              </div>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">From</p>
                    <p className="font-medium text-foreground">{route.start.name}</p>
                  </div>
                  <TrendingUp className="w-5 h-5 text-muted-foreground" />
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">To</p>
                    <p className="font-medium text-foreground">{route.end.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="text-muted-foreground">Distance:</span>
                  <span className="font-medium text-foreground">
                    {route.phases && route.phases.length > 0
                      ? (() => {
                          const total = route.phases.reduce((sum, p) => {
                            const d = parseInt(p.distance?.replace(' m','') || '0');
                            return sum + (isNaN(d) ? 0 : d);
                          }, 0);
                          return total >= 1000 ? `${(total/1000).toFixed(1)} km` : `${total} m`;
                        })()
                      : route.totalDistance}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-medium capitalize text-foreground">{route.mode}</span>
                  {route.vehicleType && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-medium capitalize text-foreground">{route.vehicleType}</span>
                    </>
                  )}
                </div>
              </Card>

              {route.phases && route.phases.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Route Overview</p>
                  <div className="space-y-1.5" data-testid="section-route-overview">
                    {route.phases.map((phase, idx) => {
                      const isDriving = phase.mode === 'driving';
                      const note = phase.note
                        ? phase.note
                        : isDriving
                          ? 'Drive to next stop'
                          : 'Approaching destination';
                      return (
                        <div
                          key={idx}
                          className={`flex items-start gap-2.5 rounded-md px-3 py-2 text-sm ${isDriving ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'}`}
                          data-testid={`overview-phase-${idx}`}
                        >
                          <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${isDriving ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white'}`}>
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isDriving
                                ? <Car className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                : <Footprints className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                              <span className={`font-medium ${isDriving ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {isDriving ? 'Drive' : 'Walk'}
                              </span>
                              <span className="text-muted-foreground truncate min-w-0 flex items-center gap-1">
                                <span className="truncate max-w-[5rem]" title={phase.startName}>{phase.startName}</span>
                                <ArrowRight className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate max-w-[5rem]" title={phase.endName}>{phase.endName}</span>
                              </span>
                              <span className="text-xs text-muted-foreground flex-shrink-0 ml-auto">{phase.distance}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{note}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-foreground mb-1">Stop Order</p>
                <p className="text-xs text-muted-foreground mb-3">Reorder stops then recalculate, or start navigation when ready.</p>
                <div className="space-y-2 bg-secondary/30 p-3 rounded-md">
                  {/* Start (read-only) */}
                  <div className="flex items-center gap-2 px-1 py-1">
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{route.start.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">Start</span>
                  </div>

                  {/* Reorderable waypoints */}
                  {waypoints.filter(w => w !== '').map((waypointId, index, arr) => {
                    const b = buildings.find(bld => bld.id === waypointId);
                    return (
                      <div key={`${waypointId}-${index}`} className="flex items-center gap-2 bg-background/60 rounded px-2 py-1.5" data-testid={`preview-stop-${index}`}>
                        <span className="text-xs font-bold text-muted-foreground w-5 flex-shrink-0">{index + 1}</span>
                        <span className="text-sm text-foreground flex-1 truncate min-w-0">{b?.name || waypointId}</span>
                        <div className="flex gap-0.5 flex-shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleMoveWaypoint(index, 'up')}
                            disabled={index === 0}
                            data-testid={`button-preview-move-up-${index}`}
                          >
                            <ChevronUp className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleMoveWaypoint(index, 'down')}
                            disabled={index === arr.length - 1}
                            data-testid={`button-preview-move-down-${index}`}
                          >
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {/* End (read-only) */}
                  <div className="flex items-center gap-2 px-1 py-1">
                    <MapPin className="w-4 h-4 text-destructive flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{route.end.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">End</span>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={recalculateRoute}
                data-testid="button-recalculate-route"
              >
                Recalculate Route
              </Button>

              <Button
                className="w-full"
                onClick={() => setIsRouteConfirmed(true)}
                data-testid="button-start-navigation"
              >
                <NavigationIcon className="w-4 h-4 mr-2" />
                Start Navigation
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Route Details</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetNavigation}
                  data-testid="button-reset-navigation"
                >
                  Restart
                </Button>
              </div>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">From</p>
                    <p className="font-medium text-foreground">{route.start.name}</p>
                  </div>
                  <TrendingUp className="w-5 h-5 text-muted-foreground" />
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">To</p>
                    <p className="font-medium text-foreground">{route.end.name}</p>
                  </div>
                </div>
                {navigationPhase !== 'indoor' && (
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="text-muted-foreground">Distance:</span>
                    <span className="font-medium text-foreground">{route.totalDistance}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground capitalize">{route.mode}</span>
                    {route.vehicleType && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground capitalize">{route.vehicleType}</span>
                      </>
                    )}
                    {(() => {
                      // Calculate total ETA from all phases
                      if (route.phases && route.phases.length > 0) {
                        const totalDistanceMeters = route.phases.reduce((sum, phase) => {
                          return sum + parseDistance(phase.distance);
                        }, 0);
                        const totalETA = calculateETA(totalDistanceMeters, route.mode);
                        return (
                          <>
                            <span className="text-muted-foreground">•</span>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-primary" />
                              <span className="font-medium text-foreground">{totalETA}</span>
                            </div>
                          </>
                        );
                      }
                      // Fallback: calculate from total distance if no phases
                      const totalDistanceMeters = parseDistance(route.totalDistance);
                      const totalETA = calculateETA(totalDistanceMeters, route.mode);
                      return (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4 text-primary" />
                            <span className="font-medium text-foreground">{totalETA}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
                {route.parkingLocation && navigationPhase !== 'indoor' && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">Parking at</p>
                    <p className="font-medium text-foreground">{route.parkingLocation.name}</p>
                  </div>
                )}
              </Card>

              {/* QR Code Button */}
              {savedRouteId && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowQRCode(true)}
                  data-testid="button-get-qr-code"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Track on Your Phone
                </Button>
              )}

              <div>
                {(() => {
                  // Shared helpers
                  const parseDistStr = (distStr: string): number => {
                    const match = distStr.match(/(\d+(?:\.\d+)?)\s*m/);
                    return match ? parseFloat(match[1]) : 0;
                  };
                  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
                    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                    return result ? {
                      r: parseInt(result[1], 16),
                      g: parseInt(result[2], 16),
                      b: parseInt(result[3], 16)
                    } : null;
                  };
                  const renderPhaseRow = (phase: typeof route.phases[0], displayIndex: number, key: number) => {
                    const distanceMeters = parseDistStr(phase.distance);
                    const speed = phase.mode === 'walking' ? 1.4 : 10;
                    const minutes = Math.ceil((distanceMeters / speed) / 60);
                    const eta = minutes > 0 ? `${minutes} min` : '< 1 min';
                    const phaseRgb = hexToRgb(phase.color);
                    const isLightColor = phaseRgb
                      ? (phaseRgb.r * 299 + phaseRgb.g * 587 + phaseRgb.b * 114) / 1000 > 128
                      : false;
                    const isIndoorPhase = phase.color === '#ef4444';
                    return (
                      <div key={key} className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <div
                            className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isLightColor ? 'text-black' : 'text-white'}`}
                            style={{ backgroundColor: phase.color }}
                            data-testid={`phase-badge-${displayIndex}`}
                          >
                            {displayIndex + 1}
                          </div>
                          <h4 className="text-sm font-semibold text-foreground">
                            {phase.mode === 'driving'
                              ? `${route.vehicleType === 'bike' ? 'Ride' : 'Drive'} to ${phase.endName}`
                              : `Walk to ${phase.endName}`}
                          </h4>
                          {!isIndoorPhase && (
                            <div className="text-xs text-muted-foreground ml-auto flex gap-2">
                              <span>{phase.distance}</span>
                              <span>•</span>
                              <span>{eta}</span>
                            </div>
                          )}
                        </div>
                        {phase.note && (
                          <div className="ml-8 mb-3 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-md" data-testid={`phase-note-${displayIndex}`}>
                            <p className="text-xs text-blue-700 dark:text-blue-300">{phase.note}</p>
                          </div>
                        )}
                        <div className="space-y-3 pl-8">
                          {phase.steps.map((step, stepIndex) => (
                            <div
                              key={stepIndex}
                              className="flex gap-3"
                              data-testid={`route-phase-${displayIndex}-step-${stepIndex}`}
                            >
                              <div className="flex-shrink-0 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center text-xs font-medium text-muted-foreground">
                                {stepIndex + 1}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">{step.instruction}</p>
                                {!isIndoorPhase && (
                                  <p className="text-xs text-muted-foreground">{step.distance}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  };

                  if (route.phases && route.phases.length > 0) {
                    if (activeNavPhaseIndex === null) {
                      // Preview mode: show all phases
                      return <>{route.phases.map((phase, i) => renderPhaseRow(phase, i, i))}</>;
                    } else {
                      // Active mode: show only the current phase with a progress label
                      const phase = route.phases[activeNavPhaseIndex];
                      const phaseRgb = hexToRgb(phase?.color ?? '#000');
                      const isLightColor = phaseRgb
                        ? (phaseRgb.r * 299 + phaseRgb.g * 587 + phaseRgb.b * 114) / 1000 > 128
                        : false;
                      return (
                        <>
                          <div className="flex items-center gap-2 mb-4 px-1">
                            <div
                              className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isLightColor ? 'text-black' : 'text-white'}`}
                              style={{ backgroundColor: phase?.color }}
                            >
                              {activeNavPhaseIndex + 1}
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">
                              Phase {activeNavPhaseIndex + 1} of {route.phases.length}
                            </span>
                            <div className="flex-1 flex gap-1 ml-1">
                              {route.phases.map((_, i) => (
                                <div
                                  key={i}
                                  className="flex-1 h-1 rounded-full"
                                  style={{
                                    backgroundColor: route.phases[i].color,
                                    opacity: i <= activeNavPhaseIndex ? 1 : 0.25,
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                          {phase && renderPhaseRow(phase, activeNavPhaseIndex, activeNavPhaseIndex)}
                        </>
                      );
                    }
                  } else {
                    // No phases — single step route (existing directions display)
                    return (
                      <>
                        <h4 className="text-sm font-medium text-foreground mb-3">Directions</h4>
                        <div className="space-y-3">
                          {route.steps.map((step, index) => (
                            <div key={index} className="flex gap-3" data-testid={`route-step-${index}`}>
                              <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">{step.instruction}</p>
                                <p className="text-xs text-muted-foreground">{step.distance}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  }
                })()}

                {/* Navigation Buttons */}
                {navigationPhase === 'indoor' && destinationRoom && currentIndoorFloor ? (
                  // Indoor navigation buttons — unchanged
                  <div className="space-y-3 mt-6">
                    {currentIndoorFloor.id !== destinationRoom.floorId ? (
                      <Button
                        className="w-full"
                        onClick={handleProceedToNextFloor}
                        data-testid="button-proceed-next-floor"
                      >
                        Proceed to Next Floor
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={handleDoneNavigatingIndoor}
                        data-testid="button-done-navigating-indoor"
                      >
                        Done Navigating
                      </Button>
                    )}
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={handleGoBackToPreviousFloor}
                      data-testid="button-go-back-indoor"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Go Back
                    </Button>
                  </div>
                ) : route.phases && route.phases.length > 0 && activeNavPhaseIndex === null ? (
                  // Preview mode — Start Navigating
                  <Button
                    className="w-full mt-6"
                    onClick={handleStartNavigating}
                    data-testid="button-start-navigating"
                  >
                    Start Navigating
                  </Button>
                ) : route.phases && route.phases.length > 0 && activeNavPhaseIndex !== null && activeNavPhaseIndex < route.phases.length - 1 ? (
                  // Active mode, not last phase — Proceed to Next Phase
                  <div className="flex flex-col gap-2 mt-6">
                    <Button
                      className="w-full"
                      onClick={handleProceedToNextPhase}
                      data-testid="button-proceed-next-phase"
                    >
                      <span className="flex flex-col items-start leading-tight">
                        <span>Proceed to Next Phase</span>
                        <span className="text-xs opacity-75 font-normal">
                          {route.phases[activeNavPhaseIndex + 1]?.mode === 'driving'
                            ? `${route.vehicleType === 'bike' ? 'Ride' : 'Drive'} to ${route.phases[activeNavPhaseIndex + 1]?.endName}`
                            : `Walk to ${route.phases[activeNavPhaseIndex + 1]?.endName}`}
                        </span>
                      </span>
                    </Button>
                    {activeNavPhaseIndex > 0 && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleGoBackToPreviousPhase}
                        data-testid="button-go-back-phase"
                      >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Go Back to Previous Phase
                      </Button>
                    )}
                  </div>
                ) : (navigationPhase === 'outdoor' || navigationPhase === null) && destinationRoom && route ? (
                  // Last phase with indoor destination
                  <div className="flex flex-col gap-2 mt-6">
                    <Button
                      className="w-full"
                      onClick={handleReachedBuilding}
                      data-testid="button-reached-building"
                    >
                      Reached the Building
                    </Button>
                    {route.phases && route.phases.length > 1 && activeNavPhaseIndex !== null && activeNavPhaseIndex > 0 && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleGoBackToPreviousPhase}
                        data-testid="button-go-back-phase-last"
                      >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Go Back to Previous Phase
                      </Button>
                    )}
                  </div>
                ) : (
                  // Last phase, no indoor destination — Done Navigating
                  <div className="flex flex-col gap-2 mt-6">
                    <Button
                      className="w-full"
                      onClick={handleDoneNavigating}
                      data-testid="button-done-navigating"
                    >
                      Done Navigating
                    </Button>
                    {route.phases && route.phases.length > 1 && activeNavPhaseIndex !== null && activeNavPhaseIndex > 0 && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleGoBackToPreviousPhase}
                        data-testid="button-go-back-phase-last"
                      >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Go Back to Previous Phase
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-hidden relative" ref={mapMainRef}>
          <div
            ref={mapOverlayRef}
            className="absolute inset-0 z-[9999] bg-background pointer-events-none"
            style={{ transition: 'opacity 0.15s ease-out' }}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid hsl(var(--muted-foreground) / 0.2)', borderTopColor: 'hsl(var(--primary))' }} />
              <span className="text-sm text-muted-foreground">Loading map...</span>
            </div>
          </div>
          {isGeneratingRoute && (
            <div className="absolute inset-0 z-[9998] bg-background/80 flex flex-col items-center justify-center gap-3" data-testid="overlay-generating-route">
              <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid hsl(var(--muted-foreground) / 0.2)', borderTopColor: 'hsl(var(--primary))' }} />
              <span className="text-sm text-muted-foreground font-medium">Generating Route...</span>
            </div>
          )}
          {parkingSelectionMode && vehicleType && (
            <div className="absolute top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-900 px-4 py-3 shadow-lg flex items-center justify-between gap-3" data-testid="banner-parking-selection">
              <div className="flex items-center gap-2 flex-1">
                <MapPin className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">
                  {drivingParkingMode === 'destination'
                    ? `Tap on a ${capitalizeVehicleType(vehicleType)} Parking area on the map to indicate where you want to park`
                    : waypointParkingMode === 'waypoint'
                    ? `Tap on a ${capitalizeVehicleType(vehicleType)} Parking area near your stop to park`
                    : `Tap on a ${capitalizeVehicleType(vehicleType)} Parking area on the map to indicate where your vehicle is parked`
                  }
                </span>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={cancelParkingSelection}
                className="flex-shrink-0 bg-yellow-400 border-yellow-600 text-yellow-900"
                data-testid="button-cancel-parking-selection"
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            </div>
          )}
          
          {navigationPhase === 'indoor' && currentIndoorFloor ? (
            <FloorPlanViewer
              floor={currentIndoorFloor}
              rooms={[
                ...(currentSegmentStartNode ? [{
                  id: currentSegmentStartNode.id,
                  name: currentSegmentStartNode.label || 'Start',
                  type: currentSegmentStartNode.type,
                  description: currentSegmentStartNode.description || null,
                  floorId: currentSegmentStartNode.floorId,
                  buildingId: selectedEnd?.id || '',
                  x: currentSegmentStartNode.x,
                  y: currentSegmentStartNode.y,
                  isIndoorNode: true,
                  category: currentSegmentStartNode.category || null,
                  imageUrl: (currentSegmentStartNode as any).imageUrl || null
                }] : []),
                ...(currentSegmentEndNode && currentSegmentEndNode.id !== currentSegmentStartNode?.id ? [{
                  id: currentSegmentEndNode.id,
                  name: currentSegmentEndNode.label || 'End',
                  type: currentSegmentEndNode.type,
                  description: currentSegmentEndNode.description || null,
                  floorId: currentSegmentEndNode.floorId,
                  buildingId: selectedEnd?.id || '',
                  x: currentSegmentEndNode.x,
                  y: currentSegmentEndNode.y,
                  isIndoorNode: true,
                  category: currentSegmentEndNode.category || null,
                  imageUrl: (currentSegmentEndNode as any).imageUrl || null
                }] : [])
              ]}
              indoorNodes={[]}
              onClose={() => {
                setNavigationPhase(null);
                setCurrentIndoorFloor(null);
              }}
              highlightedRoomId={currentIndoorFloor.id === destinationRoom?.floorId ? destinationRoom?.id : undefined}
              viewOnly={true}
              pathPolyline={route?.phases?.[route.phases.length - 1]?.polyline && route.phases[route.phases.length - 1].polyline.length > 0 ? route.phases[route.phases.length - 1].polyline : undefined}
            />
          ) : (
            <CampusMap
              buildings={filteredBuildings}
              onBuildingClick={setSelectedBuilding}
              enablePolygonClick={true}
              selectedBuilding={selectedBuilding}
              routePolyline={route?.polyline}
              routeMode={route?.mode}
              routePhases={
                route?.phases
                  ? (activeNavPhaseIndex !== null
                      ? [route.phases[activeNavPhaseIndex]].filter(Boolean) as typeof route.phases
                      : route.phases)
                  : undefined
              }
              isFirstPhase={activeNavPhaseIndex === null || activeNavPhaseIndex === 0}
              isLastPhase={
                activeNavPhaseIndex === null ||
                !route?.phases ||
                activeNavPhaseIndex === route.phases.length - 1
              }
              parkingLocation={activeNavPhaseIndex === null ? route?.parkingLocation : null}
              hidePolygonsInNavigation={!!route}
              waypointsData={
                route && waypoints.length > 0 && activeNavPhaseIndex === null
                  ? waypoints
                      .map(id => buildings.find(b => b.id === id))
                      .filter((b): b is Building => !!b)
                      .map(b => ({ id: b.id, name: b.name, lat: b.lat, lng: b.lng }))
                  : []
              }
              navigationStartBuilding={
                route
                  ? (() => {
                      // During per-phase navigation, show the phase start building
                      if (activeNavPhaseIndex !== null && route.phases && route.phases[activeNavPhaseIndex]) {
                        const phase = route.phases[activeNavPhaseIndex];
                        const b = buildings.find(bld => bld.id === phase.startId);
                        return b ? { id: b.id, name: b.name, lat: b.lat, lng: b.lng, polygon: b.polygon as Array<{ lat: number; lng: number }> | null, polygons: (b as any).polygons || null } : null;
                      }
                      // Preview mode: show the overall start building
                      if (selectedStart && 'id' in selectedStart) {
                        const b = buildings.find(bld => bld.id === selectedStart.id);
                        return b ? { id: b.id, name: b.name, lat: b.lat, lng: b.lng, polygon: b.polygon as Array<{ lat: number; lng: number }> | null, polygons: (b as any).polygons || null } : null;
                      }
                      return null;
                    })()
                  : null
              }
              navigationEndBuilding={
                route
                  ? (() => {
                      // During per-phase navigation, show the phase end building
                      if (activeNavPhaseIndex !== null && route.phases && route.phases[activeNavPhaseIndex]) {
                        const phase = route.phases[activeNavPhaseIndex];
                        const b = buildings.find(bld => bld.id === phase.endId);
                        return b ? { id: b.id, name: b.name, lat: b.lat, lng: b.lng, polygon: b.polygon as Array<{ lat: number; lng: number }> | null, polygons: (b as any).polygons || null } : null;
                      }
                      // Preview mode: show the overall end building
                      if (selectedEnd) {
                        const b = buildings.find(bld => bld.id === selectedEnd.id);
                        return b ? { id: b.id, name: b.name, lat: b.lat, lng: b.lng, polygon: b.polygon as Array<{ lat: number; lng: number }> | null, polygons: (b as any).polygons || null } : null;
                      }
                      return null;
                    })()
                  : null
              }
              navigationParkingBuilding={
                activeNavPhaseIndex === null && route?.parkingLocation
                  ? (() => {
                      const parkingBuilding = buildings.find(b => b.id === route.parkingLocation?.id);
                      return parkingBuilding ? {
                        id: parkingBuilding.id,
                        name: parkingBuilding.name,
                        lat: parkingBuilding.lat,
                        lng: parkingBuilding.lng,
                        polygon: parkingBuilding.polygon as Array<{ lat: number; lng: number }> | null,
                        polygons: (parkingBuilding as any).polygons || null
                      } : null;
                    })()
                  : null
              }
              navigationParkingBuildings={
                activeNavPhaseIndex === null && route?.phases
                  ? (() => {
                      const parkingTypes = ['Car Parking', 'Motorcycle Parking', 'Bike Parking'];
                      const parkingIds = new Set<string>();
                      route.phases.forEach(phase => {
                        if (phase.startId) parkingIds.add(phase.startId);
                        if (phase.endId) parkingIds.add(phase.endId);
                      });
                      if (route.parkingLocation?.id) {
                        parkingIds.add(route.parkingLocation.id);
                      }
                      return Array.from(parkingIds)
                        .map(id => buildings.find(b => b.id === id))
                        .filter((b): b is Building => !!b && parkingTypes.includes(b.type || ''))
                        .map(b => ({
                          id: b.id,
                          name: b.name,
                          lat: b.lat,
                          lng: b.lng,
                          polygon: b.polygon as Array<{ lat: number; lng: number }> | null,
                          polygons: (b as any).polygons || null
                        }));
                    })()
                  : []
              }
              navigationWaypointBuildings={
                activeNavPhaseIndex === null && route && route.waypoints && route.waypoints.length > 0
                  ? route.waypoints
                      .map(wp => ({
                        id: wp.id,
                        name: wp.name,
                        lat: wp.lat,
                        lng: wp.lng,
                        polygon: wp.polygon as Array<{ lat: number; lng: number }> | null,
                        polygons: (wp as any).polygons || null
                      }))
                  : []
              }
              parkingSelectionMode={parkingSelectionMode}
              parkingTypeFilter={
                parkingSelectionMode && vehicleType
                  ? (vehicleType === 'car' ? 'Car Parking' : vehicleType === 'motorcycle' ? 'Motorcycle Parking' : 'Bike Parking')
                  : null
              }
              onParkingSelected={handleParkingSelection}
              highlightedParkingIds={
                parkingSelectionMode && vehicleType
                  ? getParkingAreasForVehicle(vehicleType).map(p => p.id)
                  : []
              }
              poiTypeData={poiTypesData}
            />
          )}
        </main>
      </div>

      {selectedBuilding && (
        <BuildingInfoModal
          building={selectedBuilding}
          staff={buildingStaff}
          floors={buildingFloors}
          onClose={() => setSelectedBuilding(null)}
          onOpenFloorPlan={setSelectedFloor}
          onGetDirections={handleGetDirections}
        />
      )}

      {selectedFloor && navigationPhase !== 'indoor' && (
        <FloorPlanViewer
          floor={selectedFloor}
          rooms={indoorNodes
            .filter(n => n.floorId === selectedFloor.id && !['entrance', 'stairway', 'elevator'].includes(n.type))
            .map(n => ({
              id: n.id,
              name: n.label || 'Unnamed Room',
              type: n.type,
              description: n.description || null,
              floorId: n.floorId,
              buildingId: selectedBuilding?.id || '',
              x: n.x,
              y: n.y,
              isIndoorNode: true,
              category: n.category || null,
              labelX: (n as any).labelX ?? null,
              labelY: (n as any).labelY ?? null,
              imageUrl: (n as any).imageUrl || null
            }))}
          indoorNodes={indoorNodes}
          onClose={() => setSelectedFloor(null)}
          onGetDirections={(room) => {
            const floorBuilding = selectedBuilding || buildings.find(b => b.id === room.buildingId);
            if (floorBuilding) {
              setDirectionsDestination(floorBuilding);
              setSelectedRoomForNav({
                id: room.id,
                name: room.name,
                buildingName: floorBuilding.name
              });
              setShowDirectionsDialog(true);
            }
            setSelectedFloor(null);
            setSelectedBuilding(null);
          }}
        />
      )}

      <GetDirectionsDialog
        open={showDirectionsDialog}
        destination={directionsDestination}
        buildings={buildings}
        selectedRoom={selectedRoomForNav}
        onClose={() => {
          setShowDirectionsDialog(false);
          setSelectedRoomForNav(null);
        }}
        onNavigate={handleNavigateFromDialog}
      />

      {savedRouteId && (
        <QRCodeDialog
          open={showQRCode}
          onClose={() => setShowQRCode(false)}
          routeId={savedRouteId}
        />
      )}

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-navigation-feedback">
          <DialogHeader>
            <DialogTitle>Give Feedback</DialogTitle>
            <DialogDescription>
              Would you like to help us improve by giving feedback about your navigation experience?
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => handleGiveFeedback(false)}
              className="flex-1"
              data-testid="button-skip-feedback"
            >
              No, Skip
            </Button>
            <Button
              onClick={() => handleGiveFeedback(true)}
              className="flex-1"
              data-testid="button-go-to-feedback"
            >
              Yes, Give Feedback
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showVehicleSelector} onOpenChange={setShowVehicleSelector}>
        <DialogContent className="sm:max-w-md z-[9999]" data-testid="dialog-vehicle-selector">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="w-5 h-5" />
              Choose Your Vehicle
            </DialogTitle>
            <DialogDescription>
              Select the vehicle you'll be using to reach your destination
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-4 pt-4">
            <Button
              variant="outline"
              className="h-28 flex flex-col gap-2 hover-elevate active-elevate-2"
              onClick={() => handleVehicleSelection('car')}
              data-testid="button-vehicle-car"
            >
              <Car className="w-8 h-8" />
              <span className="font-semibold">Car</span>
            </Button>

            <Button
              variant="outline"
              className="h-28 flex flex-col gap-2 hover-elevate active-elevate-2"
              onClick={() => handleVehicleSelection('motorcycle')}
              data-testid="button-vehicle-motorcycle"
            >
              <Bike className="w-8 h-8" />
              <span className="font-semibold">Motorcycle</span>
            </Button>

            <Button
              variant="outline"
              className="h-28 flex flex-col gap-2 hover-elevate active-elevate-2"
              onClick={() => handleVehicleSelection('bike')}
              data-testid="button-vehicle-bike"
            >
              <Bike className="w-8 h-8" />
              <span className="font-semibold">Bike</span>
            </Button>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowVehicleSelector(false);
                setPendingNavigationData(null);
              }}
              className="flex-1"
              data-testid="button-vehicle-cancel"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDrivingAdvisory} onOpenChange={(open) => {
        if (!open) {
          setShowDrivingAdvisory(false);
          setPendingDrivingAction(null);
        }
      }}>
        <DialogContent className="sm:max-w-md z-[9999]" data-testid="dialog-driving-advisory">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Driving Advisory
            </DialogTitle>
            <DialogDescription>
              Please read the following before proceeding with driving navigation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted">
              <Car className="w-5 h-5 mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-sm text-foreground">You cannot drive directly to your destination. You will need to park at the nearest designated parking area and walk to your target location.</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-destructive" />
              <p className="text-sm text-foreground">Parking and stopping along the road is prohibited.</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted">
              <NavigationIcon className="w-5 h-5 mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-sm text-foreground">Please follow the campus speed limit to ensure everyone's safety.</p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDrivingAdvisory(false);
                setPendingDrivingAction(null);
              }}
              className="flex-1"
              data-testid="button-advisory-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDrivingAdvisoryAcknowledge}
              className="flex-1"
              data-testid="button-advisory-acknowledge"
            >
              I Understand
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Room Finder Dialog */}
      <RoomFinderDialog
        open={showRoomFinder}
        onClose={() => setShowRoomFinder(false)}
        rooms={rooms}
        floors={floors}
        buildings={buildings}
        indoorNodes={indoorNodes}
        onGetDirections={(buildingId, roomId) => {
          const building = buildings.find(b => b.id === buildingId);
          if (building) {
            setDirectionsDestination(building);
            // If roomId provided, store room info for display
            if (roomId) {
              const room = indoorNodes.find(n => n.id === roomId && n.type === 'room');
              if (room) {
                setSelectedRoomForNav({
                  id: roomId,
                  name: room.label || 'Unnamed Room',
                  buildingName: building.name
                });
              }
            }
            setShowDirectionsDialog(true);
          }
        }}
        onViewFloorPlan={(floor, floorRooms) => {
          setRoomFinderFloorPlan({ floor, rooms: floorRooms });
          setShowRoomFinder(false);
        }}
      />

      {/* Floor Plan Viewer from Room Finder - Wrapped in Dialog */}
      {roomFinderFloorPlan && (
        <Dialog open={true}>
          <DialogContent className="max-w-6xl w-[95vw] h-[95vh] flex flex-col p-0 border-0 bg-transparent shadow-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" data-testid="dialog-floor-plan-from-room-finder">
            <div className="flex-1 overflow-hidden">
              <FloorPlanViewer
                floor={roomFinderFloorPlan.floor}
                rooms={roomFinderFloorPlan.rooms}
                indoorNodes={indoorNodes}
                onClose={() => setRoomFinderFloorPlan(null)}
                onGetDirections={(room) => {
                  const floorBuilding = buildings.find(b => b.id === room.buildingId);
                  if (floorBuilding) {
                    setDirectionsDestination(floorBuilding);
                    setSelectedRoomForNav({
                      id: room.id,
                      name: room.name,
                      buildingName: floorBuilding.name
                    });
                    setShowDirectionsDialog(true);
                  }
                  setRoomFinderFloorPlan(null);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Accessible Fallback Dialog */}
      <Dialog open={showAccessibleFallbackDialog} onOpenChange={setShowAccessibleFallbackDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-accessible-fallback">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Accessible Route Unavailable
            </DialogTitle>
            <DialogDescription>
              There is no wheelchair-accessible path connecting to <strong>{originalDestinationName}</strong>. 
              {accessibleFallbackEndpoint ? (
                <>
                  We found the nearest accessible path endpoint and can navigate you there instead.
                </>
              ) : (
                <>
                  Unfortunately, there are no accessible paths available on campus.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {accessibleFallbackEndpoint && (
            <div className="space-y-3 py-4">
              <p className="text-sm text-foreground font-medium">
                Nearest Accessible Endpoint:
              </p>
              <Card className="p-3 bg-muted/50">
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    if (!selectedStart || !accessibleFallbackEndpoint) return 'Location found';
                    const lat1 = (selectedStart as any).lat ?? 0;
                    const lng1 = (selectedStart as any).lng ?? 0;
                    const lat2 = accessibleFallbackEndpoint.lat;
                    const lng2 = accessibleFallbackEndpoint.lng;
                    const R = 6371000;
                    const dLat = (lat2 - lat1) * Math.PI / 180;
                    const dLng = (lng2 - lng1) * Math.PI / 180;
                    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
                    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    const label = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;
                    return `${label} from your position`;
                  })()}
                </p>
              </Card>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowAccessibleFallbackDialog(false)}
              data-testid="button-close-fallback"
            >
              Cancel
            </Button>
            {accessibleFallbackEndpoint && (
              <Button
                className="flex-1"
                onClick={handleNavigateToAccessibleEndpoint}
                data-testid="button-navigate-fallback"
              >
                Navigate to Endpoint
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Multi-stop Accessible Route Warning Dialog */}
      <Dialog open={showMultiStopAccessibleWarning} onOpenChange={setShowMultiStopAccessibleWarning}>
        <DialogContent className="z-[10002]" style={{ zIndex: 10002 }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-yellow-500" />
              Some Stops Are Not Accessible
            </DialogTitle>
            <DialogDescription>
              The following stops along your route do not have wheelchair-accessible paths. The route will navigate to the nearest accessible endpoint of each inaccessible stop instead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {multiStopInaccessibleStops.map((stop, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
                <span className="text-yellow-600 dark:text-yellow-400 mt-0.5">⚠️</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{stop.buildingName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {stop.nearestEndpoint
                      ? 'Will route to nearest accessible endpoint'
                      : 'No accessible path or endpoint found — this stop may be skipped'}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowMultiStopAccessibleWarning(false);
                setPendingMultiPhaseNavRoute(null);
                setMultiStopInaccessibleStops([]);
              }}
              data-testid="button-multi-accessible-back"
            >
              Go Back to Route Creation
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setShowMultiStopAccessibleWarning(false);
                if (pendingMultiPhaseNavRoute) {
                  setRoute(pendingMultiPhaseNavRoute);
                  setPendingMultiPhaseNavRoute(null);
                  setMultiStopInaccessibleStops([]);
                }
              }}
              data-testid="button-multi-accessible-proceed"
            >
              Proceed Anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
