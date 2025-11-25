import { useEffect, useRef } from "react";

interface LatLng {
  lat: number;
  lng: number;
}

interface Building {
  id: string;
  name: string;
  lat: number;
  lng: number;
  polygon?: LatLng[] | null;
  polygonColor?: string;
}

interface PolygonDrawingMapProps {
  centerLat: number;
  centerLng: number;
  polygon?: LatLng[] | null;
  onPolygonChange: (polygon: LatLng[] | null) => void;
  polygonColor?: string;
  className?: string;
  existingBuildings?: Building[];
}

declare global {
  interface Window {
    L: any;
  }
}

export default function PolygonDrawingMap({
  centerLat,
  centerLng,
  polygon,
  onPolygonChange,
  polygonColor = "#FACC15",
  className = "h-full w-full",
  existingBuildings = []
}: PolygonDrawingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const drawnItemsRef = useRef<any>(null);
  const drawControlRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const L = window.L;
    if (!L) {
      console.error("Leaflet not loaded");
      return;
    }

    const map = L.map(mapRef.current, {
      center: [centerLat, centerLng],
      zoom: 18,
      minZoom: 17,
      maxZoom: 21,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 21,
      maxNativeZoom: 19,
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    drawnItems.addTo(map);

    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: {
            color: polygonColor,
            fillColor: polygonColor,
            fillOpacity: 0.4,
            weight: 3
          },
          drawError: {
            color: '#ef4444',
            message: 'Drawing error!'
          }
        },
        polyline: false,
        circle: false,
        circlemarker: false,
        marker: false,
        rectangle: {
          shapeOptions: {
            color: polygonColor,
            fillColor: polygonColor,
            fillOpacity: 0.4,
            weight: 3
          }
        }
      },
      edit: {
        featureGroup: drawnItems,
        remove: true
      }
    });

    map.addControl(drawControl);

    // Optimize tile loading with same pattern as campus-map
    // Use ResizeObserver to handle dialog/container resize events
    let resizeObserver: ResizeObserver | null = null;
    try {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapRef.current);
    } catch (e) {
      console.error("ResizeObserver not supported");
    }

    // Invalidate size on initial load
    map.invalidateSize();

    // Also handle window resize
    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    
    window.addEventListener('resize', handleResize);

    // Use requestAnimationFrame for immediate next paint
    requestAnimationFrame(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    // Trigger invalidateSize after minimal delays for fast tile rendering
    const timeoutId1 = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 75);

    const timeoutId2 = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);

    map.on(L.Draw.Event.CREATED, function (e: any) {
      const layer = e.layer;
      drawnItems.clearLayers();
      drawnItems.addLayer(layer);
      
      const latlngs = layer.getLatLngs()[0];
      const polygonCoords = latlngs.map((ll: any) => ({
        lat: ll.lat,
        lng: ll.lng
      }));
      
      onPolygonChange(polygonCoords);
    });

    map.on(L.Draw.Event.EDITED, function (e: any) {
      const layers = e.layers;
      layers.eachLayer((layer: any) => {
        const latlngs = layer.getLatLngs()[0];
        const polygonCoords = latlngs.map((ll: any) => ({
          lat: ll.lat,
          lng: ll.lng
        }));
        
        onPolygonChange(polygonCoords);
      });
    });

    map.on(L.Draw.Event.DELETED, function () {
      onPolygonChange(null);
    });

    mapInstanceRef.current = map;
    drawnItemsRef.current = drawnItems;
    drawControlRef.current = drawControl;

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [polygonColor]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    
    mapInstanceRef.current.setView([centerLat, centerLng], 18);
  }, [centerLat, centerLng]);

  useEffect(() => {
    if (!mapInstanceRef.current || !drawnItemsRef.current || !window.L) return;

    const L = window.L;
    drawnItemsRef.current.clearLayers();

    // Render other existing building polygons as non-clickable (for reference)
    if (existingBuildings && existingBuildings.length > 0) {
      existingBuildings.forEach((building) => {
        if (building.polygon && Array.isArray(building.polygon) && building.polygon.length > 0) {
          const buildingColor = building.polygonColor || "#9CA3AF";
          const polygonLatLngs = building.polygon.map(p => [p.lat, p.lng]);
          
          L.polygon(polygonLatLngs, {
            color: buildingColor,
            fillColor: buildingColor,
            fillOpacity: 0.15,
            weight: 2,
            opacity: 0.5,
            dashArray: '5, 5',
            interactive: false
          }).addTo(mapInstanceRef.current);
        }
      });
    }

    if (polygon && polygon.length > 0) {
      const latlngs = polygon.map((p: LatLng) => [p.lat, p.lng]);
      const polygonLayer = L.polygon(latlngs, {
        color: polygonColor,
        fillColor: polygonColor,
        fillOpacity: 0.4,
        weight: 3
      });
      
      drawnItemsRef.current.addLayer(polygonLayer);
    }
  }, [polygon, polygonColor, existingBuildings]);

  return <div ref={mapRef} className={className} data-testid="polygon-drawing-map" />;
}
