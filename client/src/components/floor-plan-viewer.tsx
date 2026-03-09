import { useRef, useEffect, useState } from "react";
import { X, ZoomIn, ZoomOut, Maximize2, Plus, Trash2, Navigation } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ScrollArea } from "./ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import type { Floor, Room, IndoorNode } from "@shared/schema";
import { trackEvent } from "@/lib/analytics-tracker";
import { AnalyticsEventType } from "@shared/analytics-schema";

interface CombinedRoom {
  id: string;
  name: string;
  type: string;
  description: string | null;
  x: number;
  y: number;
  buildingId: string;
  floorId: string;
  isIndoorNode?: boolean;
  category?: string | null;
  imageUrl?: string | null;
  labelX?: number | null;
  labelY?: number | null;
}

interface LatLng {
  lat: number;
  lng: number;
}

interface FloorPlanViewerProps {
  floor: Floor;
  rooms?: (Room | CombinedRoom)[];
  indoorNodes?: IndoorNode[];
  onClose: () => void;
  onPlaceRoom?: (x: number, y: number) => void;
  onCreateRoom?: (data: any) => void;
  onUpdateRoom?: (id: string, data: any) => void;
  onDeleteRoom?: (id: string) => void;
  highlightedRoomId?: string;
  showPathTo?: IndoorNode | null;
  viewOnly?: boolean;
  pathPolyline?: LatLng[];
  onGetDirections?: (room: Room | CombinedRoom) => void;
}

