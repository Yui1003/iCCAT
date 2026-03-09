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

  // Keep refs updated without re-running the main effect
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
    // State for the custom editor
    let editMode = false;
    let editLayerGroup: any = null;  // L.LayerGroup holding vertex markers & edge clickables
    let editPolygonLayers: any[] = []; // The actual polygon layers being edited

    const VERTEX_STYLE = {
      radius: 6,
      color: '#ffffff',
      weight: 2,
      fillColor: '#3b82f6',
      fillOpacity: 1,
      interactive: true,
      bubblingMouseEvents: false,
    };

    function getPolygonLatLngs(layer: any): any[][] {
      const raw = layer.getLatLngs();
      // Polygon returns [[latlng, ...]] for simple polygons
      if (Array.isArray(raw[0]) || (raw[0] && raw[0].lat === undefined)) {
        return raw;
      }
      return [raw];
    }

    function setPolygonLatLngs(layer: any, rings: any[][]): void {
      layer.setLatLngs(rings);
      layer.redraw();
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

          // ── Edge clickable lines (transparent, thick — capture edge clicks) ──
          for (let i = 0; i < n; i++) {
            const a = ring[i];
            const b = ring[(i + 1) % n];
            const edgeLine = L.polyline([a, b], {
              color: 'transparent',
              weight: 12,
              opacity: 0,
              interactive: true,
              bubblingMouseEvents: false,
            });

            // Capture the indices at creation time
            const iIdx = i;
            edgeLine.on('click', (e: any) => {
              L.DomEvent.stopPropagation(e);
              // Insert new vertex between i and i+1 at the clicked point
              const newLatLng = e.latlng;
              const currentRings = getPolygonLatLngs(polygonLayer);
              const currentRing = currentRings[ringIndex];
              currentRing.splice(iIdx + 1, 0, newLatLng);
              setPolygonLatLngs(polygonLayer, currentRings);
              buildEditUI(); // Rebuild with new vertex
            });

            editLayerGroup.addLayer(edgeLine);
          }

          // ── Vertex markers ──────────────────────────────────────────────────
          ring.forEach((latlng: any, vIdx: number) => {
            const marker = L.circleMarker(latlng, { ...VERTEX_STYLE });

            let dragging = false;
            let startLatLng: any = null;
            let markerStartPos: any = null;

            const onMouseDown = (e: any) => {
              L.DomEvent.stopPropagation(e);
              dragging = true;
              startLatLng = e.latlng;
              markerStartPos = marker.getLatLng();
              map.dragging.disable();

              const onMouseMove = (moveEvt: any) => {
                if (!dragging) return;
                const newPos = moveEvt.latlng;
                marker.setLatLng(newPos);
                // Update polygon ring in place
                const currentRings = getPolygonLatLngs(polygonLayer);
                currentRings[ringIndex][vIdx] = newPos;
                setPolygonLatLngs(polygonLayer, currentRings);
              };

              const onMouseUp = () => {
                if (!dragging) return;
                dragging = false;
                map.dragging.enable();
                map.off('mousemove', onMouseMove);
                map.off('mouseup', onMouseUp);
                // Rebuild UI after drag ends to re-sync edge positions
                buildEditUI();
                // Emit change
                emitChange();
              };

              map.on('mousemove', onMouseMove);
              map.on('mouseup', onMouseUp);
            };

            // Touch support
            const onTouchStart = (e: any) => {
              L.DomEvent.stopPropagation(e);
              dragging = true;
              map.dragging.disable();

              const onTouchMove = (moveEvt: any) => {
                if (!dragging) return;
                const touch = moveEvt.originalEvent?.touches?.[0];
                if (!touch) return;
                const newPos = map.containerPointToLatLng(
                  L.point(touch.clientX - map.getContainer().getBoundingClientRect().left,
                           touch.clientY - map.getContainer().getBoundingClientRect().top)
                );
                marker.setLatLng(newPos);
                const currentRings = getPolygonLatLngs(polygonLayer);
                currentRings[ringIndex][vIdx] = newPos;
                setPolygonLatLngs(polygonLayer, currentRings);
              };

              const onTouchEnd = () => {
                if (!dragging) return;
                dragging = false;
                map.dragging.enable();
                map.off('touchmove', onTouchMove);
                map.off('touchend', onTouchEnd);
                buildEditUI();
                emitChange();
              };

              map.on('touchmove', onTouchMove);
              map.on('touchend', onTouchEnd);
            };

            marker.on('mousedown', onMouseDown);
            marker.on('touchstart', onTouchStart);

            // Right-click to delete vertex (only if more than 3)
            marker.on('contextmenu', (e: any) => {
              L.DomEvent.stopPropagation(e);
              const currentRings = getPolygonLatLngs(polygonLayer);
              if (currentRings[ringIndex].length <= 3) return;
              currentRings[ringIndex].splice(vIdx, 1);
              setPolygonLatLngs(polygonLayer, currentRings);
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

    // ── Override Leaflet.Draw edit to be a no-op (we handle editing ourselves) ──
    // We keep Leaflet.Draw ONLY for the draw toolbar (draw new polygons)
    // and the delete button. For editing we use our custom vertex editor above.

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
        edit: false,  // Disable Leaflet.Draw native edit; we use custom editor
      }
    });

    map.addControl(drawControl);

    // ── Custom Edit button injected into toolbar ─────────────────────────────
    // We inject a custom Edit button into the Leaflet.Draw toolbar container
    // because we disabled the native edit. We do it after adding the control.
    const injectEditButton = () => {
      const toolbar = mapRef.current?.querySelector('.leaflet-draw-toolbar') as HTMLElement | null;
      if (!toolbar) return;

      // Avoid injecting twice
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
          // Save & exit edit mode
          editMode = false;
          editPolygonLayers = [];
          destroyEditUI();
          editBtn.classList.remove('leaflet-draw-toolbar-button-enabled');
          emitChange();
        } else {
          // Enter edit mode
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

      // Insert before the first child (draw polygon button area) or append
      toolbar.insertBefore(editBtn, toolbar.firstChild);
    };

    // Delay to allow toolbar to render
    setTimeout(injectEditButton, 300);

    // ── Helper: extract all polygons from drawnItems ─────────────────────────
    const extractPolygons = (): LatLng[][] => {
      const result: LatLng[][] = [];
      drawnItems.eachLayer((layer: any) => {
        const latlngsRaw = layer.getLatLngs();
        const ring = Array.isArray(latlngsRaw[0]) ? latlngsRaw[0] : latlngsRaw;
        result.push(ring.map((ll: any) => ({ lat: ll.lat, lng: ll.lng })));
      });
      return result;
    };

    // Resize handling
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

    // ── Event: new shape drawn ───────────────────────────────────────────────
    map.on(L.Draw.Event.CREATED, (e: any) => {
      const layer = e.layer;
      drawnItems.addLayer(layer);
      const all = extractPolygons();
      onPolygonsChangeRef.current(all.length > 0 ? all : null);
    });

    // ── Event: shape deleted ─────────────────────────────────────────────────
    map.on(L.Draw.Event.DELETED, () => {
      // If deleted while in edit mode, exit edit mode
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
  }, []); // Only run once

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

    // Load each polygon as its own editable layer
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
