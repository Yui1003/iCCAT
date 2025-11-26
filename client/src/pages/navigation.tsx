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
import type { Building, NavigationRoute, Staff, Floor, Room, VehicleType } from "@shared/schema";
import { poiTypes, KIOSK_LOCATION } from "@shared/schema";
import { useGlobalInactivity } from "@/hooks/use-inactivity";
import { findShortestPath } from "@/lib/pathfinding";
import { buildIndoorGraph, findRoomPath, connectOutdoorToIndoor } from "@/lib/indoor-pathfinding";
import { getWalkpaths, getDrivepaths, getBuildings, getStaff, getFloors, getRooms } from "@/lib/offline-data";
import { calculateMultiPhaseRoute, multiPhaseToNavigationRoute } from "@/lib/multi-phase-routes";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { calculateETA, parseDistance } from "@/lib/eta-calculator";
import { useLocation } from "wouter";
import type { IndoorNode, RoomPath } from "@shared/schema";

export default function Navigation() {
  // Return to home after 3 minutes of inactivity
  useGlobalInactivity();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedStart, setSelectedStart] = useState<Building | null | typeof KIOSK_LOCATION>(null);
  const [selectedEnd, setSelectedEnd] = useState<Building | null>(null);
  const [mode, setMode] = useState<'walking' | 'driving'>('walking');
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);
  const [pendingNavigationData, setPendingNavigationData] = useState<{start: any, end: Building, mode: 'walking' | 'driving'} | null>(null);
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

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings'],
    queryFn: getBuildings
  });

  const { data: staff = [] } = useQuery<Staff[]>({
    queryKey: ['/api/staff'],
    queryFn: getStaff
  });

  const { data: floors = [] } = useQuery<Floor[]>({
    queryKey: ['/api/floors'],
    queryFn: getFloors
  });

  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ['/api/rooms'],
    queryFn: getRooms
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
              }
            } catch (error) {
              console.error('Error generating auto route:', error);
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
    const isWalking = travelMode === 'walking';
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

  const generateSmartSteps = (routePolyline: Array<{ lat: number; lng: number }>, travelMode: 'walking' | 'driving', startName: string, endName: string) => {
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
      const isWalking = travelMode === 'walking';
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
    travelMode: 'walking' | 'driving'
  ): Promise<Array<{ lat: number; lng: number }> | null> => {
    try {
      // For route calculations, always fetch fresh paths data to ensure pathfinding uses latest updates
      const endpoint = travelMode === 'walking' ? '/api/walkpaths' : '/api/drivepaths';
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
        paths
      );

      return route;
    } catch (error) {
      console.error('[CLIENT] Error calculating route:', error);
      return null;
    }
  };

  const generateTwoPhaseRoute = async (
    start: Building | typeof KIOSK_LOCATION,
    end: Building,
    vehicleType: VehicleType
  ): Promise<NavigationRoute | null> => {
    try {
      // Check if destination IS a parking lot matching the vehicle type
      // If so, use single-phase routing (just drive there directly)
      const vehicleToParkingType: Record<VehicleType, string> = {
        'car': 'Car Parking',
        'motorcycle': 'Motorcycle Parking',
        'bike': 'Bike Parking'
      };

      if (end.type === vehicleToParkingType[vehicleType]) {
        // Single-phase route: just drive to the parking lot
        const drivingPolyline = await calculateRouteClientSide(start, end, 'driving');
        
        if (!drivingPolyline) {
          toast({
            title: "Route Calculation Failed",
            description: `Unable to calculate route to ${end.name}. Please try a different destination.`,
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
          description: `Direct route to ${end.name}`,
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
      }

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

      // Phase 1: Driving/Riding to parking
      // All vehicle types (car, motorcycle, bike) should use drivepaths
      const pathType = 'driving';
      const drivingPolyline = await calculateRouteClientSide(start, parkingLocation, pathType);
      
      if (!drivingPolyline) {
        toast({
          title: "Route Calculation Failed",
          description: `Unable to calculate ${pathType} route to ${parkingLocation.name}. Please try a different destination.`,
          variant: "destructive"
        });
        return null;
      }

      const drivingPhase = generateSmartSteps(
        drivingPolyline,
        pathType,
        start.name,
        parkingLocation.name
      );

      // Phase 2: Walking from parking to destination
      const walkingPolyline = await calculateRouteClientSide(parkingLocation, end, 'walking');
      
      if (!walkingPolyline) {
        toast({
          title: "Route Calculation Failed",
          description: `Unable to calculate walking route from ${parkingLocation.name} to ${end.name}. Please try a different destination.`,
          variant: "destructive"
        });
        return null;
      }

      const walkingPhase = generateSmartSteps(
        walkingPolyline,
        'walking',
        parkingLocation.name,
        end.name
      );

      // Combine both polylines for map display
      const combinedPolyline = [...drivingPolyline, ...walkingPolyline];

      // Combine both phases' steps for fallback display
      const combinedSteps = [...drivingPhase.steps, ...walkingPhase.steps];

      // Calculate total distance
      const drivingDist = parseInt(drivingPhase.totalDistance.replace(' m', ''));
      const walkingDist = parseInt(walkingPhase.totalDistance.replace(' m', ''));
      const totalDist = drivingDist + walkingDist;

      // Show success message with parking info
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
            mode: pathType,
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

      // For walking, use regular routing
      const routePolyline = await calculateRouteClientSide(
        selectedStart,
        selectedEnd,
        mode
      );

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
        selectedEnd.name
      );

      setRoute({
        start: { ...selectedStart, polygon: null, polygonColor: null } as Building,
        end: selectedEnd,
        mode,
        polyline: routePolyline,
        steps,
        totalDistance
      });

      // Save single-destination route for QR code generation
      try {
        const routeData = {
          startId: selectedStart.id,
          endId: selectedEnd.id,
          waypoints: [],
          mode,
          vehicleType: vehicleType || null,
          phases: [{
            mode,
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
    travelMode: 'walking' | 'driving',
    selectedVehicle?: VehicleType
  ) => {
    if (!directionsDestination) return;

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
        }
      } catch (error) {
        console.error('Error generating two-phase route:', error);
      }
      return;
    }

    // Single destination without waypoints
    if (waypointBuildings.length === 0) {
      try {
        const routePolyline = await calculateRouteClientSide(start, directionsDestination, travelMode);
        
        if (!routePolyline) {
          toast({
            title: "Route Not Found",
            description: `Unable to calculate ${travelMode} route. Please try again.`,
            variant: "destructive"
          });
          return;
        }

        const { steps, totalDistance } = generateSmartSteps(
          routePolyline,
          travelMode,
          start.name,
          directionsDestination.name
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

          const res = await apiRequest('POST', '/api/routes', routeData);
          const response = await res.json();

          if (response.id) {
            setSavedRouteId(response.id);
          }
        } catch (error) {
          console.error('Error saving single-destination route:', error);
        }
      } catch (error) {
        console.error('Error generating single-destination route:', error);
        toast({
          title: "Navigation Error",
          description: "Unable to calculate route. Please try again.",
          variant: "destructive"
        });
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

        return;
      } catch (error) {
        console.error('Error generating multi-phase route:', error);
        toast({
          title: "Navigation Error",
          description: "Unable to calculate route with stops.",
          variant: "destructive"
        });
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
                <Tabs value={mode} onValueChange={(v) => setMode(v as 'walking' | 'driving')}>
                  <TabsList className="w-full">
                    <TabsTrigger value="walking" className="flex-1" data-testid="tab-walking">
                      Walking
                    </TabsTrigger>
                    <TabsTrigger value="driving" className="flex-1" data-testid="tab-driving">
                      Driving
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
                {route.parkingLocation && (
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
                            <div className="text-xs text-muted-foreground ml-auto flex gap-2">
                              <span>{phase.distance}</span>
                              <span>•</span>
                              <span>{eta}</span>
                            </div>
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
                                  <p className="text-xs text-muted-foreground">{step.distance}</p>
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

                {/* Done Navigating Button */}
                <Button
                  className="w-full mt-6"
                  onClick={handleDoneNavigating}
                  data-testid="button-done-navigating"
                >
                  Done Navigating
                </Button>
              </div>
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-hidden">
          <CampusMap
            buildings={filteredBuildings}
            onBuildingClick={setSelectedBuilding}
            selectedBuilding={selectedBuilding}
            routePolyline={route?.polyline}
            routeMode={route?.mode}
            routePhases={route?.phases}
            hidePolygonsInNavigation={!!route}
            waypointsData={
              route && waypoints.length > 0
                ? waypoints
                    .map(id => buildings.find(b => b.id === id))
                    .filter((b): b is Building => !!b)
                    .map(b => ({ id: b.id, name: b.name, lat: b.lat, lng: b.lng }))
                : []
            }
          />
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

      {selectedFloor && (
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
        onClose={() => setShowDirectionsDialog(false)}
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
        onGetDirections={(buildingId) => {
          const building = buildings.find(b => b.id === buildingId);
          if (building) {
            setDirectionsDestination(building);
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
    </div>
  );
}
