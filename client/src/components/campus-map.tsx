import { useEffect, useRef, useState } from "react";
import type { Building, RoutePhase } from "@shared/schema";
import { KIOSK_LOCATION } from "@shared/schema";
import { PHASE_COLORS } from "@shared/phase-colors";
import { trackEvent } from "@/lib/analytics-tracker";
import { AnalyticsEventType } from "@shared/analytics-schema";

import buildingIcon from '@assets/generated_images/Building_icon_green_background_3206ffb3.png';
import kioskIcon from '@assets/generated_images/You_are_Here_location_icon_294f7572.png';
import gateIcon from '@assets/generated_images/Gate_entrance_icon_green_b8dfb5ed.png';
import canteenIcon from '@assets/generated_images/Canteen_dining_icon_green_8cdb8c87.png';
import foodStallIcon from '@assets/generated_images/Food_stall_cart_icon_117edf54.png';
import libraryIcon from '@assets/generated_images/Library_books_icon_green_8639e524.png';
import studentLoungeIcon from '@assets/generated_images/Student_lounge_sofa_icon_91f45151.png';
import carParkingIcon from '@assets/generated_images/Car_parking_icon_green_15c240c8.png';
import motorcycleParkingIcon from '@assets/generated_images/Motorcycle_parking_icon_green_58dd1569.png';
import comfortRoomIcon from '@assets/generated_images/Restroom_comfort_room_icon_6cad7368.png';
import lectureHallIcon from '@assets/generated_images/Lecture_hall_classroom_icon_6a8a28ad.png';
import adminOfficeIcon from '@assets/generated_images/Administrative_office_briefcase_icon_1a31163b.png';
import dormitoryIcon from '@assets/generated_images/Dormitory_residence_hall_icon_0b08552a.png';
import clinicIcon from '@assets/generated_images/Health_clinic_medical_cross_2e3bb4e2.png';
import gymIcon from '@assets/generated_images/Gym_sports_dumbbell_icon_5be0961e.png';
import auditoriumIcon from '@assets/generated_images/Auditorium_theater_stage_icon_2f744312.png';
import laboratoryIcon from '@assets/generated_images/Laboratory_flask_test_tube_60e02462.png';
import facultyLoungeIcon from '@assets/generated_images/Faculty_lounge_coffee_mug_cc34405d.png';
import studyAreaIcon from '@assets/generated_images/Study_area_desk_lamp_de2acdc7.png';
import bookstoreIcon from '@assets/generated_images/Bookstore_book_price_tag_83e37414.png';
import atmIcon from '@assets/generated_images/ATM_cash_machine_icon_848adad9.png';
import chapelIcon from '@assets/generated_images/Chapel_prayer_room_cross_76e35c33.png';
import greenSpaceIcon from '@assets/generated_images/Green_space_tree_courtyard_d57ea32f.png';
import busStopIcon from '@assets/generated_images/Bus_stop_shuttle_icon_f080cef5.png';
import bikeParkingIcon from '@assets/generated_images/Bike_parking_bicycle_icon_9b6db414.png';
import securityOfficeIcon from '@assets/generated_images/Security_office_shield_badge_a19124a2.png';
import wasteStationIcon from '@assets/generated_images/Waste_recycling_station_icon_81c2fdf4.png';
import waterFountainIcon from '@assets/generated_images/Water_fountain_drinking_icon_690799ab.png';
import printCenterIcon from '@assets/generated_images/Print_copy_center_printer_7c56d319.png';
import otherIcon from '@assets/generated_images/Other_generic_question_mark_40bcf8cf.png';

interface PathType {
  id: string;
  name?: string;
  nodes: Array<{ lat: number; lng: number }>;
}

interface NavigationBuilding {
  id: string;
  name: string;
  lat: number;
  lng: number;
  polygon?: Array<{ lat: number; lng: number }> | null;
}

interface CampusMapProps {
  buildings?: Building[];
  onBuildingClick?: (building: Building) => void;
  selectedBuilding?: Building | null;
  routePolyline?: Array<{ lat: number; lng: number }>;
  routeMode?: 'walking' | 'driving' | 'accessible';
  routePhases?: RoutePhase[];
  parkingLocation?: Building | null;
  className?: string;
  onMapClick?: (lat: number, lng: number) => void;
  centerLat?: number;
  centerLng?: number;
  existingPaths?: PathType[];
  pathsColor?: string;
  hidePolygonsInNavigation?: boolean;
  waypointsData?: Array<{id: string; name: string; lat: number; lng: number}>;
  navigationStartBuilding?: NavigationBuilding | null;
  navigationEndBuilding?: NavigationBuilding | null;
  navigationParkingBuilding?: NavigationBuilding | null;
  navigationParkingBuildings?: NavigationBuilding[];
  navigationWaypointBuildings?: NavigationBuilding[];
  parkingSelectionMode?: boolean;
  parkingTypeFilter?: 'Car Parking' | 'Motorcycle Parking' | 'Bike Parking' | null;
  onParkingSelected?: (parking: Building) => void;
  highlightedParkingIds?: string[];
}

