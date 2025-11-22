import { useRef, useEffect, useState } from "react";
import { X, ZoomIn, ZoomOut, Maximize2, Plus, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ScrollArea } from "./ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import type { Floor, Room } from "@shared/schema";

interface FloorPlanViewerProps {
  floor: Floor;
  rooms?: Room[];
  onClose: () => void;
  onPlaceRoom?: (x: number, y: number) => void;
  onCreateRoom?: (data: any) => void;
  onUpdateRoom?: (id: string, data: any) => void;
  onDeleteRoom?: (id: string) => void;
}

export default function FloorPlanViewer({ floor, rooms = [], onClose, onPlaceRoom, onCreateRoom, onUpdateRoom, onDeleteRoom }: FloorPlanViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomFormData, setRoomFormData] = useState({ name: "", type: "classroom", description: "", x: 0.5, y: 0.5 });
  const [viewingRoomInfo, setViewingRoomInfo] = useState<Room | null>(null);
  
  const isAdminMode = !!(onCreateRoom || onUpdateRoom || onDeleteRoom);

  useEffect(() => {
    if (floor.floorPlanImage) {
      const img = new Image();
      img.src = floor.floorPlanImage;
      img.onload = () => {
        setImage(img);
      };
    }
  }, [floor.floorPlanImage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(zoom, zoom);

    if (image) {
      const scale = Math.min(canvas.width / image.width, canvas.height / image.height) * 0.9;
      const x = (canvas.width / zoom - image.width * scale) / 2;
      const y = (canvas.height / zoom - image.height * scale) / 2;
      
      ctx.drawImage(image, x, y, image.width * scale, image.height * scale);

      rooms.forEach(room => {
        const roomX = x + room.x * image.width * scale;
        const roomY = y + room.y * image.height * scale;

        // Draw pin/marker icon (teardrop shape)
        const pinSize = 20 / zoom;
        const roomColor = getRoomColor(room.type);
        
        // Draw the pin shape
        ctx.beginPath();
        // Top circle part of the pin
        ctx.arc(roomX, roomY - pinSize / 2, pinSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = roomColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();
        
        // Bottom point of the pin (triangle)
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
  }, [image, zoom, rooms]);

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
    setZoom(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.5));
  };

  const handleReset = () => {
    setZoom(1);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!image) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    const scale = Math.min(canvas.width / image.width, canvas.height / image.height) * 0.9;
    const offsetX = (canvas.width / zoom - image.width * scale) / 2;
    const offsetY = (canvas.height / zoom - image.height * scale) / 2;

    const clickedRoom = rooms.find(room => {
      const roomX = offsetX + room.x * image.width * scale;
      const roomY = offsetY + room.y * image.height * scale;
      const pinSize = 20 / zoom;
      
      // Check if click is within the pin shape (circle at top + triangle at bottom)
      // Top circle part of pin
      const circleCenterY = roomY - pinSize / 2;
      const distanceToCircle = Math.sqrt(Math.pow(x - roomX, 2) + Math.pow(y - circleCenterY, 2));
      if (distanceToCircle < pinSize / 2) return true;
      
      // Bottom triangle part of pin (simple bounding box check)
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
        // Admin mode: edit the room
        setEditingRoom(clickedRoom);
        setRoomFormData({
          name: clickedRoom.name,
          type: clickedRoom.type,
          description: clickedRoom.description || "",
          x: clickedRoom.x,
          y: clickedRoom.y
        });
      } else {
        // View-only mode: show room info
        setViewingRoomInfo(clickedRoom);
      }
    } else if (isAdminMode) {
      // Admin mode: place new room marker
      const relativeX = Math.max(0, Math.min(1, (x - offsetX) / (image.width * scale)));
      const relativeY = Math.max(0, Math.min(1, (y - offsetY) / (image.height * scale)));
      
      if (relativeX >= 0 && relativeX <= 1 && relativeY >= 0 && relativeY <= 1) {
        setEditingRoom(null);
        setRoomFormData({ name: "", type: "classroom", description: "", x: relativeX, y: relativeY });
      }
    }
  };

  const handleSaveRoom = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roomFormData.type || !roomFormData.name) {
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
    setRoomFormData({ name: "", type: "classroom", description: "", x: 0.5, y: 0.5 });
  };

  const handleCancelEdit = () => {
    setEditingRoom(null);
    setRoomFormData({ name: "", type: "classroom", description: "", x: 0.5, y: 0.5 });
  };

  const handleDeleteRoom = (room: Room) => {
    if (onDeleteRoom) {
      onDeleteRoom(room.id);
      if (editingRoom?.id === room.id) {
        handleCancelEdit();
      }
    }
  };

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
              className="cursor-pointer"
              onClick={handleCanvasClick}
              data-testid="canvas-floor-plan"
            />
          </div>
        </div>
      </div>

      {/* Room Information Dialog for view-only mode */}
      {!isAdminMode && (
        <Dialog open={!!viewingRoomInfo} onOpenChange={(open) => !open && setViewingRoomInfo(null)}>
          <DialogContent className="z-[1200]">
            <DialogHeader>
              <DialogTitle>{viewingRoomInfo?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-full" 
                  style={{ backgroundColor: viewingRoomInfo ? getRoomColor(viewingRoomInfo.type) : '#6b7280' }}
                />
                <div>
                  <p className="text-sm text-muted-foreground">Room Type</p>
                  <p className="font-medium capitalize">{viewingRoomInfo?.type}</p>
                </div>
              </div>
              {viewingRoomInfo?.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Room Description</p>
                  <p className="font-medium">{viewingRoomInfo.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">X Position</p>
                  <p className="font-mono text-sm">{viewingRoomInfo?.x.toFixed(3)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Y Position</p>
                  <p className="font-mono text-sm">{viewingRoomInfo?.y.toFixed(3)}</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
