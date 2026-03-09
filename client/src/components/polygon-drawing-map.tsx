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
  polygons?: LatLng[][] | null;
  polygonColor?: string;
}

interface PolygonDrawingMapProps {
  centerLat: number;
  centerLng: number;
  polygons?: LatLng[][] | null;
  onPolygonsChange: (polygons: LatLng[][] | null) => void;
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
  polygons,
  onPolygonsChange,
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
      center: [centerLat || 14.4025, centerLng || 120.8670],
      zoom: 18.5,
      minZoom: 17.5,
      maxZoom: 21,
      zoomControl: true,
      attributionControl: true,
    });

    const isDark = () => document.documentElement.classList.contains('dark');
    const osmAttrib = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    const tfKey = import.meta.env.VITE_THUNDERFOREST_API_KEY || '';
    const lightTile = L.tileLayer(`https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=${tfKey}`, {
      attribution: osmAttrib + ' © <a href="https://www.thunderforest.com/">Thunderforest</a>',
      subdomains: 'abc',
      maxZoom: 21,
      maxNativeZoom: 19,
      crossOrigin: true,
      detectRetina: true,
      updateWhenIdle: false,
      updateWhenZooming: true,
      keepBuffer: 4,
    });
    const darkTile = L.tileLayer(`https://{s}.tile.thunderforest.com/transport-dark/{z}/{x}/{y}.png?apikey=${tfKey}`, {
      attribution: osmAttrib + ' © <a href="https://www.thunderforest.com/">Thunderforest</a>',
      subdomains: 'abc',
      maxZoom: 21,
      maxNativeZoom: 19,
      crossOrigin: true,
      detectRetina: true,
      updateWhenIdle: false,
      updateWhenZooming: true,
      keepBuffer: 4,
    });
    let activeTile = isDark() ? darkTile : lightTile;
    activeTile.addTo(map);
    const applyDarkMap = () => {
      const next = isDark() ? darkTile : lightTile;
      if (next !== activeTile) { map.removeLayer(activeTile); next.addTo(map); activeTile = next; }
    };
    const darkObserver = new MutationObserver(applyDarkMap);
    darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

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
        remove: true,
        poly: {
          allowIntersection: false
        }
      }
    });

    map.addControl(drawControl);

    // Helper: extract all polygons from drawnItems feature group
    const extractPolygons = (): LatLng[][] => {
      const result: LatLng[][] = [];
      drawnItems.eachLayer((layer: any) => {
        const latlngsRaw = layer.getLatLngs();
        // Polygons return [[pt, pt, ...]], rectangles return [[pt, pt, ...]]
        const ring = Array.isArray(latlngsRaw[0]) ? latlngsRaw[0] : latlngsRaw;
        result.push(ring.map((ll: any) => ({ lat: ll.lat, lng: ll.lng })));
      });
      return result;
    };

    // Optimize tile loading with same pattern as campus-map
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

    map.invalidateSize();

    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);

    requestAnimationFrame(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

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

    // CREATED: add new shape to the existing set (don't clear)
    map.on(L.Draw.Event.CREATED, function (e: any) {
      const layer = e.layer;
      drawnItems.addLayer(layer);
      const all = extractPolygons();
      onPolygonsChange(all.length > 0 ? all : null);
    });

    // EDITED: rebuild from all remaining layers
    map.on(L.Draw.Event.EDITED, function () {
      const all = extractPolygons();
      onPolygonsChange(all.length > 0 ? all : null);
    });

    // DELETED: rebuild from remaining layers
    map.on(L.Draw.Event.DELETED, function () {
      const all = extractPolygons();
      onPolygonsChange(all.length > 0 ? all : null);
    });

    const updateBoundsBasedOnZoom = () => {
      if (!mapInstanceRef.current) return;
      const map = mapInstanceRef.current;
      const zoom = map.getZoom();
      const L = window.L;

      const centerLatVal = 14.4025;
      const centerLngVal = 120.8670;

      const campusBounds = L.latLngBounds(
        L.latLng(14.3995, 120.8645),
        L.latLng(14.4055, 120.8695)
      );

      let padding = 0.004;
      if (zoom >= 20) padding = 0.001;
      else if (zoom >= 19) padding = 0.002;
      else if (zoom >= 18) padding = 0.003;

      const dynamicBounds = L.latLngBounds(
        L.latLng(centerLatVal - padding, centerLngVal - padding),
        L.latLng(centerLatVal + padding, centerLngVal + padding)
      );
      map.setMaxBounds(dynamicBounds.extend(campusBounds));
    };

    mapInstanceRef.current = map;
    drawnItemsRef.current = drawnItems;
    drawControlRef.current = drawControl;

    setTimeout(updateBoundsBasedOnZoom, 350);
    map.on('zoomend', updateBoundsBasedOnZoom);

    return () => {
      darkObserver.disconnect();
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
    const lat = centerLat || 14.4025;
    const lng = centerLng || 120.8670;
    mapInstanceRef.current.setView([lat, lng], 18.5);
  }, [centerLat, centerLng]);

  useEffect(() => {
    if (!mapInstanceRef.current || !drawnItemsRef.current || !window.L) return;

    const L = window.L;
    drawnItemsRef.current.clearLayers();

    // Render other existing building polygons as non-clickable reference layers
    if (existingBuildings && existingBuildings.length > 0) {
      existingBuildings.forEach((building) => {
        const buildingColor = building.polygonColor || "#9CA3AF";
        const refStyle = {
          color: buildingColor,
          fillColor: buildingColor,
          fillOpacity: 0.15,
          weight: 2,
          opacity: 0.5,
          dashArray: '5, 5',
          interactive: false
        };

        // Support new multi-polygon format
        if (building.polygons && Array.isArray(building.polygons) && building.polygons.length > 0) {
          building.polygons.forEach((poly: LatLng[]) => {
            if (poly && poly.length > 0) {
              L.polygon(poly.map(p => [p.lat, p.lng]), refStyle).addTo(mapInstanceRef.current);
            }
          });
        } else if (building.polygon && Array.isArray(building.polygon) && building.polygon.length > 0) {
          L.polygon(building.polygon.map(p => [p.lat, p.lng]), refStyle).addTo(mapInstanceRef.current);
        }
      });
    }

    // Load each polygon in the polygons array as its own editable layer
    if (polygons && polygons.length > 0) {
      polygons.forEach((poly) => {
        if (poly && poly.length > 0) {
          const latlngs = poly.map((p: LatLng) => [p.lat, p.lng]);
          const polygonLayer = L.polygon(latlngs, {
            color: polygonColor,
            fillColor: polygonColor,
            fillOpacity: 0.4,
            weight: 3
          });
          drawnItemsRef.current.addLayer(polygonLayer);
        }
      });
    }
  }, [polygons, polygonColor, existingBuildings]);

  return <div ref={mapRef} className={className} data-testid="polygon-drawing-map" />;
}
