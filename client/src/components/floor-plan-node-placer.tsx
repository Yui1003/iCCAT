import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, ZoomIn, ZoomOut, Move } from "lucide-react";
import type { IndoorNode, Room } from "@shared/schema";

interface FloorPlanNodePlacerProps {
  floorPlanImage: string;
  x: number | null;
  y: number | null;
  onCoordinatesChange: (x: number, y: number) => void;
  rooms?: Room[];
  existingNodes?: IndoorNode[];
  currentFloorId?: string;
  className?: string;
}

export default function FloorPlanNodePlacer({
  floorPlanImage,
  x,
  y,
  onCoordinatesChange,
  rooms = [],
  existingNodes = [],
  currentFloorId,
  className = "h-[400px] w-full"
}: FloorPlanNodePlacerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

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

    // Draw floor plan image
    ctx.drawImage(imageRef.current, 0, 0);

    // Draw existing rooms
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

    // Draw existing nodes on the same floor
    existingNodes.forEach(node => {
      if (currentFloorId && node.floorId !== currentFloorId) return;

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

    // Draw selected node placement
    if (x !== null && y !== null) {
      ctx.beginPath();
      ctx.fillStyle = '#EF4444';
      ctx.arc(x, y, 10 / scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3 / scale;
      ctx.arc(x, y, 10 / scale, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${10 / scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('X', x, y + 3 / scale);
    }

    ctx.restore();
  }, [imageLoaded, scale, offset, x, y, rooms, existingNodes, currentFloorId]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const coordX = (e.clientX - rect.left - offset.x) / scale;
    const coordY = (e.clientY - rect.top - offset.y) / scale;
    return { x: coordX, y: coordY };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    if (coords) {
      onCoordinatesChange(Math.round(coords.x), Math.round(coords.y));
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

  const handleZoom = (direction: 'in' | 'out') => {
    const zoomFactor = direction === 'in' ? 1.2 : 0.8;
    setScale(scale * zoomFactor);
  };

  const handleReset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleClear = () => {
    onCoordinatesChange(0, 0);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => handleZoom('in')}
          data-testid="button-zoom-in"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => handleZoom('out')}
          data-testid="button-zoom-out"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleReset}
          data-testid="button-reset-view"
        >
          <Move className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleClear}
          data-testid="button-clear-node"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
        {x !== null && y !== null && (
          <Badge variant="default">
            Node: ({x}, {y})
          </Badge>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          Click to place node. Alt+Drag to pan.
        </span>
      </div>
      <div
        ref={containerRef}
        className={className}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full h-full cursor-crosshair border rounded-lg bg-muted"
          data-testid="canvas-node-placer"
        />
      </div>
    </div>
  );
}
