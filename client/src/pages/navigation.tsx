import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Navigation as NavigationIcon, TrendingUp, MapPin, Filter, Search, Users, Car, Bike, QrCode, Plus, X, GripVertical, Clock, ChevronDown, DoorOpen } from "lucide-react";
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
import type { Building, NavigationRoute, Staff, Floor, Room, VehicleType, RouteStep, RoutePhase, IndoorNode, RoomPath, LatLng } from "@shared/schema";
import { poiTypes, KIOSK_LOCATION } from "@shared/schema";
import { useGlobalInactivity } from "@/hooks/use-inactivity";
import { findShortestPath, findNearestAccessibleEndpoint } from "@/lib/pathfinding";
import { buildIndoorGraph, findRoomPath, connectOutdoorToIndoor } from "@/lib/indoor-pathfinding";
import { getWalkpaths, getDrivepaths } from "@/lib/offline-data";
import { calculateMultiPhaseRoute, multiPhaseToNavigationRoute } from "@/lib/multi-phase-routes";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { calculateETA, parseDistance } from "@/lib/eta-calculator";
import { useLocation } from "wouter";

export default function Navigation() {
  // Return to home after 3 minutes of inactivity
  useGlobalInactivity();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedStart, setSelectedStart] = useState<Building | null | typeof KIOSK_LOCATION>(null);
  const [selectedEnd, setSelectedEnd] = useState<Building | null>(null);
  const [mode, setMode] = useState<'walking' | 'driving' | 'accessible'>('walking');
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);
  const [pendingNavigationData, setPendingNavigationData] = useState<{start: any, end: Building, mode: 'walking' | 'driving' | 'accessible'} | null>(null);
  const [route, setRoute] = useState<NavigationRoute | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(Array.from(poiTypes));
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showDirectionsDialog, setShowDirectionsDialog] = useState(false);
  const [directionsDestination, setDirectionsDestination] = useState<Building | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [savedRouteId, setSavedRouteId] = useState<string | null>(null);
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [showRoomFinder, setShowRoomFinder] = useState(false);
  const [roomFinderFloorPlan, setRoomFinderFloorPlan] = useState<{ floor: Floor; rooms: Room[] } | null>(null);
  const [selectedRoomForNav, setSelectedRoomForNav] = useState<{ id: string; name: string; buildingName: string } | null>(null);
  const [navigationPhase, setNavigationPhase] = useState<'outdoor' | 'indoor' | null>(null);
  const [destinationRoom, setDestinationRoom] = useState<IndoorNode | null>(null);
  const [currentIndoorFloor, setCurrentIndoorFloor] = useState<Floor | null>(null);
  const [floorsInRoute, setFloorsInRoute] = useState<string[]>([]);
  const [outdoorRouteSnapshot, setOutdoorRouteSnapshot] = useState<NavigationRoute | null>(null);
  const [showAccessibleFallbackDialog, setShowAccessibleFallbackDialog] = useState(false);
  const [accessibleFallbackEndpoint, setAccessibleFallbackEndpoint] = useState<{ lat: number; lng: number } | null>(null);
  const [originalDestinationName, setOriginalDestinationName] = useState<string | null>(null);
  
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

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings']
  });

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

  useEffect(() => {
    setSelectedStart(KIOSK_LOCATION as any);
  }, []);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromId = params.get('from');
    const toId = params.get('to');
    const travelMode = params.get('mode') as 'walking' | 'driving';
    const vehicleParam = params.get('vehicle') as 'car' | 'motorcycle' | 'bike' | null;
    const waypointsParam = params.get('waypoints');
    const autoGenerate = params.get('autoGenerate') === 'true';

    if (fromId && toId && buildings.length > 0) {
      const startBuilding = fromId === 'kiosk' 
        ? { ...KIOSK_LOCATION, description: null, departments: null, image: null, markerIcon: null, polygon: null, polygonColor: null }
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
        if (autoGenerate) {
          setTimeout(async () => {
            const routeStartTime = performance.now();
            try {
              const waypointIds = waypointsParam ? waypointsParam.split(',') : [];
              const effectiveMode = travelMode || 'walking';
              
              // For driving mode with vehicle type and no waypoints, use two-phase routing
              if (effectiveMode === 'driving' && vehicleParam && waypointIds.length === 0) {
                const twoPhaseRoute = await generateTwoPhaseRoute(startBuilding as any, endBuilding, vehicleParam);
                if (twoPhaseRoute) {
                  setRoute(twoPhaseRoute);

                  // Save two-phase route for QR code generation
                  try {
                    const routeData = {
                      startId: (startBuilding as any).id,
                      endId: endBuilding.id,
                      waypoints: [],
                      mode: 'driving',
                      vehicleType: vehicleParam,
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
                  trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: effectiveMode, vehicleType: vehicleParam, routeType: 'two-phase', source: 'autoGenerate' });
                  return;
                }
              }

              // Multi-stop navigation
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
                    const routeData = {
                      startId: (startBuilding as any).id,
                      endId: endBuilding.id,
                      waypoints: waypointIds,
                      mode: effectiveMode,
                      vehicleType: vehicleParam || null,
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
                  trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: effectiveMode, hasWaypoints: waypointIds.length > 0, routeType: 'multi-phase', source: 'autoGenerate' });
                  return;
                }
              }

              // Single destination route
              const routePolyline = await calculateRouteClientSide(
                startBuilding as any,
                endBuilding,
                effectiveMode
              );

              if (routePolyline) {
                const { steps, totalDistance } = generateSmartSteps(
                  routePolyline,
                  effectiveMode,
                  startBuilding.name,
                  endBuilding.name
                );

                setRoute({
                  start: startBuilding as any,
                  end: endBuilding,
                  mode: effectiveMode,
                  polyline: routePolyline,
                  steps,
                  totalDistance
                });

                // Save route
                try {
                  const routeData = {
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
                      endName: endBuilding.name,
                      color: '#3B82F6',
                      phaseIndex: 0,
                      startId: (startBuilding as any).id,
                      endId: endBuilding.id
                    }],
                    expiresAt: null
                  };

                  const res = await apiRequest('POST', '/api/routes', routeData);
                  const response = await res.json();

                  if (response.id) {
                    setSavedRouteId(response.id);
                  }
                } catch (error) {
                  console.error('Error saving route:', error);
                }

                const duration = performance.now() - routeStartTime;
                trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode: effectiveMode, routeType: 'standard', routeFound: true, source: 'autoGenerate' });
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
  }, [buildings]);

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

    if (absAngle < 20) {
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

    // Generate turn-based directions
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
      
      // Check if there's a significant direction change
      let hasSignificantTurn = false;
      if (i < bearings.length - 1) {
        let angleDiff = bearings[i + 1] - bearings[i];
        // Normalize angle difference to -180 to 180
        if (angleDiff > 180) angleDiff -= 360;
        if (angleDiff < -180) angleDiff += 360;
        
        // Consider it a significant turn if angle change is more than 20 degrees
        hasSignificantTurn = Math.abs(angleDiff) >= 20;
        
        if (hasSignificantTurn || isLastSegment) {
          if (accumulatedDistance > 0 && !isLastSegment) {
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

  // Check if start location can drive directly (is a gate, parking, or kiosk)
  const canStartDriving = (start: Building | typeof KIOSK_LOCATION): boolean => {
    if (start.id === 'kiosk') return true; // Kiosk is near driveable area
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

  // Generate route from building using user-selected parking (walk to parking, drive to dest)
  const generateBuildingDepartureRoute = async (
    start: Building,
    end: Building,
    vehicleType: VehicleType,
    userSelectedParking: Building
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
    } else {
      // Destination is a building - find parking near it
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

  // Handler for when user selects a parking location on the map
  const handleParkingSelection = async (parking: Building) => {
    if (!pendingDrivingRoute || !vehicleType) return;

    setSelectedVehicleParking(parking);
    setParkingSelectionMode(false);
    setShowParkingSelector(false);

    const { start, end, vehicleType: vType, waypoints: waypointBuildings } = pendingDrivingRoute;
    const waypointIds = waypointBuildings.map(w => w.id);

    // Route without waypoints - use simple building departure logic
    if (waypointBuildings.length === 0) {
      const route = await generateBuildingDepartureRoute(start as Building, end, vType, parking);
      if (route) {
        setRoute(route);
        
        try {
          const routeData = {
            startId: start.id,
            endId: end.id,
            waypoints: [],
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
          console.error('Error saving building departure route:', error);
        }
      }
    } else {
      // Route with waypoints - build multi-phase route with user-selected parking
      try {
        const phases: NavigationRoute['phases'] = [];
        let allPolylines: LatLng[] = [];
        let allSteps: NavigationStep[] = [];
        let totalDistanceMeters = 0;

        // Phase 1: Walk from starting building to user-selected parking
        const initialWalkPolyline = await calculateRouteClientSide(start as Building, parking, 'walking');
        if (!initialWalkPolyline) {
          toast({
            title: "Route Calculation Failed",
            description: `Unable to calculate walking route to ${parking.name}.`,
            variant: "destructive"
          });
          setPendingDrivingRoute(null);
          return;
        }

        const initialWalkPhase = generateSmartSteps(initialWalkPolyline, 'walking', (start as Building).name, parking.name);
        phases.push({
          mode: 'walking',
          polyline: initialWalkPolyline,
          steps: initialWalkPhase.steps,
          distance: initialWalkPhase.totalDistance,
          startName: (start as Building).name,
          endName: parking.name,
          color: '#10B981',
          phaseIndex: 0,
          startId: (start as Building).id,
          endId: parking.id
        });
        allPolylines = [...allPolylines, ...initialWalkPolyline];
        allSteps = [...allSteps, ...initialWalkPhase.steps];
        totalDistanceMeters += parseInt(initialWalkPhase.totalDistance.replace(' m', ''));

        // Build all driving stops: parking -> waypoints -> final destination (or parking near final)
        const driveStops: Building[] = [parking];
        
        // Add waypoints - for buildings, find nearby parking; for gates/parking, use directly
        for (const waypoint of waypointBuildings) {
          if (isGate(waypoint) || isParking(waypoint)) {
            driveStops.push(waypoint);
          } else {
            // Find parking near waypoint building
            const nearbyParking = findNearestBuilding(waypoint, getParkingAreasForVehicle(vType));
            if (nearbyParking) {
              driveStops.push(nearbyParking);
            }
          }
        }

        // Determine final driving destination
        const needsFinalWalk = !isGate(end) && !isParkingForVehicle(end, vType);
        let finalDriveStop: Building;
        if (needsFinalWalk) {
          const nearbyParking = findNearestBuilding(end, getParkingAreasForVehicle(vType));
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
        driveStops.push(finalDriveStop);

        // Phase 2+: Driving segments between stops
        for (let i = 0; i < driveStops.length - 1; i++) {
          const segmentStart = driveStops[i];
          const segmentEnd = driveStops[i + 1];
          
          const drivePolyline = await calculateDrivePath(segmentStart, segmentEnd);
          if (!drivePolyline) {
            toast({
              title: "Route Calculation Failed",
              description: `Unable to calculate driving route from ${segmentStart.name} to ${segmentEnd.name}.`,
              variant: "destructive"
            });
            setPendingDrivingRoute(null);
            return;
          }

          const drivePhase = generateSmartSteps(drivePolyline, 'driving', segmentStart.name, segmentEnd.name);
          phases.push({
            mode: 'driving',
            polyline: drivePolyline,
            steps: drivePhase.steps,
            distance: drivePhase.totalDistance,
            startName: segmentStart.name,
            endName: segmentEnd.name,
            color: '#3B82F6',
            phaseIndex: phases.length,
            startId: segmentStart.id,
            endId: segmentEnd.id
          });
          allPolylines = [...allPolylines, ...drivePolyline];
          allSteps = [...allSteps, ...drivePhase.steps];
          totalDistanceMeters += parseInt(drivePhase.totalDistance.replace(' m', ''));
        }

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

        const route: NavigationRoute = {
          start: { ...(start as Building), polygon: null, polygonColor: null },
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
    setSelectedVehicleParking(null);
    toast({
      title: "Route Cancelled",
      description: "Parking selection was cancelled.",
      variant: "default"
    });
  };

  const generateTwoPhaseRoute = async (
    start: Building | typeof KIOSK_LOCATION,
    end: Building,
    vehicleType: VehicleType
  ): Promise<NavigationRoute | null> => {
    try {
      // SCENARIO 1: Destination is a matching parking lot - just drive there directly
      if (isParkingForVehicle(end, vehicleType)) {
        return await generateDirectDrivingRoute(start, end, vehicleType);
      }

      // SCENARIO 2: Start can drive directly (gate, parking, or kiosk)
      if (canStartDriving(start)) {
        // Sub-scenario 2a: Gate/Parking to Gate - direct driving
        if (isGate(end)) {
          return await generateDirectDrivingRoute(start, end, vehicleType);
        }
        
        // Sub-scenario 2b: Gate/Parking to Building - drive to parking near building, then walk
        return await generateDriveToBuilding(start, end, vehicleType);
      }

      // SCENARIO 3: Start is a building - need user to select where their vehicle is parked
      // This triggers parking selection mode and returns null (route will be generated after selection)
      const parkingAreas = getParkingAreasForVehicle(vehicleType);
      
      if (parkingAreas.length === 0) {
        toast({
          title: "No Parking Available",
          description: `No ${capitalizeVehicleType(vehicleType)} parking areas found on campus.`,
          variant: "destructive"
        });
        return null;
      }

      // Trigger parking selection mode
      setPendingDrivingRoute({
        start: start as Building,
        end,
        vehicleType,
        waypoints: []
      });
      setParkingSelectionMode(true);
      setShowParkingSelector(true);

      toast({
        title: "Select Your Parking Location",
        description: `Tap on the ${capitalizeVehicleType(vehicleType)} parking area where your vehicle is parked.`,
        variant: "default"
      });

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
      setPendingNavigationData({ start: selectedStart, end: selectedEnd, mode });
      setShowVehicleSelector(true);
      const duration = performance.now() - routeStartTime;
      trackEvent(AnalyticsEventType.ROUTE_GENERATION, duration, { mode, hasWaypoints: validWaypoints.length > 0, vehicleSelected: false });
      return;
    }

    try {
      // Multi-stop navigation: use multi-phase route calculator
      if (validWaypoints.length > 0) {
        const waypointBuildings = validWaypoints
          .map(id => buildings.find(b => b.id === id))
          .filter(Boolean) as Building[];

        // For driving mode with waypoints: check if we need parking selection first
        if (mode === 'driving' && vehicleType && !canStartDriving(selectedStart)) {
          // Start is a building - need user to select parking first
          const parkingAreas = getParkingAreasForVehicle(vehicleType);
          
          if (parkingAreas.length === 0) {
            toast({
              title: "No Parking Available",
              description: `No ${capitalizeVehicleType(vehicleType)} parking areas found on campus.`,
              variant: "destructive"
            });
            return;
          }

          // Trigger parking selection mode with waypoints
          setPendingDrivingRoute({
            start: selectedStart as Building,
            end: selectedEnd,
            vehicleType,
            waypoints: waypointBuildings
          });
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
    }
  };

  const handleVehicleSelection = async (selectedVehicle: VehicleType) => {
    setVehicleType(selectedVehicle);
    setShowVehicleSelector(false);

    if (pendingNavigationData) {
      const { start, end, mode } = pendingNavigationData;
      
      // Try two-phase route with selected vehicle
      const twoPhaseRoute = await generateTwoPhaseRoute(start, end, selectedVehicle);
      if (twoPhaseRoute) {
        setRoute(twoPhaseRoute);
        setSelectedStart(start);
        setSelectedEnd(end);
        setMode(mode);
        setPendingNavigationData(null);

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
          setSelectedStart(start);
          setSelectedEnd(end);
          setMode(fallbackMode);

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
      
      setPendingNavigationData(null);
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
    setDestinationRoom(null);
    setSelectedRoomForNav(null);
    setSelectedFloor(null);
    setCurrentIndoorFloor(null);
    setFloorsInRoute([]);
    setOutdoorRouteSnapshot(null);
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
    
    // Find entrance node on current floor
    const entranceNode = indoorNodes.find(n => 
      n.type === 'entrance' && n.floorId === entranceFloor.id
    );
    
    if (!entranceNode) return;
    
    // Determine target for this floor: either destination room (if same floor) or nearest stairway (if multi-floor)
    let targetNode: IndoorNode | undefined;
    if (roomFloor.id === entranceFloor.id) {
      // Same floor - route to destination
      targetNode = destinationRoom;
    } else {
      // Multi-floor - route to nearest stairway/elevator
      const stairways = indoorNodes.filter(n => (n.type === 'stairway' || n.type === 'elevator') && n.floorId === entranceFloor.id);
      if (stairways.length === 0) return;
      targetNode = stairways[0];
    }
    
    // Get floor-specific data
    const floorRoomPaths = roomPaths.filter(rp => rp.floorId === entranceFloor.id);
    const floorRooms = rooms.filter(r => r.floorId === entranceFloor.id);
    const floorIndoorNodes = indoorNodes.filter(n => n.floorId === entranceFloor.id);
    
    // Build indoor graph using the same pathfinding logic as outdoor navigation
    const indoorGraph = buildIndoorGraph(floorRooms, floorIndoorNodes, floorRoomPaths, roomFloor.pixelToMeterScale || 1);
    
    // DEBUG: Log graph structure
    console.log('[INDOOR-PATH] Building graph...');
    console.log('[INDOOR-PATH] Total nodes:', indoorGraph.nodes.size);
    console.log('[INDOOR-PATH] Total edges:', indoorGraph.edges.length);
    
    // Use Dijkstra's algorithm to find shortest path
    const { nodes, edges } = indoorGraph;
    const entranceKey = `${entranceFloor.id}:${entranceNode.id}`;
    const destKey = `${entranceFloor.id}:${targetNode.id}`;
    
    console.log('[INDOOR-PATH] Entrance key:', entranceKey, 'Dest key:', destKey);
    console.log('[INDOOR-PATH] Entrance exists:', nodes.has(entranceKey), 'Dest exists:', nodes.has(destKey));
    
    // Dijkstra's algorithm
    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const unvisited = new Set<string>();
    
    nodes.forEach((_, key) => {
      distances.set(key, Infinity);
      previous.set(key, null);
      unvisited.add(key);
    });
    
    distances.set(entranceKey, 0);
    
    console.log('[INDOOR-PATH] Starting Dijkstra from:', entranceKey);
    console.log('[INDOOR-PATH] Initial unvisited size:', unvisited.size);
    console.log('[INDOOR-PATH] Entrance in unvisited?', unvisited.has(entranceKey));
    console.log('[INDOOR-PATH] Entrance distance:', distances.get(entranceKey));
    
    let iterations = 0;
    while (unvisited.size > 0) {
      iterations++;
      let current: string | null = null;
      let minDist = Infinity;
      
      unvisited.forEach(key => {
        const dist = distances.get(key) ?? Infinity;
        if (dist < minDist) {
          minDist = dist;
          current = key;
        }
      });
      
      if (iterations === 1) {
        console.log(`[INDOOR-PATH] Iteration 1: current=${current}, minDist=${minDist}, destKey=${destKey}`);
      }
      
      if (!current) {
        console.log('[INDOOR-PATH] Dijkstra: No current node found, breaking');
        break;
      }
      
      if (current === destKey) {
        console.log('[INDOOR-PATH] Dijkstra: Reached destination at iteration', iterations);
        break;
      }
      
      unvisited.delete(current);
      
      const outgoingEdges = edges.filter(e => e.from === current);
      
      outgoingEdges.forEach(edge => {
        if (unvisited.has(edge.to)) {
          const alt = (distances.get(current!) ?? Infinity) + edge.distance;
          if (alt < (distances.get(edge.to) ?? Infinity)) {
            distances.set(edge.to, alt);
            previous.set(edge.to, current!);
          }
        }
      });
      
      if (iterations > 100) {
        console.log('[INDOOR-PATH] Dijkstra: Too many iterations, breaking');
        break;
      }
    }
    
    console.log('[INDOOR-PATH] Dijkstra completed in', iterations, 'iterations');
    console.log('[INDOOR-PATH] Distance to destination:', distances.get(destKey));
    
    // Reconstruct shortest path
    const shortestPath: string[] = [];
    let current: string | null = destKey;
    
    while (current !== null) {
      shortestPath.unshift(current);
      current = previous.get(current) || null;
    }
    
    console.log('[INDOOR-PATH] Shortest path:', shortestPath);
    console.log('[INDOOR-PATH] Path length:', shortestPath.length);
    
    // Extract waypoints by following the edges in the shortest path
    let polylineWaypoints: Array<{ lat: number; lng: number }> = [
      { lat: entranceNode.x, lng: entranceNode.y }
    ];
    
    // For each consecutive pair of nodes in the shortest path, find the edge and get its waypoints
    for (let i = 0; i < shortestPath.length - 1; i++) {
      const fromNode = shortestPath[i];
      const toNode = shortestPath[i + 1];
      
      // Find the edge from -> to
      const edge = edges.find(e => e.from === fromNode && e.to === toNode);
      
      if (edge && edge.pathWaypoints && edge.pathWaypoints.length > 0) {
        console.log(`[INDOOR-PATH] Edge ${fromNode} -> ${toNode} has ${edge.pathWaypoints.length} waypoints`);
        
        // Add all waypoints from this edge, but skip the first one (it's the start node)
        for (let j = 1; j < edge.pathWaypoints.length; j++) {
          const wp = edge.pathWaypoints[j];
          polylineWaypoints.push({ lat: wp.x, lng: wp.y });
        }
      }
    }
    
    console.log('[INDOOR-PATH] Final polyline waypoints:', polylineWaypoints.length, polylineWaypoints);
    
    // Add target node
    polylineWaypoints.push({ lat: targetNode.x, lng: targetNode.y });
    
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
    const indoorSteps: RouteStep[] = [
      {
        instruction: `Start at ${entranceNode.label || 'Entrance'}`,
        distance: '0 m',
        icon: 'navigation'
      },
      {
        instruction: `Walk to ${targetNode.label || targetNode.type}`,
        distance: totalMeterDistance > 0 ? `${totalMeterDistance} m` : '0 m',
        icon: 'arrow-right'
      },
      {
        instruction: `Arrive at ${targetNode.label || targetNode.type}`,
        distance: '0 m',
        icon: isMultiFloor ? 'arrow-up' : 'flag'
      }
    ];
    
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
      // On next floor, the stairway/elevator IS the entrance point (connecting floors)
      const staircaseOnCurrentFloor = indoorNodes.find(n => 
        (n.type === 'stairway' || n.type === 'elevator') && n.floorId === currentIndoorFloor.id
      );
      
      console.log('[FLOOR2-START] Current floor stairway:', staircaseOnCurrentFloor?.label);
      if (!staircaseOnCurrentFloor) {
        console.log('[FLOOR2-ERROR] No stairway on current floor');
        return;
      }
      
      // Find a stairway on next floor that connects back to current floor
      const entranceNode = indoorNodes.find(n => {
        if ((n.type !== 'stairway' && n.type !== 'elevator') || n.floorId !== nextFloor.id) {
          return false;
        }
        // Check if this stairway connects to current floor
        const connectedFloors = (n as any).connectedFloorIds || [];
        return connectedFloors.includes(currentIndoorFloor.id);
      });
      
      console.log('[FLOOR2-START] Entrance node on next floor found:', !!entranceNode, entranceNode?.label);
      if (!entranceNode) {
        console.log('[FLOOR2-ERROR] No stairway on Floor 2 connects back to Floor 1');
        // Fallback: find ANY stairway on next floor
        const anyStairway = indoorNodes.find(n => (n.type === 'stairway' || n.type === 'elevator') && n.floorId === nextFloor.id);
        if (!anyStairway) {
          console.log('[FLOOR2-ERROR] No stairways at all on next floor');
          return;
        }
        console.log('[FLOOR2-FALLBACK] Using fallback stairway:', anyStairway.label);
      }
      
      // Determine target: either destination or next stairway
      let targetNode: IndoorNode | undefined;
      if (roomFloor.id === nextFloor.id) {
        targetNode = destinationRoom;
        console.log('[FLOOR2-START] Target is destination room:', targetNode?.label);
      } else {
        const stairways = indoorNodes.filter(n => (n.type === 'stairway' || n.type === 'elevator') && n.floorId === nextFloor.id);
        console.log('[FLOOR2-START] Found', stairways.length, 'stairways on floor');
        if (stairways.length === 0) {
          console.log('[FLOOR2-ERROR] No stairways on floor');
          return;
        }
        targetNode = stairways[0];
        console.log('[FLOOR2-START] Target is stairway:', targetNode?.label);
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
      let polylineWaypoints: Array<{ lat: number; lng: number }> = [
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
      const indoorPhase: RoutePhase = {
        mode: 'walking',
        polyline: polylineWaypoints,
        steps: [
          {
            instruction: `Start at ${startNode.label || 'Floor ' + nextFloor.floorNumber}`,
            distance: '0 m',
            icon: 'navigation'
          },
          {
            instruction: `Walk to ${targetNode.label || targetNode.type}`,
            distance: '0 m',
            icon: 'arrow-right'
          }
        ],
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
    
    toast({
      title: "Floor Changed",
      description: `Back to ${prevFloor.floorName || `Floor ${prevFloor.floorNumber}`}`,
    });
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

    const routeStartTime = performance.now();

    // Handle kiosk location or regular building
    const start = startId === 'kiosk' 
      ? KIOSK_LOCATION as any
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
  const filteredBuildings = buildings.filter(b => {
    const matchesType = selectedTypes.includes(b.type);
    const matchesSearch = searchQuery === "" || 
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="bg-card border-b border-card-border p-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Campus Navigation</h1>
              <p className="text-sm text-muted-foreground">Find your way around CVSU CCAT</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowRoomFinder(true)}
              data-testid="button-room-finder"
            >
              <DoorOpen className="w-4 h-4 mr-2" />
              Room Finder
            </Button>
            <Link href="/staff">
              <Button variant="default" data-testid="button-staff-finder">
                <Users className="w-4 h-4 mr-2" />
                Staff Finder
              </Button>
            </Link>
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
                        {selectedTypes.length === poiTypes.length 
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
                          onClick={() => setSelectedTypes(Array.from(poiTypes))}
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
                        {poiTypes.map((type) => (
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
                  selectedId={selectedStart?.id}
                  onSelect={(id) => {
                    if (id === 'kiosk') {
                      setSelectedStart(KIOSK_LOCATION as any);
                    } else {
                      const building = buildings.find(b => b.id === id);
                      setSelectedStart(building || null);
                    }
                  }}
                  buildings={buildings}
                  testId="select-start"
                />
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
                      Walking
                    </TabsTrigger>
                    <TabsTrigger value="driving" className="flex-1" data-testid="tab-driving">
                      Driving
                    </TabsTrigger>
                    <TabsTrigger value="accessible" className="flex-1" data-testid="tab-accessible">
                      Accessible
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Waypoints Section */}
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
                      <div key={index} className="flex gap-2 items-center">
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleMoveWaypoint(index, 'up')}
                            disabled={index === 0}
                            data-testid={`button-move-waypoint-up-${index}`}
                          >
                            <GripVertical className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleMoveWaypoint(index, 'down')}
                            disabled={index === waypoints.length - 1}
                            data-testid={`button-move-waypoint-down-${index}`}
                          >
                            <GripVertical className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="flex-1">
                          <SearchableWaypointSelect
                            selectedId={waypointId}
                            onSelect={(id) => handleWaypointChange(index, id)}
                            buildings={buildings}
                            excludeIds={[
                              selectedStart?.id || '',
                              selectedEnd?.id || '',
                              ...waypoints.filter((_, i) => i !== index)
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
                  {selectedTypes.length === poiTypes.length ? "All Locations" : "Filtered Locations"}
                </h3>
                <div className="space-y-2">
                  {filteredBuildings.length > 0 ? (
                    filteredBuildings.map(building => (
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
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No locations found
                    </p>
                  )}
                </div>
              </div>
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
                {route.phases && route.phases.length > 0 ? (
                  <>
                    {route.phases.map((phase, phaseIndex) => {
                      // Calculate ETA based on distance and travel mode
                      const parseDistance = (distStr: string): number => {
                        const match = distStr.match(/(\d+(?:\.\d+)?)\s*m/);
                        return match ? parseFloat(match[1]) : 0;
                      };
                      
                      const distanceMeters = parseDistance(phase.distance);
                      // Average speeds: walking ~1.4 m/s, driving ~10 m/s
                      const speed = phase.mode === 'walking' ? 1.4 : 10;
                      const seconds = distanceMeters / speed;
                      const minutes = Math.ceil(seconds / 60);
                      const eta = minutes > 0 ? `${minutes} min` : '< 1 min';
                      
                      // Convert phase color to RGB for text contrast
                      const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
                        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                        return result ? {
                          r: parseInt(result[1], 16),
                          g: parseInt(result[2], 16),
                          b: parseInt(result[3], 16)
                        } : null;
                      };
                      
                      const phaseRgb = hexToRgb(phase.color);
                      const isLightColor = phaseRgb ? 
                        (phaseRgb.r * 299 + phaseRgb.g * 587 + phaseRgb.b * 114) / 1000 > 128 : 
                        false;
                      
                      // Check if this is an indoor phase (indoor phases use color #ef4444)
                      const isIndoorPhase = phase.color === '#ef4444';
                      
                      return (
                        <div key={phaseIndex} className="mb-6">
                          <div className="flex items-center gap-2 mb-3">
                            <div 
                              className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                isLightColor ? 'text-black' : 'text-white'
                              }`}
                              style={{ backgroundColor: phase.color }}
                              data-testid={`phase-badge-${phaseIndex}`}
                            >
                              {phaseIndex + 1}
                            </div>
                            <h4 className="text-sm font-semibold text-foreground">
                              {phase.mode === 'driving' 
                                ? `${route.vehicleType === 'bike' ? 'Ride' : 'Drive'} to ${phase.endName}`
                                : `Walk to ${phase.endName}`}
                            </h4>
                            {/* Hide distance and time estimates for indoor phases */}
                            {!isIndoorPhase && (
                              <div className="text-xs text-muted-foreground ml-auto flex gap-2">
                                <span>{phase.distance}</span>
                                <span>•</span>
                                <span>{eta}</span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-3 pl-8">
                            {phase.steps.map((step, stepIndex) => (
                              <div
                                key={stepIndex}
                                className="flex gap-3"
                                data-testid={`route-phase-${phaseIndex}-step-${stepIndex}`}
                              >
                                <div className="flex-shrink-0 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center text-xs font-medium text-muted-foreground">
                                  {stepIndex + 1}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-foreground">{step.instruction}</p>
                                  {/* Hide step distance for indoor phases */}
                                  {!isIndoorPhase && (
                                    <p className="text-xs text-muted-foreground">{step.distance}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <h4 className="text-sm font-medium text-foreground mb-3">Directions</h4>
                    <div className="space-y-3">
                      {route.steps.map((step, index) => (
                        <div
                          key={index}
                          className="flex gap-3"
                          data-testid={`route-step-${index}`}
                        >
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
                )}

                {/* Phase-specific Navigation Buttons */}
                {navigationPhase === 'indoor' && destinationRoom && currentIndoorFloor ? (
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
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Go Back
                    </Button>
                  </div>
                ) : navigationPhase === 'outdoor' && destinationRoom ? (
                  <Button
                    className="w-full mt-6"
                    onClick={handleReachedBuilding}
                    data-testid="button-reached-building"
                  >
                    Reached the Building
                  </Button>
                ) : (
                  <Button
                    className="w-full mt-6"
                    onClick={handleDoneNavigating}
                    data-testid="button-done-navigating"
                  >
                    Done Navigating
                  </Button>
                )}
              </div>
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-hidden relative">
          {parkingSelectionMode && vehicleType && (
            <div className="absolute top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-900 px-4 py-3 shadow-lg flex items-center justify-between gap-3" data-testid="banner-parking-selection">
              <div className="flex items-center gap-2 flex-1">
                <MapPin className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">
                  Tap on a {capitalizeVehicleType(vehicleType)} Parking area on the map to indicate where your vehicle is parked
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
              rooms={indoorNodes
                .filter(n => n.floorId === currentIndoorFloor.id && n.type === 'room')
                .map(n => ({
                  id: n.id,
                  name: n.label || 'Unnamed Room',
                  type: 'room',
                  description: n.description || null,
                  floorId: n.floorId,
                  buildingId: selectedEnd?.id || '',
                  x: n.x,
                  y: n.y,
                  isIndoorNode: true
                }))}
              indoorNodes={indoorNodes}
              onClose={() => {
                setNavigationPhase(null);
                setCurrentIndoorFloor(null);
              }}
              highlightedRoomId={currentIndoorFloor.id === destinationRoom?.floorId ? destinationRoom?.id : undefined}
              showPathTo={currentIndoorFloor.id === destinationRoom?.floorId ? destinationRoom : indoorNodes.find(n => n.floorId === currentIndoorFloor.id && (n.type === 'stairway' || n.type === 'elevator'))}
              viewOnly={true}
              pathPolyline={route?.phases?.[route.phases.length - 1]?.polyline && route.phases[route.phases.length - 1].polyline.length > 0 ? route.phases[route.phases.length - 1].polyline : undefined}
            />
          ) : (
            <CampusMap
              buildings={filteredBuildings}
              onBuildingClick={setSelectedBuilding}
              selectedBuilding={selectedBuilding}
              routePolyline={route?.polyline}
              routeMode={route?.mode}
              routePhases={route?.phases}
              parkingLocation={route?.parkingLocation}
              hidePolygonsInNavigation={!!route}
              waypointsData={
                route && waypoints.length > 0
                  ? waypoints
                      .map(id => buildings.find(b => b.id === id))
                      .filter((b): b is Building => !!b)
                      .map(b => ({ id: b.id, name: b.name, lat: b.lat, lng: b.lng }))
                  : []
              }
              navigationStartBuilding={
                route && selectedStart && 'id' in selectedStart
                  ? (() => {
                      const startBuilding = buildings.find(b => b.id === selectedStart.id);
                      return startBuilding ? {
                        id: startBuilding.id,
                        name: startBuilding.name,
                        lat: startBuilding.lat,
                        lng: startBuilding.lng,
                        polygon: startBuilding.polygon as Array<{ lat: number; lng: number }> | null
                      } : null;
                    })()
                  : null
              }
              navigationEndBuilding={
                route && selectedEnd
                  ? (() => {
                      const endBuilding = buildings.find(b => b.id === selectedEnd.id);
                      return endBuilding ? {
                        id: endBuilding.id,
                        name: endBuilding.name,
                        lat: endBuilding.lat,
                        lng: endBuilding.lng,
                        polygon: endBuilding.polygon as Array<{ lat: number; lng: number }> | null
                      } : null;
                    })()
                  : null
              }
              navigationParkingBuilding={
                route?.parkingLocation
                  ? (() => {
                      const parkingBuilding = buildings.find(b => b.id === route.parkingLocation?.id);
                      return parkingBuilding ? {
                        id: parkingBuilding.id,
                        name: parkingBuilding.name,
                        lat: parkingBuilding.lat,
                        lng: parkingBuilding.lng,
                        polygon: parkingBuilding.polygon as Array<{ lat: number; lng: number }> | null
                      } : null;
                    })()
                  : null
              }
              navigationWaypointBuildings={
                route && waypoints.length > 0
                  ? waypoints
                      .map(id => buildings.find(b => b.id === id))
                      .filter((b): b is Building => !!b)
                      .map(b => ({
                        id: b.id,
                        name: b.name,
                        lat: b.lat,
                        lng: b.lng,
                        polygon: b.polygon as Array<{ lat: number; lng: number }> | null
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
            .filter(n => n.floorId === selectedFloor.id && n.type === 'room')
            .map(n => ({
              id: n.id,
              name: n.label || 'Unnamed Room',
              type: 'room',
              description: n.description || null,
              floorId: n.floorId,
              buildingId: selectedBuilding?.id || '',
              x: n.x,
              y: n.y,
              isIndoorNode: true
            }))}
          indoorNodes={indoorNodes}
          onClose={() => setSelectedFloor(null)}
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
                  Coordinates: {accessibleFallbackEndpoint.lat.toFixed(4)}°, {accessibleFallbackEndpoint.lng.toFixed(4)}°
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
    </div>
  );
}