export default function FloorPlanViewer({ floor, rooms = [], indoorNodes = [], onClose, onPlaceRoom, onCreateRoom, onUpdateRoom, onDeleteRoom, highlightedRoomId, showPathTo, viewOnly = false, pathPolyline, onGetDirections }: FloorPlanViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | CombinedRoom | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | CombinedRoom | null>(null);
  const [roomFormData, setRoomFormData] = useState({ name: "", type: "classroom", description: "", x: 0, y: 0 });
  const [viewingRoomInfo, setViewingRoomInfo] = useState<Room | CombinedRoom | null>(null);

  const zoomRef = useRef(1);
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  const gestureRef = useRef({ isDragging: false, lastX: 0, lastY: 0, lastDist: 0, wasDragging: false, startX: 0, startY: 0 });
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  const updateZoom = (v: number) => { zoomRef.current = v; setZoom(v); };
  const updatePanX = (v: number) => { panXRef.current = v; setPanX(v); };
  const updatePanY = (v: number) => { panYRef.current = v; setPanY(v); };
  
  const isAdminMode = !!(onCreateRoom || onUpdateRoom || onDeleteRoom);

  useEffect(() => {
    if (floor.floorPlanImage) {
      setIsLoadingImage(true);
      const imageLoadStart = performance.now();
      const img = new Image();
      img.src = floor.floorPlanImage;
      img.onload = () => {
        const imageLoadDuration = performance.now() - imageLoadStart;
        setImage(img);
        setIsLoadingImage(false);
        trackEvent(AnalyticsEventType.IMAGE_LOAD, Math.max(1, Math.round(imageLoadDuration)), {
          action: 'floor_plan_image_loaded',
          floorId: floor.id,
          floorName: floor.floorName,
          imageSize: img.width + 'x' + img.height
        });
      };
      img.onerror = () => {
        setIsLoadingImage(false);
      };
    }
  }, [floor.floorPlanImage, floor.id, floor.floorName]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setLineDash([]);

    // Clear and return early while image is loading (HTML overlay handles the UI)
    if (isLoadingImage) {
      return;
    }

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(panX / zoom, panY / zoom);

    if (image) {
      const scale = Math.min(canvas.width / image.width, canvas.height / image.height) * 0.9;
      const x = (canvas.width / zoom - image.width * scale) / 2;
      const y = (canvas.height / zoom - image.height * scale) / 2;
      
      ctx.drawImage(image, x, y, image.width * scale, image.height * scale);

      if (pathPolyline && pathPolyline.length > 0) {
        console.log('[FLOOR-PLAN] Drawing path with', pathPolyline.length, 'waypoints');
        
        const imageWidth = image.width * scale;
        const imageHeight = image.height * scale;
        const validWaypoints = pathPolyline.filter(wp => {
          const px = x + wp.lat * scale;
          const py = y + wp.lng * scale;
          return px >= x - 100 && px <= x + imageWidth + 100 &&
                 py >= y - 100 && py <= y + imageHeight + 100;
        });
        
        if (validWaypoints.length > 0) {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3 / zoom;
          ctx.setLineDash([5 / zoom, 5 / zoom]);
          ctx.beginPath();
          
          const firstWp = validWaypoints[0];
          ctx.moveTo(x + firstWp.lat * scale, y + firstWp.lng * scale);
          
          for (let i = 1; i < validWaypoints.length; i++) {
            const wp = validWaypoints[i];
            ctx.lineTo(x + wp.lat * scale, y + wp.lng * scale);
          }
          
          ctx.stroke();
          ctx.setLineDash([]);
          console.log('[FLOOR-PLAN] Path drawn with', validWaypoints.length, 'valid waypoints');

          // Draw S/E endpoint markers on top of the path
          const drawEndpointMarker = (wx: number, wy: number, color: string, letter: string) => {
            const r = 12 / zoom;
            ctx.beginPath();
            ctx.fillStyle = color;
            ctx.arc(wx, wy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2 / zoom;
            ctx.beginPath();
            ctx.arc(wx, wy, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${10 / zoom}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(letter, wx, wy);
            ctx.textBaseline = 'alphabetic';
          };
          const firstWpE = validWaypoints[0];
          const lastWpE = validWaypoints[validWaypoints.length - 1];
          drawEndpointMarker(x + firstWpE.lat * scale, y + firstWpE.lng * scale, '#22c55e', 'S');
          if (validWaypoints.length > 1) {
            drawEndpointMarker(x + lastWpE.lat * scale, y + lastWpE.lng * scale, '#ef4444', 'E');
          }
        }
      } else {
        console.log('[FLOOR-PLAN] No polyline or empty polyline, pathPolyline:', pathPolyline);
      }

      rooms.forEach(room => {
        const roomX = x + room.x * scale;
        const roomY = y + room.y * scale;

        const pinSize = 20 / zoom;
        let roomColor = getRoomColor(room.type);
        
        if (highlightedRoomId && room.id === highlightedRoomId) {
          roomColor = '#ef4444';
        }
        
        ctx.beginPath();
        ctx.arc(roomX, roomY - pinSize / 2, pinSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = roomColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(roomX - pinSize / 3, roomY - pinSize / 4);
        ctx.lineTo(roomX + pinSize / 3, roomY - pinSize / 4);
        ctx.lineTo(roomX, roomY + pinSize);
        ctx.closePath();
        ctx.fillStyle = roomColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();

        // Draw room name label above the pin (supports multiline via \n)
        const label = room.name;
        const fontSize = Math.max(9, 11 / zoom);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';

        const lines = label.split('\n');
        const lineH = fontSize * 1.25;
        const maxTextWidth = Math.max(...lines.map((l: string) => ctx.measureText(l).width));
        const labelPadX = 4 / zoom;
        const labelPadY = 3 / zoom;
        
        // Use custom label position if set, otherwise default to above pin
        const hasCustomLabel = 'labelX' in room && room.labelX != null && room.labelY != null;
        const labelDrawX = hasCustomLabel ? x + (room as any).labelX * scale : roomX;
        const labelDrawY = hasCustomLabel ? y + (room as any).labelY * scale : roomY - pinSize - 4 / zoom;

        // Background pill sized for all lines
        const bgW = maxTextWidth + labelPadX * 2;
        const bgH = lines.length * lineH + labelPadY * 2;
        const bgX = labelDrawX - maxTextWidth / 2 - labelPadX;
        // If custom label, center the pill vertically on the coordinate. If default, stack it above.
        const bgY = hasCustomLabel 
          ? labelDrawY - (lines.length * lineH) / 2 - labelPadY 
          : labelDrawY - lines.length * lineH - labelPadY;
          
        const radius = 3 / zoom;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.beginPath();
        ctx.moveTo(bgX + radius, bgY);
        ctx.lineTo(bgX + bgW - radius, bgY);
        ctx.quadraticCurveTo(bgX + bgW, bgY, bgX + bgW, bgY + radius);
        ctx.lineTo(bgX + bgW, bgY + bgH - radius);
        ctx.quadraticCurveTo(bgX + bgW, bgY + bgH, bgX + bgW - radius, bgY + bgH);
        ctx.lineTo(bgX + radius, bgY + bgH);
        ctx.quadraticCurveTo(bgX, bgY + bgH, bgX, bgY + bgH - radius);
        ctx.lineTo(bgX, bgY + radius);
        ctx.quadraticCurveTo(bgX, bgY, bgX + radius, bgY);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        lines.forEach((line: string, i: number) => {
          const textY = hasCustomLabel
            ? labelDrawY - (lines.length * lineH) / 2 + (i + 0.8) * lineH
            : labelDrawY - labelPadY / 2 - (lines.length - 1 - i) * lineH;
          ctx.fillText(line, labelDrawX, textY);
        });
      });
    } else {
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, canvas.width / zoom, canvas.height / zoom);
      ctx.fillStyle = '#9ca3af';
      ctx.font = `${16 / zoom}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('No floor plan image available', canvas.width / (2 * zoom), canvas.height / (2 * zoom));
    }

    ctx.restore();
  }, [image, zoom, panX, panY, rooms, highlightedRoomId, showPathTo, indoorNodes, floor.id, pathPolyline, isLoadingImage]);

  const getRoomColor = (type: string) => {
    const colors: Record<string, string> = {
      classroom: '#3b82f6',
      office: '#22c55e',
      lab: '#a855f7',
      library: '#f59e0b',
      restroom: '#06b6d4',
      default: '#6b7280'
    };
    return colors[type.toLowerCase()] || colors.default;
  };

  const handleZoomIn = () => {
    updateZoom(Math.min(zoomRef.current * 1.2, 8));
  };

  const handleZoomOut = () => {
    updateZoom(Math.max(zoomRef.current / 1.2, 0.5));
  };

  const handleReset = () => {
    updateZoom(1);
    updatePanX(0);
    updatePanY(0);
  };

  useEffect(() => {
    updateZoom(1);
    updatePanX(0);
    updatePanY(0);
  }, [floor.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getTouchDist = (t1: Touch, t2: Touch) => {
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const g = gestureRef.current;
      if (e.touches.length === 1) {
        g.isDragging = true;
        g.wasDragging = false;
        g.lastX = e.touches[0].clientX;
        g.lastY = e.touches[0].clientY;
        g.startX = e.touches[0].clientX;
        g.startY = e.touches[0].clientY;
        g.lastDist = 0;
      } else if (e.touches.length === 2) {
        g.isDragging = false;
        g.lastDist = getTouchDist(e.touches[0], e.touches[1]);
        g.lastX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        g.lastY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const g = gestureRef.current;
      if (e.touches.length === 1 && g.isDragging) {
        const dx = e.touches[0].clientX - g.lastX;
        const dy = e.touches[0].clientY - g.lastY;
        g.lastX = e.touches[0].clientX;
        g.lastY = e.touches[0].clientY;
        if (Math.abs(e.touches[0].clientX - g.startX) > 8 || Math.abs(e.touches[0].clientY - g.startY) > 8) g.wasDragging = true;
        updatePanX(panXRef.current + dx);
        updatePanY(panYRef.current + dy);
      } else if (e.touches.length === 2 && g.lastDist > 0) {
        const newDist = getTouchDist(e.touches[0], e.touches[1]);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const scaleFactor = newDist / g.lastDist;
        const curZoom = zoomRef.current;
        const newZoom = Math.min(Math.max(curZoom * scaleFactor, 0.5), 8);
        const newPanX = midX - (midX - panXRef.current) * (newZoom / curZoom) + (midX - g.lastX);
        const newPanY = midY - (midY - panYRef.current) * (newZoom / curZoom) + (midY - g.lastY);
        updateZoom(newZoom);
        updatePanX(newPanX);
        updatePanY(newPanY);
        g.lastDist = newDist;
        g.lastX = midX;
        g.lastY = midY;
        g.wasDragging = true;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (e.touches.length === 0) {
        g.isDragging = false;
        g.lastDist = 0;
        if (!g.wasDragging && e.changedTouches.length === 1) {
          const touch = e.changedTouches[0];
          const syntheticClick = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            clientX: touch.clientX,
            clientY: touch.clientY,
            view: window
          });
          (e.target as HTMLElement).dispatchEvent(syntheticClick);
        }
      } else if (e.touches.length === 1) {
        g.isDragging = true;
        g.lastX = e.touches[0].clientX;
        g.lastY = e.touches[0].clientY;
        g.lastDist = 0;
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.85 : 1.18;
      const curZoom = zoomRef.current;
      const newZoom = Math.min(Math.max(curZoom * delta, 0.5), 8);
      const newPanX = mouseX - (mouseX - panXRef.current) * (newZoom / curZoom);
      const newPanY = mouseY - (mouseY - panYRef.current) * (newZoom / curZoom);
      updateZoom(newZoom);
      updatePanX(newPanX);
      updatePanY(newPanY);
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = gestureRef.current;
    g.isDragging = true;
    g.wasDragging = false;
    g.lastX = e.clientX;
    g.lastY = e.clientY;
    g.startX = e.clientX;
    g.startY = e.clientY;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = gestureRef.current;
    if (!g.isDragging) return;
    const dx = e.clientX - g.lastX;
    const dy = e.clientY - g.lastY;
    g.lastX = e.clientX;
    g.lastY = e.clientY;
    if (Math.abs(e.clientX - g.startX) > 4 || Math.abs(e.clientY - g.startY) > 4) g.wasDragging = true;
    updatePanX(panXRef.current + dx);
    updatePanY(panYRef.current + dy);
  };

  const handleMouseUp = () => { gestureRef.current.isDragging = false; };
  const handleMouseLeave = () => { gestureRef.current.isDragging = false; };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gestureRef.current.wasDragging) return;
    if (!image) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const x = canvasX / zoom - panX / zoom;
    const y = canvasY / zoom - panY / zoom;

    const scale = Math.min(canvas.width / image.width, canvas.height / image.height) * 0.9;
    const imgX = (canvas.width / zoom - image.width * scale) / 2;
    const imgY = (canvas.height / zoom - image.height * scale) / 2;

    const clickedRoom = rooms.find(room => {
      const roomX = imgX + room.x * scale;
      const roomY = imgY + room.y * scale;
      const pinSize = 20 / zoom;
      
      const circleCenterY = roomY - pinSize / 2;
      const distanceToCircle = Math.sqrt(Math.pow(x - roomX, 2) + Math.pow(y - circleCenterY, 2));
      if (distanceToCircle < pinSize / 2) return true;
      
      const triangleTop = roomY - pinSize / 4;
      const triangleBottom = roomY + pinSize;
      const triangleLeft = roomX - pinSize / 3;
      const triangleRight = roomX + pinSize / 3;
      
      if (y >= triangleTop && y <= triangleBottom && x >= triangleLeft && x <= triangleRight) {
        return true;
      }
      
      return false;
    });

    if (clickedRoom) {
      if (isAdminMode) {
        setEditingRoom(clickedRoom);
        setRoomFormData({
          name: clickedRoom.name,
          type: clickedRoom.type,
          description: clickedRoom.description || "",
          x: clickedRoom.x,
          y: clickedRoom.y
        });
      } else {
        setViewingRoomInfo(clickedRoom);
      }
    } else if (isAdminMode) {
      const roomPixelX = (x - imgX) / scale;
      const roomPixelY = (y - imgY) / scale;
      
      const clampedX = Math.max(0, Math.min(image.width, roomPixelX));
      const clampedY = Math.max(0, Math.min(image.height, roomPixelY));
      
      setEditingRoom(null);
      setRoomFormData({ name: "", type: "classroom", description: "", x: clampedX, y: clampedY });
    }
  };

  const handleSaveRoom = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roomFormData.name.trim()) {
      alert("Please enter a room name");
      return;
    }
    
    if (!roomFormData.type) {
      alert("Please select a room type");
      return;
    }
    
    const data = {
      floorId: floor.id,
      buildingId: floor.buildingId,
      name: roomFormData.name,
      type: roomFormData.type,
      description: roomFormData.description || null,
      x: roomFormData.x,
      y: roomFormData.y
    };

    if (editingRoom && onUpdateRoom) {
      onUpdateRoom(editingRoom.id, data);
    } else if (onCreateRoom) {
      onCreateRoom(data);
    }

    setEditingRoom(null);
    setRoomFormData({ name: "", type: "classroom", description: "", x: 0, y: 0 });
  };

  const handleCancelEdit = () => {
    setEditingRoom(null);
    setRoomFormData({ name: "", type: "classroom", description: "", x: 0, y: 0 });
  };

  const handleDeleteRoom = (room: Room) => {
    if (onDeleteRoom) {
      onDeleteRoom(room.id);
      if (editingRoom?.id === room.id) {
        handleCancelEdit();
      }
    }
  };

  if (viewOnly) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="bg-card border-b border-card-border p-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {floor.floorName || `Floor ${floor.floorNumber}`}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleZoomOut}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleZoomIn}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleReset}
              data-testid="button-reset-view"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden relative" ref={containerRef}>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
            data-testid="floor-plan-canvas"
          />
          {isLoadingImage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 dark:bg-gray-900/90 pointer-events-none z-10">
              <svg className="w-10 h-10 animate-spin mb-3 text-primary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Floor plan loading...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1100] bg-black/50 backdrop-blur-sm">
      <div className="h-screen flex flex-col">
        <div className="bg-card border-b border-card-border p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {floor.floorName || `Floor ${floor.floorNumber}`}
            </h2>
            <p className="text-sm text-muted-foreground">Floor Plan Viewer</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleZoomOut}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleZoomIn}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleReset}
              data-testid="button-reset-view"
            >
              <Maximize2 className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-testid="button-close-floor-plan"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {isAdminMode && (
          <div className="w-96 bg-card border-r border-card-border flex flex-col">
            <div className="p-6 border-b border-card-border">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {editingRoom ? 'Edit Room' : 'Add Room'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {editingRoom ? 'Update room information' : 'Click on the floor plan to place a new room marker'}
              </p>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6">
                <form onSubmit={handleSaveRoom} className="space-y-4">
                  <div>
                    <Label htmlFor="roomName">Room Name *</Label>
                    <Input
                      id="roomName"
                      value={roomFormData.name}
                      onChange={(e) => setRoomFormData({ ...roomFormData, name: e.target.value })}
                      required
                      data-testid="input-room-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="roomType">Type *</Label>
                    <Select 
                      value={roomFormData.type} 
                      onValueChange={(v) => setRoomFormData({ ...roomFormData, type: v })}
                    >
                      <SelectTrigger data-testid="select-room-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[1200]" position="popper" sideOffset={5}>
                        <SelectItem value="classroom">Classroom</SelectItem>
                        <SelectItem value="office">Office</SelectItem>
                        <SelectItem value="lab">Lab</SelectItem>
                        <SelectItem value="library">Library</SelectItem>
                        <SelectItem value="restroom">Restroom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="description">Room Description</Label>
                    <Input
                      id="description"
                      value={roomFormData.description}
                      onChange={(e) => setRoomFormData({ ...roomFormData, description: e.target.value })}
                      data-testid="input-room-description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="x">X Position</Label>
                      <Input
                        id="x"
                        type="text"
                        value={roomFormData.x.toFixed(3)}
                        readOnly
                        className="bg-muted/50"
                        data-testid="input-room-x"
                      />
                    </div>
                    <div>
                      <Label htmlFor="y">Y Position</Label>
                      <Input
                        id="y"
                        type="text"
                        value={roomFormData.y.toFixed(3)}
                        readOnly
                        className="bg-muted/50"
                        data-testid="input-room-y"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1" data-testid="button-save-room">
                      {editingRoom ? 'Update Room' : 'Create Room'}
                    </Button>
                    {editingRoom && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleCancelEdit}
                        data-testid="button-cancel-edit"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>

                <div className="mt-8">
                  <h4 className="text-sm font-semibold text-foreground mb-3">Rooms on this floor ({rooms.length})</h4>
                  <div className="space-y-2">
                    {rooms.length > 0 ? (
                      rooms.map(room => (
                        <div
                          key={room.id}
                          className={`p-3 rounded-md border ${
                            editingRoom?.id === room.id ? 'bg-primary/10 border-primary' : 'bg-muted/50 border-transparent'
                          } hover-elevate cursor-pointer`}
                          onClick={() => {
                            setEditingRoom(room);
                            setRoomFormData({
                              name: room.name,
                              type: room.type,
                              description: room.description || "",
                              x: room.x,
                              y: room.y
                            });
                          }}
                          data-testid={`room-item-${room.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{room.name}</p>
                              <Badge variant="secondary" className="capitalize text-xs mt-1">
                                {room.type}
                              </Badge>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRoom(room);
                              }}
                              data-testid={`button-delete-room-${room.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No rooms added yet. Click on the floor plan to add a room.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-card-border">
                  <h4 className="text-sm font-semibold text-foreground mb-3">Room Types</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-[#3b82f6]"></div>
                      <span className="text-sm text-muted-foreground">Classroom</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-[#22c55e]"></div>
                      <span className="text-sm text-muted-foreground">Office</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-[#a855f7]"></div>
                      <span className="text-sm text-muted-foreground">Lab</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-[#f59e0b]"></div>
                      <span className="text-sm text-muted-foreground">Library</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-[#06b6d4]"></div>
                      <span className="text-sm text-muted-foreground">Restroom</span>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
          )}

          <div
            ref={containerRef}
            className="flex-1 bg-muted relative"
          >
            <canvas
              ref={canvasRef}
              className="cursor-grab active:cursor-grabbing touch-none"
              onClick={handleCanvasClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              data-testid="canvas-floor-plan"
            />
            {isLoadingImage && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 dark:bg-gray-900/90 pointer-events-none z-10">
                <svg className="w-10 h-10 animate-spin mb-3 text-primary" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Floor plan loading...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Room Information Dialog for view-only mode */}
      {!isAdminMode && (
        <Dialog open={!!viewingRoomInfo} onOpenChange={(open) => !open && setViewingRoomInfo(null)}>
          <DialogContent className="z-[1200]" data-testid="dialog-room-info">
            <DialogHeader>
              <DialogTitle data-testid="text-room-info-name">{viewingRoomInfo?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {'imageUrl' in (viewingRoomInfo || {}) && viewingRoomInfo?.imageUrl && (
                <div className="w-full rounded-md overflow-hidden aspect-video">
                  <img src={viewingRoomInfo.imageUrl} alt={viewingRoomInfo.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-full" 
                  style={{ backgroundColor: viewingRoomInfo ? getRoomColor(viewingRoomInfo.type) : '#6b7280' }}
                />
                <div>
                  <p className="text-sm text-muted-foreground">Room Type</p>
                  <p className="font-medium capitalize" data-testid="text-room-info-type">{viewingRoomInfo?.type}</p>
                </div>
              </div>
              {'category' in (viewingRoomInfo || {}) && viewingRoomInfo?.category && (
                <div>
                  <p className="text-sm text-muted-foreground">Room Category</p>
                  <p className="font-medium" data-testid="text-room-info-category">{viewingRoomInfo.category}</p>
                </div>
              )}
              {viewingRoomInfo?.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium" data-testid="text-room-info-description">{viewingRoomInfo.description}</p>
                </div>
              )}
              {onGetDirections && (
                <Button
                  className="w-full"
                  onClick={() => {
                    if (viewingRoomInfo) {
                      onGetDirections(viewingRoomInfo);
                      setViewingRoomInfo(null);
                    }
                  }}
                  data-testid="button-get-directions-from-floor-plan"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Get Directions to Room
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