declare global {
  interface Window {
    L: any;
  }
}


const getMarkerIconImage = (poiType?: string | null) => {
  const iconMap: Record<string, string> = {
    'Building': buildingIcon,
    'Gate': gateIcon,
    'Canteen': canteenIcon,
    'Food Stall': foodStallIcon,
    'Library': libraryIcon,
    'Student Lounge': studentLoungeIcon,
    'Car Parking': carParkingIcon,
    'Motorcycle Parking': motorcycleParkingIcon,
    'Comfort Room': comfortRoomIcon,
    'Lecture Hall / Classroom': lectureHallIcon,
    'Administrative Office': adminOfficeIcon,
    'Residence Hall / Dormitory': dormitoryIcon,
    'Health Services / Clinic': clinicIcon,
    'Gym / Sports Facility': gymIcon,
    'Auditorium / Theater': auditoriumIcon,
    'Laboratory': laboratoryIcon,
    'Faculty Lounge / Staff Room': facultyLoungeIcon,
    'Study Area': studyAreaIcon,
    'Bookstore': bookstoreIcon,
    'ATM': atmIcon,
    'Chapel / Prayer Room': chapelIcon,
    'Green Space / Courtyard': greenSpaceIcon,
    'Bus Stop / Shuttle Stop': busStopIcon,
    'Bike Parking': bikeParkingIcon,
    'Security Office / Campus Police': securityOfficeIcon,
    'Waste / Recycling Station': wasteStationIcon,
    'Water Fountain': waterFountainIcon,
    'Kiosk': kioskIcon,
    'Print/Copy Center': printCenterIcon,
    'Other': otherIcon,
  };
  return iconMap[poiType || 'Building'] || buildingIcon;
};

