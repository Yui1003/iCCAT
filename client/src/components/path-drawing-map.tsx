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
  polarTracking?: boolean;
  polarIncrement?: number;
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
  buildings = [],
  polarTracking = false,
  polarIncrement = 45
}: PathDrawingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const previewLineRef = useRef<any>(null);
  const hasInitializedBoundsRef = useRef(false);
  const [isDrawing, setIsDrawing] = useState(true);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.L || !isDrawing) return;

    const L = window.L;
    const map = mapInstanceRef.current;

    const updatePreview = (latlng: any) => {
      if (nodes.length === 0) return;

      const lastNode = nodes[nodes.length - 1];
      let cursorLatLng = latlng;

      if (polarTracking && nodes.length > 0) {
        // Ensure polarIncrement is a valid number to prevent division by zero or NaN
        const increment = (typeof polarIncrement === 'number' && polarIncrement > 0) ? polarIncrement : 45;
        
        const dy = cursorLatLng.lat - lastNode.lat;
        const dx = cursorLatLng.lng - lastNode.lng;
        
        let angle = Math.atan2(dy, dx);
        let angleDeg = (angle * 180) / Math.PI;
        if (angleDeg < 0) angleDeg += 360;

        const snappedAngleDeg = Math.round(angleDeg / increment) * increment;
        const snappedAngleRad = (snappedAngleDeg * Math.PI) / 180;

        const distance = Math.sqrt(dx * dx + dy * dy);
        
        cursorLatLng = L.latLng(
          lastNode.lat + distance * Math.sin(snappedAngleRad),
          lastNode.lng + distance * Math.cos(snappedAngleRad)
        );
      }

      if (previewLineRef.current) {
        previewLineRef.current.setLatLngs([lastNode, cursorLatLng]);
      } else {
        previewLineRef.current = L.polyline([lastNode, cursorLatLng], {
          color: '#3b82f6',
          weight: 2,
          opacity: 0.5,
          dashArray: '5, 10',
          interactive: false
        }).addTo(map);
      }
    };

    const handleMouseMove = (e: any) => {
      map._lastMousePos = e.latlng;
      updatePreview(e.latlng);
    };

    // If polarTracking or polarIncrement changed, refresh preview immediately
    if (map._lastMousePos) {
      updatePreview(map._lastMousePos);
    }

    map.on('mousemove', handleMouseMove);

    return () => {
      map.off('mousemove', handleMouseMove);
      if (previewLineRef.current) {
        previewLineRef.current.remove();
        previewLineRef.current = null;
      }
    };
  }, [nodes, isDrawing, polarTracking, polarIncrement]);

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
      center: [14.4025, 120.8670],
      zoom: 18.5,
      minZoom: 17.5,
      maxZoom: 22,
      zoomControl: true,
      attributionControl: true,
      dragging: true, // Will be toggled based on isDrawing
    });

    const updateBoundsBasedOnZoom = () => {
      if (!mapInstanceRef.current) return;
      const map = mapInstanceRef.current;
      const zoom = map.getZoom();
      
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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 22,
      maxNativeZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
    
    // Initial bounds setup
    setTimeout(updateBoundsBasedOnZoom, 350);
    map.on('zoomend', updateBoundsBasedOnZoom);

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
    if (!mapInstanceRef.current) return;
    
    // Always enable dragging to allow panning while drawing
    mapInstanceRef.current.dragging.enable();
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;

    const L = window.L;
    const map = mapInstanceRef.current;

    const handleClick = (e: any) => {
      // Don't add waypoint if the map was dragged (panning)
      // Check both _panned flag and a small movement threshold to be safe
      const wasDragged = mapInstanceRef.current._panned || 
                        (mapInstanceRef.current._lastClickPos && 
                         mapInstanceRef.current._lastClickPos.distanceTo(e.containerPoint) > 5);

      if (isDrawing && !wasDragged) {
        let newNodeLatLng = e.latlng;

        if (polarTracking && nodes.length > 0) {
          const lastNode = nodes[nodes.length - 1];
          // Ensure polarIncrement is a valid number
          const increment = (typeof polarIncrement === 'number' && polarIncrement > 0) ? polarIncrement : 45;

          const dy = newNodeLatLng.lat - lastNode.lat;
          const dx = newNodeLatLng.lng - lastNode.lng;
          
          let angle = Math.atan2(dy, dx);
          let angleDeg = (angle * 180) / Math.PI;
          if (angleDeg < 0) angleDeg += 360;

          const snappedAngleDeg = Math.round(angleDeg / increment) * increment;
          const snappedAngleRad = (snappedAngleDeg * Math.PI) / 180;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          newNodeLatLng = {
            lat: lastNode.lat + distance * Math.sin(snappedAngleRad),
            lng: lastNode.lng + distance * Math.cos(snappedAngleRad)
          };
        }

        const newNode = { lat: newNodeLatLng.lat, lng: newNodeLatLng.lng };
        onNodesChange([...nodes, newNode]);
      }
    };

    const handleMouseDown = (e: any) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current._panned = false;
        mapInstanceRef.current._lastClickPos = e.containerPoint;
      }
    };

    const handleDragStart = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current._panned = false;
      }
    };

    const handleDrag = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current._panned = true;
      }
    };

    map.on('click', handleClick);
    map.on('mousedown', handleMouseDown);
    map.on('dragstart', handleDragStart);
    map.on('drag', handleDrag);

    return () => {
      map.off('click', handleClick);
      map.off('mousedown', handleMouseDown);
      map.off('dragstart', handleDragStart);
      map.off('drag', handleDrag);
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
          iconAnchor: isFirst || isLast ? [16, 16] : [12, 12], // Centered end marker
        });

        const marker = L.marker([node.lat, node.lng], { 
          icon,
          draggable: isDrawing // Allow dragging while drawing
        })
          .addTo(mapInstanceRef.current)
          .bindTooltip(
            isFirst ? 'Start' : isLast ? 'End' : `Waypoint ${index}`,
            {
              permanent: false,
              direction: 'top',
              offset: [0, -10],
            }
          );

        marker.on('drag', (e: any) => {
          const newLatLng = e.target.getLatLng();
          const newNodes = [...nodes];
          const oldNode = newNodes[index];
          newNodes[index] = { lat: newLatLng.lat, lng: newLatLng.lng };

          // Synchronize with other waypoints from other paths that are at the same location
          if (existingPaths && existingPaths.length > 0) {
            existingPaths.forEach((path) => {
              if (currentPathId && path.id === currentPathId) return;
              if (path.nodes && path.nodes.length > 0) {
                path.nodes.forEach((node) => {
                  // If the waypoint was at the same location as our node before moving
                  if (Math.abs(node.lat - oldNode.lat) < 0.00001 && Math.abs(node.lng - oldNode.lng) < 0.00001) {
                    node.lat = newLatLng.lat;
                    node.lng = newLatLng.lng;
                  }
                });
              }
            });
          }

          // Don't call onNodesChange here to avoid expensive re-renders
          // Instead, just update the polyline visually
          if (polylineRef.current) {
            polylineRef.current.setLatLngs(newNodes);
          }
        });

        marker.on('dragend', (e: any) => {
          const newLatLng = e.target.getLatLng();
          const newNodes = [...nodes];
          const oldNode = newNodes[index];
          newNodes[index] = { lat: newLatLng.lat, lng: newLatLng.lng };

          // Final update for onNodesChange and notify parent about potential existing path changes
          // Note: In a real app, we might need a separate callback to update other paths in the database
          // but here we are primarily focused on the visual connection in the editor.
          onNodesChange(newNodes);
        });

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
          color: '#3b82f6', // blue color
          weight: 4,
          opacity: 0.8,
          smoothFactor: 1,
          interactive: false
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
