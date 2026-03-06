import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Trash2, Undo, ZoomIn, ZoomOut, Move } from "lucide-react";
import type { IndoorNode, Room, RoomPath } from "@shared/schema";

interface RoomPathWaypoint {
  x: number;
  y: number;
  nodeId?: string;
}

interface FloorPlanDrawingCanvasProps {
  floorPlanImage: string;
  waypoints: RoomPathWaypoint[];
  onWaypointsChange: (waypoints: RoomPathWaypoint[]) => void;
  rooms?: Room[];
  indoorNodes?: IndoorNode[];
  existingPaths?: RoomPath[];
  currentPathId?: string;
  className?: string;
}

function applyPolarSnap(
  from: { x: number; y: number },
  to: { x: number; y: number },
  increment: number
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.001) return to;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const snapped = Math.round(angleDeg / increment) * increment;
  const rad = (snapped * Math.PI) / 180;
  return {
    x: from.x + dist * Math.cos(rad),
    y: from.y + dist * Math.sin(rad),
  };
}

export default function FloorPlanDrawingCanvas({
  floorPlanImage,
  waypoints,
  onWaypointsChange,
  rooms = [],
  indoorNodes = [],
  existingPaths = [],
  currentPathId,
  className = "h-[400px] w-full"
}: FloorPlanDrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(true);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [draggingWaypointIndex, setDraggingWaypointIndex] = useState<number | null>(null);
  const [hoverWaypointIndex, setHoverWaypointIndex] = useState<number | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

  const [polarTracking, setPolarTracking] = useState(false);
  const [polarIncrement, setPolarIncrement] = useState(45);

  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const wasDraggingRef = useRef(false);

  useEffect(() => {
    if (!floorPlanImage) return;
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = floorPlanImage;
  }, [floorPlanImage]);

  useEffect(() => {
    if (!imageLoaded || !canvasRef.current || !containerRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    ctx.drawImage(imageRef.current, 0, 0);

    existingPaths.forEach(path => {
      if (currentPathId && path.id === currentPathId) return;
      const pathWaypoints = path.waypoints as RoomPathWaypoint[];
      if (pathWaypoints && pathWaypoints.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#9CA3AF';
        ctx.lineWidth = 2 / scale;
        ctx.setLineDash([5 / scale, 5 / scale]);
        ctx.moveTo(pathWaypoints[0].x, pathWaypoints[0].y);
        pathWaypoints.slice(1).forEach(wp => ctx.lineTo(wp.x, wp.y));
        ctx.stroke();
        ctx.setLineDash([]);
        pathWaypoints.forEach(wp => {
          ctx.beginPath();
          ctx.fillStyle = '#9CA3AF';
          ctx.arc(wp.x, wp.y, 4 / scale, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });

    rooms.forEach(room => {
      ctx.beginPath();
      ctx.fillStyle = '#3B82F6';
      ctx.arc(room.x, room.y, 8 / scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2 / scale;
      ctx.arc(room.x, room.y, 8 / scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#1E40AF';
      ctx.font = `bold ${10 / scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('R', room.x, room.y + 3 / scale);

      if (room.name) {
        ctx.font = `${9 / scale}px sans-serif`;
        ctx.textAlign = 'center';
        const nameMetrics = ctx.measureText(room.name);
        const nameW = nameMetrics.width;
        const nameH = 10 / scale;
        const nameX = room.x - nameW / 2 - 2 / scale;
        const nameY = room.y + 12 / scale;
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.fillRect(nameX, nameY, nameW + 4 / scale, nameH);
        ctx.fillStyle = '#1E40AF';
        ctx.fillText(room.name, room.x, room.y + 20 / scale);
      }
    });

    indoorNodes.forEach(node => {
      let color = '#6B7280';
      let label = 'H';
      switch (node.type) {
        case 'entrance': color = '#F97316'; label = 'E'; break;
        case 'stairway': color = '#8B5CF6'; label = 'S'; break;
        case 'elevator': color = '#EC4899'; label = 'EL'; break;
        case 'hallway': color = '#6B7280'; label = 'H'; break;
        case 'room': color = '#3B82F6'; label = 'R'; break;
      }
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(node.x, node.y, 8 / scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2 / scale;
      ctx.arc(node.x, node.y, 8 / scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${8 / scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(label, node.x, node.y + 3 / scale);

      if (node.label) {
        ctx.font = `${9 / scale}px sans-serif`;
        ctx.textAlign = 'center';
        const lines = node.label.split('\n');
        const lineH = 10 / scale;
        const maxW = Math.max(...lines.map((l: string) => ctx.measureText(l).width));
        const totalH = lines.length * lineH;
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.fillRect(node.x - maxW / 2 - 2 / scale, node.y + 12 / scale, maxW + 4 / scale, totalH);
        ctx.fillStyle = color;
        lines.forEach((line: string, i: number) => {
          ctx.fillText(line, node.x, node.y + 20 / scale + i * lineH);
        });
      }
    });

    if (waypoints.length > 0) {
      if (waypoints.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#22C55E';
        ctx.lineWidth = 3 / scale;
        ctx.moveTo(waypoints[0].x, waypoints[0].y);
        waypoints.slice(1).forEach(wp => ctx.lineTo(wp.x, wp.y));
        ctx.stroke();
      }

      waypoints.forEach((wp, index) => {
        const isFirst = index === 0;
        const isLast = index === waypoints.length - 1;
        const isDragged = draggingWaypointIndex === index;
        const isHovered = hoverWaypointIndex === index;

        let color = '#22C55E';
        if (isFirst) color = '#22C55E';
        else if (isLast) color = '#EF4444';

        const baseR = (isFirst || isLast ? 10 : 6) / scale;

        if (isDragged || isHovered) {
          ctx.beginPath();
          ctx.strokeStyle = '#FBBF24';
          ctx.lineWidth = 3 / scale;
          ctx.arc(wp.x, wp.y, baseR + 4 / scale, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(wp.x, wp.y, baseR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2 / scale;
        ctx.arc(wp.x, wp.y, baseR, 0, Math.PI * 2);
        ctx.stroke();

        if (isFirst || isLast) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `bold ${8 / scale}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(isFirst ? 'S' : 'E', wp.x, wp.y + 3 / scale);
        }
      });
    }

    if (isDrawing && waypoints.length > 0 && mousePosition) {
      const last = waypoints[waypoints.length - 1];
      const snapped = polarTracking
        ? applyPolarSnap(last, mousePosition, polarIncrement)
        : mousePosition;

      ctx.beginPath();
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash([6 / scale, 4 / scale]);
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(snapped.x, snapped.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 1.5 / scale;
      ctx.arc(snapped.x, snapped.y, 5 / scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }, [imageLoaded, scale, offset, waypoints, rooms, indoorNodes, existingPaths, currentPathId,
    draggingWaypointIndex, hoverWaypointIndex, mousePosition, isDrawing, polarTracking, polarIncrement]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;
    return { x, y };
  };

  const findNearbyNode = (x: number, y: number, threshold: number = 15) => {
    for (const room of rooms) {
      const distance = Math.sqrt(Math.pow(room.x - x, 2) + Math.pow(room.y - y, 2));
      if (distance < threshold / scale) {
        return { x: room.x, y: room.y, nodeId: room.id, type: 'room' };
      }
    }
    for (const node of indoorNodes) {
      const distance = Math.sqrt(Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2));
      if (distance < threshold / scale) {
        return { x: node.x, y: node.y, nodeId: node.id, type: node.type };
      }
    }
    for (const path of existingPaths) {
      if (currentPathId && path.id === currentPathId) continue;
      const pathWaypoints = path.waypoints as RoomPathWaypoint[];
      for (const wp of pathWaypoints) {
        const distance = Math.sqrt(Math.pow(wp.x - x, 2) + Math.pow(wp.y - y, 2));
        if (distance < threshold / scale) {
          return { x: wp.x, y: wp.y, nodeId: wp.nodeId };
        }
      }
    }
    return null;
  };

  const findNearbyWaypointIndex = (x: number, y: number, threshold: number = 12): number | null => {
    for (let i = waypoints.length - 1; i >= 0; i--) {
      const wp = waypoints[i];
      const dist = Math.sqrt(Math.pow(wp.x - x, 2) + Math.pow(wp.y - y, 2));
      if (dist < threshold / scale) return i;
    }
    return null;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const downPos = mouseDownPosRef.current;
    if (downPos) {
      const dx = e.clientX - downPos.x;
      const dy = e.clientY - downPos.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5 || wasDraggingRef.current) {
        wasDraggingRef.current = false;
        return;
      }
    }
    wasDraggingRef.current = false;

    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    if (!isDrawing) {
      const nearIdx = findNearbyWaypointIndex(coords.x, coords.y);
      if (nearIdx !== null) {
        const updated = [...waypoints];
        updated.splice(nearIdx, 1);
        onWaypointsChange(updated);
      }
      return;
    }

    const nearbyNode = findNearbyNode(coords.x, coords.y);
    let finalCoords = coords;

    if (!nearbyNode && polarTracking && waypoints.length > 0) {
      const last = waypoints[waypoints.length - 1];
      finalCoords = applyPolarSnap(last, coords, polarIncrement);
    }

    if (nearbyNode) {
      const alreadyExists = waypoints.some(
        wp => Math.abs(wp.x - nearbyNode.x) < 1 && Math.abs(wp.y - nearbyNode.y) < 1
      );
      if (!alreadyExists) {
        onWaypointsChange([...waypoints, { x: nearbyNode.x, y: nearbyNode.y, nodeId: nearbyNode.nodeId }]);
      }
    } else {
      onWaypointsChange([...waypoints, { x: finalCoords.x, y: finalCoords.y }]);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    wasDraggingRef.current = false;

    if (e.button !== 0 && e.button !== 1) return;

    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    if (e.button === 0) {
      const nearIdx = findNearbyWaypointIndex(coords.x, coords.y);
      if (nearIdx !== null) {
        setDraggingWaypointIndex(nearIdx);
        return;
      }
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }

    if (e.button === 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    setMousePosition({ x: coords.x, y: coords.y });

    if (draggingWaypointIndex !== null) {
      wasDraggingRef.current = true;
      const nearbyNode = findNearbyNode(coords.x, coords.y);
      const updated = [...waypoints];
      if (nearbyNode) {
        updated[draggingWaypointIndex] = { x: nearbyNode.x, y: nearbyNode.y, nodeId: nearbyNode.nodeId };
      } else {
        let finalCoords = { x: coords.x, y: coords.y };
        if (polarTracking && waypoints.length > 1) {
          const refIdx = draggingWaypointIndex > 0 ? draggingWaypointIndex - 1 : draggingWaypointIndex + 1;
          const refWaypoint = waypoints[refIdx];
          if (refWaypoint) {
            finalCoords = applyPolarSnap(refWaypoint, coords, polarIncrement);
          }
        }
        updated[draggingWaypointIndex] = { x: finalCoords.x, y: finalCoords.y, nodeId: undefined };
      }
      onWaypointsChange(updated);
      return;
    }

    if (isDragging) {
      wasDraggingRef.current = true;
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
      return;
    }

    const nearIdx = findNearbyWaypointIndex(coords.x, coords.y);
    setHoverWaypointIndex(nearIdx);
  };

  const handleMouseUp = () => {
    if (draggingWaypointIndex !== null) {
      wasDraggingRef.current = true;
    }
    setDraggingWaypointIndex(null);
    setIsDragging(false);
    setHoverWaypointIndex(null);
  };

  const handleMouseLeave = () => {
    setDraggingWaypointIndex(null);
    setIsDragging(false);
    setHoverWaypointIndex(null);
    setMousePosition(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      setScale(prev => Math.min(Math.max(prev * zoomFactor, 0.2), 5));
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, [imageLoaded]);

  const handleZoomIn = () => setScale(prev => Math.min(prev * 1.2, 5));
  const handleZoomOut = () => setScale(prev => Math.max(prev / 1.2, 0.2));
  const handleUndo = () => {
    if (waypoints.length > 0) onWaypointsChange(waypoints.slice(0, -1));
  };
  const handleClear = () => onWaypointsChange([]);
  const handleResetView = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  const getCursor = () => {
    if (draggingWaypointIndex !== null) return 'grabbing';
    if (hoverWaypointIndex !== null) return 'move';
    if (isDragging) return 'grabbing';
    if (!isDrawing) return 'grab';
    return 'crosshair';
  };

  if (!floorPlanImage) {
    return (
      <div className={`${className} flex items-center justify-center bg-muted rounded-lg border`}>
        <p className="text-muted-foreground">No floor plan image available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={isDrawing ? "default" : "secondary"}>
            {isDrawing ? 'Drawing Mode' : 'Pan Mode'}
          </Badge>
          <Badge variant="outline">
            {waypoints.length} waypoint{waypoints.length !== 1 ? 's' : ''}
          </Badge>
          {indoorNodes.filter(n => n.type === 'entrance').length > 0 && (
            <Badge variant="outline" className="bg-orange-50 text-orange-700">
              E {indoorNodes.filter(n => n.type === 'entrance').length} entrance{indoorNodes.filter(n => n.type === 'entrance').length !== 1 ? 's' : ''}
            </Badge>
          )}
          {indoorNodes.filter(n => n.type === 'stairway').length > 0 && (
            <Badge variant="outline" className="bg-purple-50 text-purple-700">
              S {indoorNodes.filter(n => n.type === 'stairway').length} stair{indoorNodes.filter(n => n.type === 'stairway').length !== 1 ? 's' : ''}
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
            {isDrawing ? 'Pan' : 'Draw'}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={handleZoomIn}
            data-testid="button-zoom-in"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={handleZoomOut}
            data-testid="button-zoom-out"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={handleResetView}
            data-testid="button-reset-view"
          >
            <Move className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={handleUndo}
            disabled={waypoints.length === 0}
            data-testid="button-undo"
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={handleClear}
            disabled={waypoints.length === 0}
            data-testid="button-clear"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> Room
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-orange-500 inline-block"></span> Entrance
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-purple-500 inline-block"></span> Stairway
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-pink-500 inline-block"></span> Elevator
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-gray-500 inline-block"></span> Hallway
          </span>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center gap-2">
            <Switch
              id="polar-tracking"
              checked={polarTracking}
              onCheckedChange={setPolarTracking}
              data-testid="switch-polar-tracking"
            />
            <Label htmlFor="polar-tracking" className="text-xs cursor-pointer">Angle Snap</Label>
          </div>
          {polarTracking && (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={polarIncrement}
                onChange={e => setPolarIncrement(Math.max(1, Math.min(180, Number(e.target.value))))}
                className="w-16 h-7 text-xs"
                min={1}
                max={180}
                data-testid="input-polar-increment"
              />
              <span className="text-xs text-muted-foreground">°</span>
            </div>
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground px-1">
        {isDrawing
          ? "Draw Mode: Click to add waypoints • Drag to pan • Drag a waypoint to move it • Scroll to zoom"
          : "Pan Mode: Drag to pan • Click a waypoint to delete it • Drag a waypoint to move it • Scroll to zoom"}
      </div>

      <div
        ref={containerRef}
        className={`${className} rounded-lg overflow-hidden border bg-slate-100 relative`}
        style={{ cursor: getCursor() }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          data-testid="floor-plan-canvas"
        />
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
            <p className="text-muted-foreground">Loading floor plan...</p>
          </div>
        )}
      </div>

      {waypoints.length > 0 && (
        <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded-md">
          <p className="font-medium mb-1">Path Waypoints:</p>
          <div className="max-h-24 overflow-y-auto space-y-0.5">
            {waypoints.map((wp, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-muted-foreground">{i + 1}.</span>
                <code className="text-xs">
                  x: {wp.x.toFixed(0)}, y: {wp.y.toFixed(0)}
                  {wp.nodeId && <span className="text-blue-600 ml-1">(connected)</span>}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
