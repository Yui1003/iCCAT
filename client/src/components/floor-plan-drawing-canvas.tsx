import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!floorPlanImage) return;

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageDimensions({ width: img.width, height: img.height });
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
        pathWaypoints.slice(1).forEach(wp => {
          ctx.lineTo(wp.x, wp.y);
        });
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
    });

    indoorNodes.forEach(node => {
      let color = '#6B7280';
      let label = 'H';
      
      switch (node.type) {
        case 'entrance':
          color = '#F97316';
          label = 'E';
          break;
        case 'stairway':
          color = '#8B5CF6';
          label = 'S';
          break;
        case 'elevator':
          color = '#EC4899';
          label = 'EL';
          break;
        case 'hallway':
          color = '#6B7280';
          label = 'H';
          break;
        case 'room':
          color = '#3B82F6';
          label = 'R';
          break;
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
    });

    if (waypoints.length > 0) {
      if (waypoints.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#22C55E';
        ctx.lineWidth = 3 / scale;
        ctx.moveTo(waypoints[0].x, waypoints[0].y);
        waypoints.slice(1).forEach(wp => {
          ctx.lineTo(wp.x, wp.y);
        });
        ctx.stroke();
      }

      waypoints.forEach((wp, index) => {
        const isFirst = index === 0;
        const isLast = index === waypoints.length - 1;
        
        let color = '#22C55E';
        if (isFirst) color = '#22C55E';
        else if (isLast) color = '#EF4444';
        
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(wp.x, wp.y, (isFirst || isLast ? 10 : 6) / scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2 / scale;
        ctx.arc(wp.x, wp.y, (isFirst || isLast ? 10 : 6) / scale, 0, Math.PI * 2);
        ctx.stroke();

        if (isFirst || isLast) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `bold ${8 / scale}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(isFirst ? 'S' : 'E', wp.x, wp.y + 3 / scale);
        }
      });
    }

    ctx.restore();
  }, [imageLoaded, scale, offset, waypoints, rooms, indoorNodes, existingPaths, currentPathId]);

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

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    const nearbyNode = findNearbyNode(coords.x, coords.y);
    
    if (nearbyNode) {
      const alreadyExists = waypoints.some(
        wp => Math.abs(wp.x - nearbyNode.x) < 1 && Math.abs(wp.y - nearbyNode.y) < 1
      );
      if (!alreadyExists) {
        onWaypointsChange([...waypoints, { x: nearbyNode.x, y: nearbyNode.y, nodeId: nearbyNode.nodeId }]);
      }
    } else {
      onWaypointsChange([...waypoints, { x: coords.x, y: coords.y }]);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.2, 0.2));
  };

  const handleUndo = () => {
    if (waypoints.length > 0) {
      onWaypointsChange(waypoints.slice(0, -1));
    }
  };

  const handleClear = () => {
    onWaypointsChange([]);
  };

  const handleResetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
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
          {rooms.length > 0 && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              R {rooms.length} room{rooms.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {indoorNodes.filter(n => n.type === 'room').length > 0 && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              R {indoorNodes.filter(n => n.type === 'room').length} room{indoorNodes.filter(n => n.type === 'room').length !== 1 ? 's' : ''}
            </Badge>
          )}
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

      <div className="text-xs text-muted-foreground mb-2">
        <span className="inline-flex items-center gap-1 mr-3">
          <span className="w-3 h-3 rounded-full bg-blue-500"></span> Room
        </span>
        <span className="inline-flex items-center gap-1 mr-3">
          <span className="w-3 h-3 rounded-full bg-orange-500"></span> Entrance
        </span>
        <span className="inline-flex items-center gap-1 mr-3">
          <span className="w-3 h-3 rounded-full bg-purple-500"></span> Stairway
        </span>
        <span className="inline-flex items-center gap-1 mr-3">
          <span className="w-3 h-3 rounded-full bg-pink-500"></span> Elevator
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-gray-500"></span> Hallway
        </span>
      </div>

      <div 
        ref={containerRef}
        className={`${className} rounded-lg overflow-hidden border bg-slate-100 relative`}
        style={{ cursor: isDragging ? 'grabbing' : (isDrawing ? 'crosshair' : 'grab') }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
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
