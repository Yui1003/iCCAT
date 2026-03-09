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
  const onPolygonsChangeRef = useRef(onPolygonsChange);
  const polygonColorRef = useRef(polygonColor);

  useEffect(() => { onPolygonsChangeRef.current = onPolygonsChange; }, [onPolygonsChange]);
  useEffect(() => { polygonColorRef.current = polygonColor; }, [polygonColor]);

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
      subdomains: 'abc', maxZoom: 21, maxNativeZoom: 19,
      crossOrigin: true, detectRetina: true, updateWhenIdle: false, updateWhenZooming: true, keepBuffer: 4,
    });
    const darkTile = L.tileLayer(`https://{s}.tile.thunderforest.com/transport-dark/{z}/{x}/{y}.png?apikey=${tfKey}`, {
      attribution: osmAttrib + ' © <a href="https://www.thunderforest.com/">Thunderforest</a>',
      subdomains: 'abc', maxZoom: 21, maxNativeZoom: 19,
      crossOrigin: true, detectRetina: true, updateWhenIdle: false, updateWhenZooming: true, keepBuffer: 4,
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

    // ─── OSM-style Custom Vertex Editor ────────────────────────────────────────
    let editMode = false;
    let editLayerGroup: any = null;
    let editPolygonLayers: any[] = [];

    // Vertex marker: solid blue circle using divIcon so L.marker draggable works
    function makeVertexIcon() {
      return L.divIcon({
        html: '<div style="width:14px;height:14px;border-radius:50%;background:#3b82f6;border:2px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,.5);cursor:grab;box-sizing:border-box;pointer-events:auto;"></div>',
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
    }

    // Midpoint marker: smaller semi-transparent circle shown between vertices
    function makeMidpointIcon() {
      return L.divIcon({
        html: '<div style="width:10px;height:10px;border-radius:50%;background:rgba(59,130,246,0.55);border:1.5px solid #ffffff;box-shadow:0 1px 3px rgba(0,0,0,.3);cursor:copy;box-sizing:border-box;pointer-events:auto;"></div>',
        className: '',
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });
    }

    // Returns rings as [[L.LatLng, ...], ...] always
    function getPolygonLatLngs(layer: any): any[][] {
      const raw = layer.getLatLngs();
      if (Array.isArray(raw[0]) || (raw[0] && raw[0].lat === undefined)) {
        return raw;
      }
      return [raw];
    }

    function destroyEditUI() {
      if (editLayerGroup) {
        editLayerGroup.clearLayers();
        map.removeLayer(editLayerGroup);
        editLayerGroup = null;
      }
    }

    function buildEditUI() {
      destroyEditUI();
      if (!editMode) return;

      editLayerGroup = L.layerGroup().addTo(map);

      editPolygonLayers.forEach((polygonLayer: any) => {
        const rings = getPolygonLatLngs(polygonLayer);

        rings.forEach((ring: any[], ringIndex: number) => {
          const n = ring.length;

          // ── Midpoint markers — clicking inserts a new vertex ──────────────
          for (let i = 0; i < n; i++) {
            const a = ring[i];
            const b = ring[(i + 1) % n];
            const midLat = (a.lat + b.lat) / 2;
            const midLng = (a.lng + b.lng) / 2;

            const midMarker = L.marker([midLat, midLng], {
              icon: makeMidpointIcon(),
              draggable: false,
              zIndexOffset: 100,
              bubblingMouseEvents: false,
            });

            const capturedI = i;
            const capturedMidLat = midLat;
            const capturedMidLng = midLng;

            midMarker.on('click', (e: any) => {
              L.DomEvent.stopPropagation(e);
              const currentRings = getPolygonLatLngs(polygonLayer);
              // Deep-copy rings so we don't mutate Leaflet's internal reference
              const newRings = currentRings.map((r: any[]) => [...r]);
              newRings[ringIndex].splice(capturedI + 1, 0, L.latLng(capturedMidLat, capturedMidLng));
              polygonLayer.setLatLngs(newRings);
              polygonLayer.redraw();
              buildEditUI();
              emitChange();
            });

            editLayerGroup.addLayer(midMarker);
          }

          // ── Draggable vertex markers ──────────────────────────────────────
          ring.forEach((latlng: any, vIdx: number) => {
            const marker = L.marker([latlng.lat, latlng.lng], {
              icon: makeVertexIcon(),
              draggable: true,       // Leaflet handles all mouse/touch drag internally
              zIndexOffset: 200,
              autoPanOnFocus: false,
              bubblingMouseEvents: false,
            });

            // Reshape polygon in real time as the marker is dragged
            marker.on('drag', () => {
              const newLatLng = marker.getLatLng();
              const currentRings = getPolygonLatLngs(polygonLayer);
              const newRings = currentRings.map((r: any[]) => [...r]);
              newRings[ringIndex][vIdx] = newLatLng;
              polygonLayer.setLatLngs(newRings);
              polygonLayer.redraw();
            });

            // Rebuild midpoint markers at updated positions after drag ends
            marker.on('dragend', () => {
              buildEditUI();
              emitChange();
            });

            // Right-click / two-finger tap to delete vertex (min 3 kept)
            marker.on('contextmenu', (e: any) => {
              L.DomEvent.stopPropagation(e);
              const currentRings = getPolygonLatLngs(polygonLayer);
              if (currentRings[ringIndex].length <= 3) return;
              const newRings = currentRings.map((r: any[]) => [...r]);
              newRings[ringIndex].splice(vIdx, 1);
              polygonLayer.setLatLngs(newRings);
              polygonLayer.redraw();
              buildEditUI();
              emitChange();
            });

            editLayerGroup.addLayer(marker);
          });
        });
      });
    }

    function emitChange() {
      const result: LatLng[][] = [];
      drawnItems.eachLayer((layer: any) => {
        const latlngsRaw = layer.getLatLngs();
        const ring = Array.isArray(latlngsRaw[0]) ? latlngsRaw[0] : latlngsRaw;
        result.push(ring.map((ll: any) => ({ lat: ll.lat, lng: ll.lng })));
      });
      onPolygonsChangeRef.current(result.length > 0 ? result : null);
    }

    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: {
            color: polygonColorRef.current,
            fillColor: polygonColorRef.current,
            fillOpacity: 0.4,
            weight: 3
          },
          drawError: { color: '#ef4444', message: 'Drawing error!' }
        },
        polyline: false,
        circle: false,
        circlemarker: false,
        marker: false,
        rectangle: {
          shapeOptions: {
            color: polygonColorRef.current,
            fillColor: polygonColorRef.current,
            fillOpacity: 0.4,
            weight: 3
          }
        }
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
        edit: false,  // disabled — we use the custom editor above
      }
    });

    map.addControl(drawControl);

    // ── Custom Edit toggle button injected into Leaflet.Draw toolbar ─────────
    const injectEditButton = () => {
      const toolbar = mapRef.current?.querySelector('.leaflet-draw-toolbar') as HTMLElement | null;
      if (!toolbar) return;
      if (toolbar.querySelector('.custom-edit-btn')) return;

      const editBtn = document.createElement('a');
      editBtn.href = '#';
      editBtn.className = 'custom-edit-btn leaflet-draw-edit-edit';
      editBtn.title = 'Edit shapes';
      editBtn.setAttribute('role', 'button');
      editBtn.style.cssText = 'display:block;';

      editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (editMode) {
          editMode = false;
          editPolygonLayers = [];
          destroyEditUI();
          editBtn.classList.remove('leaflet-draw-toolbar-button-enabled');
          emitChange();
        } else {
          editMode = true;
          editPolygonLayers = [];
          drawnItems.eachLayer((layer: any) => {
            editPolygonLayers.push(layer);
          });
          if (editPolygonLayers.length === 0) return;
          editBtn.classList.add('leaflet-draw-toolbar-button-enabled');
          buildEditUI();
        }
      });

      toolbar.insertBefore(editBtn, toolbar.firstChild);
    };

    setTimeout(injectEditButton, 300);

    const extractPolygons = (): LatLng[][] => {
      const result: LatLng[][] = [];
      drawnItems.eachLayer((layer: any) => {
        const latlngsRaw = layer.getLatLngs();
        const ring = Array.isArray(latlngsRaw[0]) ? latlngsRaw[0] : latlngsRaw;
        result.push(ring.map((ll: any) => ({ lat: ll.lat, lng: ll.lng })));
      });
      return result;
    };

    let resizeObserver: ResizeObserver | null = null;
    try {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      });
      resizeObserver.observe(mapRef.current!);
    } catch (e) { console.error("ResizeObserver not supported"); }

    map.invalidateSize();
    const handleResize = () => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); };
    window.addEventListener('resize', handleResize);
    requestAnimationFrame(() => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); });
    const tid1 = setTimeout(() => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); }, 75);
    const tid2 = setTimeout(() => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); }, 250);

    map.on(L.Draw.Event.CREATED, (e: any) => {
      const layer = e.layer;
      drawnItems.addLayer(layer);
      const all = extractPolygons();
      onPolygonsChangeRef.current(all.length > 0 ? all : null);
    });

    map.on(L.Draw.Event.DELETED, () => {
      if (editMode) {
        editMode = false;
        editPolygonLayers = [];
        destroyEditUI();
      }
      const all = extractPolygons();
      onPolygonsChangeRef.current(all.length > 0 ? all : null);
    });

    const updateBoundsBasedOnZoom = () => {
      if (!mapInstanceRef.current) return;
      const m = mapInstanceRef.current;
      const zoom = m.getZoom();
      const centerLatVal = 14.4025;
      const centerLngVal = 120.8670;
      const campusBounds = L.latLngBounds(L.latLng(14.3995, 120.8645), L.latLng(14.4055, 120.8695));
      let padding = 0.004;
      if (zoom >= 20) padding = 0.001;
      else if (zoom >= 19) padding = 0.002;
      else if (zoom >= 18) padding = 0.003;
      const dynamicBounds = L.latLngBounds(
        L.latLng(centerLatVal - padding, centerLngVal - padding),
        L.latLng(centerLatVal + padding, centerLngVal + padding)
      );
      m.setMaxBounds(dynamicBounds.extend(campusBounds));
    };

    mapInstanceRef.current = map;
    drawnItemsRef.current = drawnItems;
    drawControlRef.current = drawControl;

    setTimeout(updateBoundsBasedOnZoom, 350);
    map.on('zoomend', updateBoundsBasedOnZoom);

    return () => {
      darkObserver.disconnect();
      clearTimeout(tid1);
      clearTimeout(tid2);
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

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

    if (existingBuildings && existingBuildings.length > 0) {
      existingBuildings.forEach((building) => {
        const buildingColor = building.polygonColor || "#9CA3AF";
        const refStyle = {
          color: buildingColor, fillColor: buildingColor, fillOpacity: 0.15,
          weight: 2, opacity: 0.5, dashArray: '5, 5', interactive: false
        };
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
