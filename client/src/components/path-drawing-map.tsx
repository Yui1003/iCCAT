import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Undo } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PathNode {
  lat: number;
  lng: number;
}

interface PolygonPoint {
  lat: number;
  lng: number;
}

interface Building {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type?: string;
  polygon?: PolygonPoint[] | null;
  polygonColor?: string;
}

interface PathDrawingMapProps {
  nodes: PathNode[];
  onNodesChange: (nodes: PathNode[]) => void;
  mode?: 'walking' | 'driving';
  className?: string;
  existingPaths?: Array<{ id?: string; nodes: PathNode[] }>;
  currentPathId?: string;
  buildings?: Building[];
}

declare global {
  interface Window {
    L: any;
  }
}

export default function PathDrawingMap({
  nodes,
  onNodesChange,
  mode = 'walking',
  className = "h-[500px] w-full",
  existingPaths = [],
  currentPathId,
  buildings = []
}: PathDrawingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const hasInitializedBoundsRef = useRef(false);
  const [isDrawing, setIsDrawing] = useState(true);

  useEffect(() => {
    if (!mapRef.current) return;

    const L = window.L;
    if (!L) {
      console.error("Leaflet not loaded");
      return;
    }

    // Only initialize map once
    if (mapInstanceRef.current) {
      return;
    }

    // Create map instance
    const map = L.map(mapRef.current, {
      center: [14.402940724441228, 120.86516350507739],
      zoom: 17.5,
      maxZoom: 22,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 22,
      maxNativeZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Use ResizeObserver to handle dialog resize events
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

    // Trigger invalidateSize after delays for safety
    const timeoutId1 = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 100);

    const timeoutId2 = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 300);

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
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;

    const L = window.L;
    const map = mapInstanceRef.current;

    const handleClick = (e: any) => {
      if (isDrawing) {
        const newNode = { lat: e.latlng.lat, lng: e.latlng.lng };
        onNodesChange([...nodes, newNode]);
      }
    };

    map.on('click', handleClick);

    return () => {
      map.off('click', handleClick);
    };
  }, [isDrawing, nodes, onNodesChange]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;

    const L = window.L;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    // Render building boundary polygons
    if (buildings && buildings.length > 0) {
      buildings.forEach((building) => {
        if (building.polygon && Array.isArray(building.polygon) && building.polygon.length > 0) {
          const polygonColor = building.polygonColor || "#FACC15";
          const polygonLatLngs = building.polygon.map(p => [p.lat, p.lng]);
          
          L.polygon(polygonLatLngs, {
            color: polygonColor,
            fillColor: polygonColor,
            fillOpacity: 0.25,
            weight: 2,
            opacity: 0.6,
            dashArray: '5, 5',
            interactive: false
          }).addTo(mapInstanceRef.current);
        }
      });
    }

    // Render building markers - clickable to snap paths to buildings
    if (buildings && buildings.length > 0) {
      buildings.forEach((building) => {
        const iconHtml = `
          <div class="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white font-bold text-xs text-white">
            B
          </div>
        `;

        const icon = L.divIcon({
          html: iconHtml,
          className: 'building-waypoint-marker',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([building.lat, building.lng], { icon })
          .addTo(mapInstanceRef.current)
          .bindTooltip(`Building: ${building.name}`, {
            permanent: false,
            direction: 'top',
            offset: [0, -12],
          });

        marker.on('click', (e: any) => {
          L.DomEvent.stopPropagation(e);
          if (isDrawing) {
            // Auto-add building location as waypoint when clicked
            onNodesChange([...nodes, { lat: building.lat, lng: building.lng }]);
          }
        });

        markersRef.current.push(marker);
      });
    }

    // Render existing path markers (from other paths)
    if (existingPaths && existingPaths.length > 0) {
      existingPaths.forEach((path) => {
        // Skip rendering the current path being edited
        if (currentPathId && path.id === currentPathId) {
          return;
        }

        if (path.nodes && path.nodes.length > 0) {
          path.nodes.forEach((node, index) => {
            const iconHtml = `
              <div class="w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center shadow-sm border-2 border-gray-300 opacity-60">
              </div>
            `;

            const icon = L.divIcon({
              html: iconHtml,
              className: 'existing-waypoint-marker',
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            });

            const marker = L.marker([node.lat, node.lng], { icon })
              .addTo(mapInstanceRef.current)
              .bindTooltip('Existing waypoint (click to connect)', {
                permanent: false,
                direction: 'top',
                offset: [0, -10],
              });

            // Make existing waypoints clickable to snap to them
            marker.on('click', (e: any) => {
              L.DomEvent.stopPropagation(e);
              if (isDrawing) {
                // Check if this waypoint is already in the path
                const alreadyExists = nodes.some(
                  n => Math.abs(n.lat - node.lat) < 0.00001 && Math.abs(n.lng - node.lng) < 0.00001
                );
                if (!alreadyExists) {
                  onNodesChange([...nodes, { lat: node.lat, lng: node.lng }]);
                }
              }
            });

            markersRef.current.push(marker);
          });
        }
      });
    }

    // Render current path nodes
    if (nodes.length > 0) {
      const color = mode === 'driving' ? '#22c55e' : '#3b82f6';

      nodes.forEach((node, index) => {
        const isFirst = index === 0;
        const isLast = index === nodes.length - 1;

        let iconHtml = '';
        if (isFirst) {
          iconHtml = `
            <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path>
              </svg>
            </div>
          `;
        } else if (isLast) {
          iconHtml = `
            <div class="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path>
              </svg>
            </div>
          `;
        } else {
          iconHtml = `
            <div class="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg border-2" style="border-color: ${color}">
              <div class="w-3 h-3 rounded-full" style="background-color: ${color}"></div>
            </div>
          `;
        }

        const icon = L.divIcon({
          html: iconHtml,
          className: 'waypoint-marker',
          iconSize: isFirst || isLast ? [32, 32] : [24, 24],
          iconAnchor: isFirst || isLast ? [16, 32] : [12, 12],
        });

        const marker = L.marker([node.lat, node.lng], { icon })
          .addTo(mapInstanceRef.current)
          .bindTooltip(
            isFirst ? 'Start' : isLast ? 'End' : `Waypoint ${index}`,
            {
              permanent: false,
              direction: 'top',
              offset: [0, -10],
            }
          );

        marker.on('click', (e: any) => {
          L.DomEvent.stopPropagation(e);
          if (!isDrawing) {
            const newNodes = nodes.filter((_, i) => i !== index);
            onNodesChange(newNodes);
          }
        });

        markersRef.current.push(marker);
      });

      if (nodes.length > 1) {
        polylineRef.current = L.polyline(nodes, {
          color: color,
          weight: 4,
          opacity: 0.7,
          smoothFactor: 1
        }).addTo(mapInstanceRef.current);
      }

      // Only fit bounds on initial load with existing nodes, not on every node addition
      if (!hasInitializedBoundsRef.current && nodes.length > 1) {
        const bounds = L.latLngBounds(nodes);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 22 });
        hasInitializedBoundsRef.current = true;
      }
    }
  }, [nodes, mode, isDrawing, onNodesChange, existingPaths, currentPathId, buildings]);

  const handleUndo = () => {
    if (nodes.length > 0) {
      onNodesChange(nodes.slice(0, -1));
    }
  };

  const handleClear = () => {
    onNodesChange([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={isDrawing ? "default" : "secondary"}>
            {isDrawing ? 'Drawing Mode: Click to add waypoints' : 'Edit Mode: Click waypoints to remove'}
          </Badge>
          <Badge variant="outline">
            {nodes.length} waypoint{nodes.length !== 1 ? 's' : ''}
          </Badge>
          {buildings.length > 0 && (
            <Badge variant="outline" className="bg-orange-50">
              🏢 {buildings.length} building{buildings.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {existingPaths && existingPaths.length > 0 && (
            <Badge variant="outline" className="bg-gray-50">
              •••  {existingPaths.filter(p => !currentPathId || p.id !== currentPathId).length} path segment{existingPaths.filter(p => !currentPathId || p.id !== currentPathId).length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={isDrawing ? "secondary" : "default"}
            onClick={() => setIsDrawing(!isDrawing)}
            data-testid="button-toggle-drawing"
          >
            {isDrawing ? 'Stop Drawing' : 'Start Drawing'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleUndo}
            disabled={nodes.length === 0}
            data-testid="button-undo"
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleClear}
            disabled={nodes.length === 0}
            data-testid="button-clear"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div 
        ref={mapRef} 
        className={`${className} rounded-lg overflow-hidden border bg-slate-100`}
        style={{ 
          display: 'block', 
          position: 'relative', 
          width: '100%', 
          height: '350px',
          minHeight: '350px'
        }}
        data-testid="path-drawing-map" 
      />
      {nodes.length > 0 && (
        <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded-md">
          <p className="font-medium mb-1">Path Nodes:</p>
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {nodes.map((node, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-muted-foreground">{i + 1}.</span>
                <code className="text-xs">
                  {node.lat.toFixed(6)}, {node.lng.toFixed(6)}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