const getMarkerIconSVG = (iconType?: string | null) => {
  const icons: Record<string, string> = {
    building: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>`,
    school: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"></path>`,
    hospital: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>`,
    store: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>`,
    home: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>`,
  };
  return icons[iconType || 'building'] || icons.building;
};

export default function CampusMap({
  buildings = [],
  onBuildingClick,
  selectedBuilding,
  routePolyline,
  routeMode,
  routePhases,
  parkingLocation,
  className = "h-full w-full",
  onMapClick,
  centerLat,
  centerLng,
  existingPaths = [],
  waypointsData = [],
  pathsColor = '#8b5cf6',
  hidePolygonsInNavigation = false,
  navigationStartBuilding,
  navigationEndBuilding,
  navigationParkingBuilding,
  navigationParkingBuildings = [],
  navigationWaypointBuildings = [],
  parkingSelectionMode = false,
  parkingTypeFilter = null,
  onParkingSelected,
  highlightedParkingIds = [],
  onPathClick
}: CampusMapProps & { onPathClick?: (path: any) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeLayerRef = useRef<any>(null);
  const routeMarkersRef = useRef<any[]>([]);
  const polygonsRef = useRef<any[]>([]);
  const navigationPolygonsRef = useRef<any[]>([]);
  const pathsLayerRef = useRef<any>(null);
  const [currentZoom, setCurrentZoom] = useState(17.5);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const container = mapRef.current;
    const stableCenter: [number, number] = [centerLat || 14.402870, centerLng || 120.8640];
    const stableZoom = 17.5;

    const mapLoadStart = performance.now();
    const L = window.L;
    if (!L) {
      console.error("Leaflet not loaded");
      return;
    }

    const map = L.map(container, {
      center: stableCenter,
      zoom: stableZoom,
      minZoom: 17.5,
      maxZoom: 21,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
      updateWhenIdle: false,
      updateWhenZooming: true,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
      inertia: false,
      renderer: L.canvas({
        padding: 1.5,
        tolerance: 5
      })
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 21,
      maxNativeZoom: 19,
      detectRetina: true,
      crossOrigin: true,
      updateWhenIdle: false,
      updateWhenZooming: true,
      keepBuffer: 8,
      updateInterval: 50
    }).addTo(map);

    mapInstanceRef.current = map;

    const recenter = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ animate: false, pan: false });
        mapInstanceRef.current.setView(stableCenter, stableZoom, { animate: false });
      }
    };

    recenter();
    const rafId = requestAnimationFrame(recenter);
    const t1 = setTimeout(recenter, 50);
    const t2 = setTimeout(recenter, 150);
    const t3 = setTimeout(recenter, 300);
    const t4 = setTimeout(recenter, 500);
    const t5 = setTimeout(recenter, 800);
    const t6 = setTimeout(() => {
      recenter();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.options.zoomAnimation = true;
      }
    }, 1000);

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    resizeObserver.observe(container);

    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);

    const mapLoadDuration = performance.now() - mapLoadStart;
    trackEvent(AnalyticsEventType.MAP_LOAD, Math.max(1, Math.round(mapLoadDuration)), {
      action: 'campus_map_loaded',
      buildingCount: buildings.length
    });

    const disableContextMenu = (e: Event) => {
      e.preventDefault();
      return false;
    };
    container.addEventListener('contextmenu', disableContextMenu);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      container.removeEventListener('contextmenu', disableContextMenu);
    };
  }, [centerLat, centerLng]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    const handleClick = (e: any) => {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    };

    map.on('click', handleClick);

    return () => {
      map.off('click', handleClick);
    };
  }, [onMapClick]);

  // Add campus boundary constraint (conditional on zoom level)
  // DELAYED to allow tiles to load first
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const L = window.L;
    const map = mapInstanceRef.current;

    // Define campus boundary (CCAT Campus, Cavite State University)
    // Calculated from actual campus buildings extent
    const campusBounds = L.latLngBounds(
      L.latLng(14.3985, 120.8635),  // Southwest corner
      L.latLng(14.4065, 120.8705)   // Northeast corner
    );

    const updateBoundsBasedOnZoom = () => {
      const zoom = map.getZoom();
      setCurrentZoom(zoom);
      
      // Campus center coordinates
      const centerLatVal = 14.4025;
      const centerLngVal = 120.8670;
      
      // Strict campus boundary (CCAT Campus, Cavite State University)
      // These coordinates tightly wrap the beige/yellow campus area
      const campusBounds = L.latLngBounds(
        L.latLng(14.3995, 120.8645),  // Southwest corner
        L.latLng(14.4055, 120.8695)   // Northeast corner
      );

      // Adjust padding based on zoom level
      // Higher zoom = stricter bounds to prevent panning away from buildings
      let padding = 0.004; // Default for zoom < 18
      
      if (zoom >= 20) {
        padding = 0.001; // Very strict at high zoom
      } else if (zoom >= 19) {
        padding = 0.002;
      } else if (zoom >= 18) {
        padding = 0.003;
      }
      
      const dynamicBounds = L.latLngBounds(
        L.latLng(centerLatVal - padding, centerLngVal - padding),
        L.latLng(centerLatVal + padding, centerLngVal + padding)
      );

      // Combine boundaries
      const finalBounds = dynamicBounds.extend(campusBounds);

      map.setMaxBounds(finalBounds);
    };

    // Restrict zoom levels to stay focused on campus
    map.setMinZoom(17.5);
    map.setMaxZoom(21);

    // CRITICAL: Delay bounds setup to allow tiles to render first
    // Reduced delay and made it more seamless
    const boundsTimeout = setTimeout(() => {
      updateBoundsBasedOnZoom();
      
      // Update bounds whenever zoom level changes
      map.on('zoomend', updateBoundsBasedOnZoom);
    }, 100);

    return () => {
      clearTimeout(boundsTimeout);
      map.off('zoomend', updateBoundsBasedOnZoom);
      map.setMaxBounds(null);
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    const defaultLat = 14.402870;
    const defaultLng = 120.8640;
    const lat = centerLat || defaultLat;
    const lng = centerLng || defaultLng;
    
    const currentCenter = mapInstanceRef.current.getCenter();
    const latDiff = Math.abs(currentCenter.lat - lat);
    const lngDiff = Math.abs(currentCenter.lng - lng);

    if (latDiff > 0.0001 || lngDiff > 0.0001) {
      mapInstanceRef.current.setView([lat, lng], 17.5, {
        animate: false
      });
    }
  }, [centerLat, centerLng]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;

    const L = window.L;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // When displaying a route (navigation mode), don't show building markers
    // to reduce clutter and make the pathway more visible
    const isNavigating = !!(routePolyline && routePolyline.length > 0) || !!(routePhases && routePhases.length > 0);
    
    // Adjust marker sizes based on zoom level
    // When zoomed out (< 18), use smaller sizes to prevent overcrowding
    // When zoomed in (>= 18), use normal sizes
    const isZoomedOut = currentZoom < 18;
    const isMaxZoom = currentZoom >= 21;
    
    // Check if we are in admin view (based on URL)
    const isAdminView = window.location.pathname.startsWith('/admin/');
    const showBuildingTooltips = isMaxZoom && !isAdminView;

    // Standardized sizes for better consistency
    // Even smaller sizes for zoomed out view to reduce overcrowding
    const kioskSize = isZoomedOut 
      ? { img: 'w-6 h-6', icon: 24, ping: 'w-4 h-4' } 
      : { img: 'w-10 h-10', icon: 40, ping: 'w-7 h-7' };
    const buildingSize = isZoomedOut 
      ? { img: 'w-5 h-5', icon: 20, ping: 'w-3 h-3' } 
      : { img: 'w-8 h-8', icon: 32, ping: 'w-6 h-6' };

    // Use a simpler approach for tooltip collision: only show one tooltip if markers are very close
    const tooltipOptions = {
      permanent: true,
      direction: 'top' as any,
      offset: [0, -(buildingSize.icon / 2)] as any,
      className: 'bg-card text-card-foreground px-2 py-1 rounded shadow-md border border-card-border text-[10px] font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px] pointer-events-none opacity-90'
    };

    // During navigation, don't show any markers - only route markers will be shown
    if (isNavigating) {
      // Skip marker rendering during navigation
    } else {
      // Find Kiosk building from database, fall back to constant if not found
      const kioskBuilding = buildings.find(b => b.type === 'Kiosk' || b.id === 'kiosk');
      const kioskLat = kioskBuilding?.lat ?? KIOSK_LOCATION.lat;
      const kioskLng = kioskBuilding?.lng ?? KIOSK_LOCATION.lng;
      const kioskName = kioskBuilding?.name ?? KIOSK_LOCATION.name;
      
      const kioskIconHtml = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute ${kioskSize.ping} bg-blue-500/30 rounded-full animate-ping"></div>
            <div class="relative">
              <img src="${kioskIcon}" alt="You are Here" class="${kioskSize.img} object-contain drop-shadow-lg" />
            </div>
          </div>
        `,
        className: 'kiosk-marker',
        iconSize: [kioskSize.icon, kioskSize.icon],
        iconAnchor: [kioskSize.icon / 2, kioskSize.icon / 2],
      });

      const kioskMarker = L.marker([kioskLat, kioskLng], { icon: kioskIconHtml })
        .addTo(mapInstanceRef.current);
        
      if (showBuildingTooltips) {
        kioskMarker.bindTooltip(kioskName, {
          ...tooltipOptions,
          className: 'bg-blue-600 text-white px-2 py-1 rounded shadow-md font-medium text-[10px] pointer-events-none opacity-90'
        });
      }

      markersRef.current.push(kioskMarker);

      // Only render building markers when NOT navigating
      buildings.forEach(building => {
        // Skip the Kiosk building since we render it separately with special styling
        if (building.type === 'Kiosk' || building.id === 'kiosk') {
          return;
        }
        // During parking selection mode, ONLY show matching parking markers
        // Hide all other building types to reduce clutter
        if (parkingSelectionMode && parkingTypeFilter) {
          if (building.type !== parkingTypeFilter) {
            return; // Skip non-parking buildings during parking selection
          }
        }
        
        const iconImage = getMarkerIconImage(building.type);
        
        // Check if this building should be highlighted for parking selection
        const isParkingMatch = parkingSelectionMode && parkingTypeFilter && building.type === parkingTypeFilter;
        const isHighlightedParking = highlightedParkingIds.includes(building.id) || isParkingMatch;
        
        // Determine marker styling based on selection state
        const highlightClass = isHighlightedParking ? 'ring-4 ring-yellow-400 ring-opacity-75' : '';
        const pulseClass = isParkingMatch ? 'animate-pulse' : '';
        const scaleClass = selectedBuilding?.id === building.id ? 'scale-125' : (isParkingMatch ? 'scale-110' : '');
        const pingColor = isParkingMatch ? 'bg-yellow-400/40' : 'bg-primary/20';
        
        const icon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center ${pulseClass}">
              <div class="absolute ${buildingSize.ping} ${pingColor} rounded-full animate-ping ${scaleClass}"></div>
              <div class="relative ${scaleClass} ${highlightClass} rounded-lg">
                <img src="${iconImage}" alt="${building.type || 'Building'}" class="${buildingSize.img} object-contain" />
              </div>
            </div>
          `,
          className: `building-marker ${isParkingMatch ? 'parking-selectable' : ''}`,
          iconSize: [buildingSize.icon, buildingSize.icon],
          iconAnchor: [buildingSize.icon / 2, buildingSize.icon / 2],
        });

        // Set high z-index for parking markers during selection mode to ensure visibility above polygons
        const markerZIndex = isParkingMatch ? 1000 : 0;
        
        const marker = L.marker([building.lat, building.lng], { 
          icon,
          zIndexOffset: markerZIndex
        })
          .addTo(mapInstanceRef.current);

        if (showBuildingTooltips) {
          marker.bindTooltip(building.name, tooltipOptions);
        }

        // Touchscreen-friendly interaction for kiosks
        const markerElement = marker.getElement();
        if (markerElement) {
          // Disable context menu on marker
          markerElement.addEventListener('contextmenu', (e: Event) => {
            e.preventDefault();
            return false;
          });

          // Long-press detection
          const handleTouchStart = (e: TouchEvent) => {
            // Only handle single touch
            if (e.touches.length > 1) return;
            
            isLongPressRef.current = false;
            
            // Set timer for long press (500ms)
            longPressTimerRef.current = setTimeout(() => {
              isLongPressRef.current = true;
              // Show tooltip on long press
              marker.openTooltip();
              // Vibrate if supported
              if (window.navigator.vibrate) {
                window.navigator.vibrate(50);
              }
            }, 500);
          };

          const handleTouchEnd = () => {
            // Clear the long press timer
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }

            // Hide tooltip when finger lifts
            if (isLongPressRef.current) {
              marker.closeTooltip();
              // Reset flag after a short delay to prevent click from firing
              setTimeout(() => {
                isLongPressRef.current = false;
              }, 100);
            }
          };

          const handleMouseDown = () => {
            isLongPressRef.current = false;
            longPressTimerRef.current = setTimeout(() => {
              isLongPressRef.current = true;
              marker.openTooltip();
            }, 500);
          };

          const handleMouseUp = () => {
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
            if (isLongPressRef.current) {
              marker.closeTooltip();
              setTimeout(() => {
                isLongPressRef.current = false;
              }, 100);
            }
          };

          markerElement.addEventListener('touchstart', handleTouchStart, { passive: true });
          markerElement.addEventListener('touchend', handleTouchEnd);
          markerElement.addEventListener('touchcancel', handleTouchEnd);
          markerElement.addEventListener('mousedown', handleMouseDown);
          markerElement.addEventListener('mouseup', handleMouseUp);
          markerElement.addEventListener('mouseleave', handleMouseUp);
        }

        // Handle click events - either for parking selection or regular building click
        marker.on('click', () => {
          // Only trigger click if it wasn't a long press
          if (!isLongPressRef.current) {
            // If in parking selection mode and this is a matching parking type
            if (parkingSelectionMode && parkingTypeFilter && building.type === parkingTypeFilter) {
              if (onParkingSelected) {
                onParkingSelected(building);
              }
            } else if (onBuildingClick) {
              onBuildingClick(building);
            }
          }
        });

        markersRef.current.push(marker);
      });
    }
  }, [buildings, onBuildingClick, selectedBuilding, currentZoom, routePolyline, routePhases, parkingSelectionMode, parkingTypeFilter, onParkingSelected, highlightedParkingIds]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;

    const L = window.L;

    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    routeMarkersRef.current.forEach(marker => marker.remove());
    routeMarkersRef.current = [];

    // Handle multi-phase routes (e.g., drive to parking + walk to destination)
    if (routePhases && routePhases.length > 0) {
      const layerGroup = L.layerGroup();
      const mergedPoints: Array<{ lat: number; lng: number }> = [];
      
      routePhases.forEach((phase, index) => {
        // Use the phase's assigned color (matches the badge color)
        const color = phase.color || PHASE_COLORS[index % PHASE_COLORS.length];
        let polylinePoints = [...phase.polyline];
        
        // Ensure seamless continuity by always connecting consecutive phases
        if (index > 0 && routePhases[index - 1].polyline.length > 0) {
          const prevLastPoint = routePhases[index - 1].polyline[routePhases[index - 1].polyline.length - 1];
          // Always prepend the connection point for visual continuity
          polylinePoints = [prevLastPoint, ...phase.polyline];
        }
        
        L.polyline(polylinePoints, {
          color: color,
          weight: 6,
          opacity: 0.8,
          smoothFactor: 1
        }).addTo(layerGroup);
        
        // Build merged points for bounds calculation (excluding duplicate connection points)
        if (index === 0) {
          mergedPoints.push(...polylinePoints);
        } else {
          // Skip the first point (connection) to avoid duplicates in mergedPoints
          mergedPoints.push(...polylinePoints.slice(1));
        }
      });
      
      layerGroup.addTo(mapInstanceRef.current);
      routeLayerRef.current = layerGroup;

      const allPoints = mergedPoints;
      
      if (allPoints.length > 1) {
        const startIcon = L.divIcon({
          html: `
            <div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path>
              </svg>
            </div>
          `,
          className: 'route-marker',
          iconSize: [40, 40],
          iconAnchor: [20, 40],
        });

        const endIcon = L.divIcon({
          html: `
            <div class="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path>
              </svg>
            </div>
          `,
          className: 'route-marker',
          iconSize: [40, 40],
          iconAnchor: [20, 40],
        });

        const startMarker = L.marker(allPoints[0], { icon: startIcon }).addTo(mapInstanceRef.current);
        const endMarker = L.marker(allPoints[allPoints.length - 1], { icon: endIcon }).addTo(mapInstanceRef.current);
        
        routeMarkersRef.current.push(startMarker, endMarker);

        // Render parking marker for driving modes (Car, Motorcycle, Bike)
        // The parking marker shows where to park before walking to destination
        if (parkingLocation && parkingLocation.lat && parkingLocation.lng) {
          const parkingIcon = L.divIcon({
            html: `
              <div class="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                <svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 3H6v18h4v-6h3c3.31 0 6-2.69 6-6s-2.69-6-6-6zm.2 8H10V7h3.2c1.1 0 2 .9 2 2s-.9 2-2 2z"/>
                </svg>
              </div>
            `,
            className: 'parking-marker',
            iconSize: [48, 48],
            iconAnchor: [24, 48],
          });
          const parkingMarker = L.marker([parkingLocation.lat, parkingLocation.lng], { icon: parkingIcon })
            .addTo(mapInstanceRef.current)
            .bindTooltip(parkingLocation.name || 'Parking Area', {
              permanent: false,
              direction: 'top',
              offset: [0, -24],
              className: 'bg-amber-600 text-white px-3 py-2 rounded-lg shadow-lg font-semibold'
            });
          routeMarkersRef.current.push(parkingMarker);
        }

        // Render waypoint markers (blue)
        if (waypointsData && waypointsData.length > 0) {
          waypointsData.forEach((waypoint) => {
            const waypointIcon = L.divIcon({
              html: `
                <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                  <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path>
                  </svg>
                </div>
              `,
              className: 'route-waypoint-marker',
              iconSize: [40, 40],
              iconAnchor: [20, 40],
            });
            const waypointMarker = L.marker({ lat: waypoint.lat, lng: waypoint.lng }, { icon: waypointIcon }).addTo(mapInstanceRef.current);
            routeMarkersRef.current.push(waypointMarker);
          });
        }

        const bounds = L.latLngBounds(allPoints);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 17.5 });
      }
    } else if (routePolyline && routePolyline.length > 0) {
      // Single-phase route (backward compatibility)
      const color = routeMode === 'driving' ? '#3b82f6' : '#22c55e';
      
      routeLayerRef.current = L.polyline(routePolyline, {
        color: color,
        weight: 6,
        opacity: 0.8,
        smoothFactor: 1
      }).addTo(mapInstanceRef.current);

      if (routePolyline.length > 1) {
        const startIcon = L.divIcon({
          html: `
            <div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path>
              </svg>
            </div>
          `,
          className: 'route-marker',
          iconSize: [40, 40],
          iconAnchor: [20, 40],
        });

        const endIcon = L.divIcon({
          html: `
            <div class="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path>
              </svg>
            </div>
          `,
          className: 'route-marker',
          iconSize: [40, 40],
          iconAnchor: [20, 40],
        });

        const startMarker = L.marker(routePolyline[0], { icon: startIcon }).addTo(mapInstanceRef.current);
        const endMarker = L.marker(routePolyline[routePolyline.length - 1], { icon: endIcon }).addTo(mapInstanceRef.current);
        
        routeMarkersRef.current.push(startMarker, endMarker);

        // Render waypoint markers (blue) for single-phase routes
        if (waypointsData && waypointsData.length > 0) {
          waypointsData.forEach((waypoint) => {
            const waypointIcon = L.divIcon({
              html: `
                <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                  <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path>
                  </svg>
                </div>
              `,
              className: 'route-waypoint-marker',
              iconSize: [40, 40],
              iconAnchor: [20, 40],
            });
            const waypointMarker = L.marker({ lat: waypoint.lat, lng: waypoint.lng }, { icon: waypointIcon }).addTo(mapInstanceRef.current);
            routeMarkersRef.current.push(waypointMarker);
          });
        }

        const bounds = L.latLngBounds(routePolyline);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 17.5 });
      }
    } else {
      const defaultLat = 14.402870;
      const defaultLng = 120.8640;
      const lat = centerLat || defaultLat;
      const lng = centerLng || defaultLng;
      
      mapInstanceRef.current.setView([lat, lng], 17.5, { animate: false });
    }
  }, [routePolyline, routeMode, routePhases, parkingLocation, centerLat, centerLng]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;

    const L = window.L;

    polygonsRef.current.forEach(polygon => polygon.remove());
    polygonsRef.current = [];

    // Don't render building polygons when in navigation mode
    if (hidePolygonsInNavigation) {
      return;
    }

    buildings.forEach(building => {
      // During parking selection mode, ONLY show matching parking polygons
      // Hide all other building polygons to reduce clutter
      if (parkingSelectionMode && parkingTypeFilter) {
        if (building.type !== parkingTypeFilter) {
          return; // Skip non-parking polygons during parking selection
        }
      }
      
      if (building.polygon && Array.isArray(building.polygon) && building.polygon.length > 2) {
        const latlngs = building.polygon.map((p: any) => [p.lat, p.lng]);
        
        // During parking selection, use yellow highlight for parking polygons
        const isParkingHighlighted = parkingSelectionMode && parkingTypeFilter && building.type === parkingTypeFilter;
        const polygonColor = isParkingHighlighted ? '#FACC15' : ((building as any).polygonColor || '#FACC15');
        const polygonOpacity = isParkingHighlighted ? 0.5 : ((building as any).polygonOpacity || 0.3);
        
        const polygon = L.polygon(latlngs, {
          color: polygonColor,
          fillColor: polygonColor,
          fillOpacity: polygonOpacity,
          weight: isParkingHighlighted ? 3 : 2,
          className: isParkingHighlighted ? 'parking-polygon-selectable' : ''
        }).addTo(mapInstanceRef.current);

        polygonsRef.current.push(polygon);
      }
    });
  }, [buildings, hidePolygonsInNavigation, parkingSelectionMode, parkingTypeFilter]);

  // Render navigation-specific building polygons with highlight colors
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;

    const L = window.L;

    // Clear previous navigation polygons
    navigationPolygonsRef.current.forEach(polygon => polygon.remove());
    navigationPolygonsRef.current = [];

    // Only render navigation polygons when we have navigation buildings
    const hasNavigationBuildings = navigationStartBuilding || navigationEndBuilding || 
                                   navigationParkingBuilding || navigationParkingBuildings.length > 0 ||
                                   navigationWaypointBuildings.length > 0;
    
    if (!hasNavigationBuildings) return;

    // Define highlight colors for different navigation points
    const NAVIGATION_COLORS = {
      start: '#22c55e',      // Green for start
      end: '#ef4444',        // Red for destination
      parking: '#3b82f6',    // Blue for parking
      waypoint: '#f59e0b'    // Amber/Orange for waypoints
    };

    // Helper function to render a navigation polygon
    const renderNavigationPolygon = (
      building: NavigationBuilding | null | undefined, 
      color: string,
      type: string
    ) => {
      if (!building?.polygon || !Array.isArray(building.polygon) || building.polygon.length < 3) {
        return;
      }

      const latlngs = building.polygon.map(p => [p.lat, p.lng]);
      const polygon = L.polygon(latlngs, {
        color: color,
        fillColor: color,
        fillOpacity: 0.35,
        weight: 3,
        className: `navigation-polygon navigation-${type}`
      }).addTo(mapInstanceRef.current);

      // Add a pulsing animation effect via CSS class
      const element = polygon.getElement();
      if (element) {
        element.classList.add('navigation-polygon-highlight');
      }

      navigationPolygonsRef.current.push(polygon);
    };

    // Render start building polygon (green)
    renderNavigationPolygon(navigationStartBuilding, NAVIGATION_COLORS.start, 'start');

    // Render end/destination building polygon (red) - always show even for accessible fallback
    renderNavigationPolygon(navigationEndBuilding, NAVIGATION_COLORS.end, 'end');

    // Render parking building polygon (blue) - for driving modes (single parking for backwards compatibility)
    renderNavigationPolygon(navigationParkingBuilding, NAVIGATION_COLORS.parking, 'parking');

    // Render ALL parking buildings from the array (for multi-phase routes with both origin and destination parking)
    navigationParkingBuildings.forEach((parking) => {
      renderNavigationPolygon(parking, NAVIGATION_COLORS.parking, 'parking');
    });

    // Render waypoint building polygons (amber/orange)
    navigationWaypointBuildings.forEach((waypoint) => {
      renderNavigationPolygon(waypoint, NAVIGATION_COLORS.waypoint, 'waypoint');
    });

    console.log('[CAMPUS-MAP] Rendered navigation polygons:', {
      start: !!navigationStartBuilding?.polygon,
      end: !!navigationEndBuilding?.polygon,
      parking: !!navigationParkingBuilding?.polygon,
      parkingBuildings: navigationParkingBuildings.filter(p => p?.polygon).length,
      waypoints: navigationWaypointBuildings.filter(w => w?.polygon).length
    });

  }, [navigationStartBuilding, navigationEndBuilding, navigationParkingBuilding, navigationParkingBuildings, navigationWaypointBuildings]);

  // Cleanup navigation polygons when navigation mode ends or when all navigation buildings are cleared
  useEffect(() => {
    const hasNavigationBuildings = navigationStartBuilding || navigationEndBuilding || 
                                   navigationParkingBuilding || navigationParkingBuildings.length > 0 ||
                                   navigationWaypointBuildings.length > 0;
    
    // Clean up when:
    // 1. No longer in navigation mode (hidePolygonsInNavigation becomes false), OR
    // 2. All navigation building props are null/empty (route was cleared while still on navigation page)
    if ((!hidePolygonsInNavigation || !hasNavigationBuildings) && navigationPolygonsRef.current.length > 0) {
      console.log('[CAMPUS-MAP] Cleaning up navigation polygons', { 
        hidePolygonsInNavigation, 
        hasNavigationBuildings,
        polygonCount: navigationPolygonsRef.current.length 
      });
      navigationPolygonsRef.current.forEach(polygon => {
        try {
          polygon.remove();
        } catch (e) {
          // Polygon may already be removed
        }
      });
      navigationPolygonsRef.current = [];
    }
  }, [hidePolygonsInNavigation, navigationStartBuilding, navigationEndBuilding, navigationParkingBuilding, navigationParkingBuildings, navigationWaypointBuildings]);

  // Render existing paths on the map
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L || !existingPaths || existingPaths.length === 0) {
      if (pathsLayerRef.current) {
        pathsLayerRef.current.remove();
        pathsLayerRef.current = null;
      }
      return;
    }

    const L = window.L;

    if (pathsLayerRef.current) {
      pathsLayerRef.current.remove();
      pathsLayerRef.current = null;
    }

    const layerGroup = L.layerGroup();

    existingPaths.forEach((path) => {
      if (path.nodes && Array.isArray(path.nodes) && path.nodes.length > 0) {
        const polyline = L.polyline(path.nodes, {
          color: pathsColor,
          weight: 4,
          opacity: 0.6,
          smoothFactor: 1,
          dashArray: '10, 10',
          interactive: !!onPathClick,
          className: onPathClick ? 'cursor-pointer' : ''
        });

        if (onPathClick) {
          polyline.on('click', (e: any) => {
            L.DomEvent.stopPropagation(e);
            onPathClick(path);
          });
          
          polyline.on('mouseover', () => {
            polyline.setStyle({ opacity: 1, weight: 6 });
          });
          polyline.on('mouseout', () => {
            polyline.setStyle({ opacity: 0.6, weight: 4 });
          });

          if (path.name) {
            polyline.bindTooltip(path.name, {
              sticky: true,
              direction: 'top',
              className: 'bg-card text-card-foreground px-2 py-1 rounded shadow-sm border border-card-border text-xs'
            });
          }
        }

        polyline.addTo(layerGroup);
      }
    });

    layerGroup.addTo(mapInstanceRef.current);
    pathsLayerRef.current = layerGroup;
  }, [existingPaths, pathsColor, onPathClick]);

  return <div ref={mapRef} className={className} data-testid="map-container" />;
}
