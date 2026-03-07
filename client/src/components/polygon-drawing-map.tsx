import { useEffect, useRef, useState } from "react";

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
  polygons?: LatLng[][] | null;
  onPolygonsChange: (polygons: LatLng[][] | null) => void;
  shadowPolygons?: LatLng[][] | null;
  onShadowPolygonsChange: (shadows: LatLng[][] | null) => void;
  polygonColor?: string;
  polygonOpacity?: number;
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
  shadowPolygons,
  onShadowPolygonsChange,
  polygonColor = "#FACC15",
  polygonOpacity = 0.4,
  className = "h-full w-full",
  existingBuildings = []
}: PolygonDrawingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const drawControlRef = useRef<any>(null);
  const areaLayersRef = useRef<any[]>([]);
  const shadowLayersRef = useRef<any[]>([]);
  const existingLayersRef = useRef<any[]>([]);
  const [mode, setMode] = useState<'area' | 'shadow'>('area');
  const modeRef = useRef<'area' | 'shadow'>('area');

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

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
      edit: { remove: false, edit: false }
    });

    map.addControl(drawControl);

    let resizeObserver: ResizeObserver | null = null;
    try {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      });
      resizeObserver.observe(mapRef.current!);
    } catch (e) {}

    map.invalidateSize();
    const handleResize = () => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); };
    window.addEventListener('resize', handleResize);
    requestAnimationFrame(() => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); });
    const timeoutId1 = setTimeout(() => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); }, 75);
    const timeoutId2 = setTimeout(() => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); }, 250);

    map.on(L.Draw.Event.CREATED, function (e: any) {
      const layer = e.layer;
      const latlngs = layer.getLatLngs()[0];
      const coords: LatLng[] = latlngs.map((ll: any) => ({ lat: ll.lat, lng: ll.lng }));

      if (modeRef.current === 'shadow') {
        const color = (mapInstanceRef.current as any)._currentColor || polygonColor;
        const shadowLayer = L.polygon(latlngs, {
          color,
          fillColor: color,
          fillOpacity: 1.0,
          weight: 2,
          opacity: 1.0
        });
        shadowLayer.addTo(map);
        shadowLayersRef.current.push(shadowLayer);

        const idx = shadowLayersRef.current.length - 1;
        addDeleteControl(map, L, shadowLayer, () => {
          shadowLayer.remove();
          shadowLayersRef.current.splice(idx, 1);
          const updated = shadowLayersRef.current.map(l => l.getLatLngs()[0].map((ll: any) => ({ lat: ll.lat, lng: ll.lng })));
          onShadowPolygonsChange(updated.length ? updated : null);
        });

        const updated = shadowLayersRef.current.map(l => l.getLatLngs()[0].map((ll: any) => ({ lat: ll.lat, lng: ll.lng })));
        onShadowPolygonsChange(updated);
      } else {
        const color = (mapInstanceRef.current as any)._currentColor || polygonColor;
        const opacity = (mapInstanceRef.current as any)._currentOpacity ?? polygonOpacity;
        const areaLayer = L.polygon(latlngs, {
          color,
          fillColor: color,
          fillOpacity: opacity,
          weight: 3
        });
        areaLayer.addTo(map);
        areaLayersRef.current.push(areaLayer);

        const idx = areaLayersRef.current.length - 1;
        addDeleteControl(map, L, areaLayer, () => {
          areaLayer.remove();
          areaLayersRef.current.splice(idx, 1);
          const updated = areaLayersRef.current.map(l => l.getLatLngs()[0].map((ll: any) => ({ lat: ll.lat, lng: ll.lng })));
          onPolygonsChange(updated.length ? updated : null);
        });

        const updated = areaLayersRef.current.map(l => l.getLatLngs()[0].map((ll: any) => ({ lat: ll.lat, lng: ll.lng })));
        onPolygonsChange(updated);
      }
    });

    const updateBoundsBasedOnZoom = () => {
      if (!mapInstanceRef.current) return;
      const m = mapInstanceRef.current;
      const zoom = m.getZoom();
      const campusBounds = L.latLngBounds(L.latLng(14.3995, 120.8645), L.latLng(14.4055, 120.8695));
      let padding = 0.004;
      if (zoom >= 20) padding = 0.001;
      else if (zoom >= 19) padding = 0.002;
      else if (zoom >= 18) padding = 0.003;
      const dynamicBounds = L.latLngBounds(L.latLng(14.4025 - padding, 120.8670 - padding), L.latLng(14.4025 + padding, 120.8670 + padding));
      m.setMaxBounds(dynamicBounds.extend(campusBounds));
    };

    mapInstanceRef.current = map;
    drawControlRef.current = drawControl;
    (map as any)._currentColor = polygonColor;
    (map as any)._currentOpacity = polygonOpacity;

    setTimeout(updateBoundsBasedOnZoom, 350);
    map.on('zoomend', updateBoundsBasedOnZoom);

    return () => {
      darkObserver.disconnect();
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  function addDeleteControl(map: any, L: any, layer: any, onDelete: () => void) {
    const center = layer.getBounds().getCenter();
    const icon = L.divIcon({
      html: `<button style="background:#ef4444;color:white;border:none;border-radius:50%;width:22px;height:22px;font-size:14px;line-height:22px;text-align:center;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.4);">×</button>`,
      className: '',
      iconAnchor: [11, 11]
    });
    const marker = L.marker(center, { icon, interactive: true, zIndexOffset: 1000 });
    marker.addTo(map);
    marker.on('click', () => {
      onDelete();
      marker.remove();
    });
    layer.on('remove', () => marker.remove());
  }

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    (mapInstanceRef.current as any)._currentColor = polygonColor;
    (mapInstanceRef.current as any)._currentOpacity = polygonOpacity;
  }, [polygonColor, polygonOpacity]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([centerLat || 14.4025, centerLng || 120.8670], 18.5);
  }, [centerLat, centerLng]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    const map = mapInstanceRef.current;

    existingLayersRef.current.forEach(l => l.remove());
    existingLayersRef.current = [];

    if (existingBuildings?.length > 0) {
      existingBuildings.forEach((building) => {
        if (building.polygon && Array.isArray(building.polygon) && building.polygon.length > 0) {
          const color = building.polygonColor || "#9CA3AF";
          const lyr = L.polygon(building.polygon.map((p: LatLng) => [p.lat, p.lng]), {
            color, fillColor: color, fillOpacity: 0.15, weight: 2, opacity: 0.5, dashArray: '5, 5', interactive: false
          }).addTo(map);
          existingLayersRef.current.push(lyr);
        }
      });
    }
  }, [existingBuildings]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    const map = mapInstanceRef.current;

    areaLayersRef.current.forEach(l => l.remove());
    areaLayersRef.current = [];

    (polygons || []).forEach((poly, i) => {
      if (!poly?.length) return;
      const lyr = L.polygon(poly.map(p => [p.lat, p.lng]), {
        color: polygonColor,
        fillColor: polygonColor,
        fillOpacity: polygonOpacity,
        weight: 3
      }).addTo(map);
      areaLayersRef.current.push(lyr);

      addDeleteControl(map, L, lyr, () => {
        lyr.remove();
        areaLayersRef.current.splice(areaLayersRef.current.indexOf(lyr), 1);
        const updated = areaLayersRef.current.map(l => l.getLatLngs()[0].map((ll: any) => ({ lat: ll.lat, lng: ll.lng })));
        onPolygonsChange(updated.length ? updated : null);
      });
    });
  }, [polygons, polygonColor, polygonOpacity]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    const map = mapInstanceRef.current;

    shadowLayersRef.current.forEach(l => l.remove());
    shadowLayersRef.current = [];

    (shadowPolygons || []).forEach((poly) => {
      if (!poly?.length) return;
      const lyr = L.polygon(poly.map(p => [p.lat, p.lng]), {
        color: polygonColor,
        fillColor: polygonColor,
        fillOpacity: 1.0,
        weight: 2,
        opacity: 1.0
      }).addTo(map);
      shadowLayersRef.current.push(lyr);

      addDeleteControl(map, L, lyr, () => {
        lyr.remove();
        shadowLayersRef.current.splice(shadowLayersRef.current.indexOf(lyr), 1);
        const updated = shadowLayersRef.current.map(l => l.getLatLngs()[0].map((ll: any) => ({ lat: ll.lat, lng: ll.lng })));
        onShadowPolygonsChange(updated.length ? updated : null);
      });
    });
  }, [shadowPolygons, polygonColor]);

  return (
    <div className="flex flex-col gap-0">
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => setMode('area')}
          data-testid="button-mode-area"
          className={`flex-1 px-3 py-1.5 text-sm rounded font-medium border transition-colors ${mode === 'area' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:bg-accent'}`}
        >
          + Add Area Shape
        </button>
        <button
          type="button"
          onClick={() => setMode('shadow')}
          data-testid="button-mode-shadow"
          className={`flex-1 px-3 py-1.5 text-sm rounded font-medium border transition-colors ${mode === 'shadow' ? 'bg-zinc-800 text-white border-zinc-700 dark:bg-zinc-600' : 'bg-muted text-muted-foreground border-border hover:bg-accent'}`}
        >
          + Add Shadow Shape
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        {mode === 'area'
          ? 'Drawing area shapes (semi-transparent). Use the polygon/rectangle tool on the map.'
          : 'Drawing shadow shapes (fully opaque — darker look for the emboss effect). Trace the building\'s shadow area.'}
      </p>
      <div ref={mapRef} className={className} data-testid="polygon-drawing-map" />
    </div>
  );
}
