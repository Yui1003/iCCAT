import { useState, useMemo, useEffect } from "react";
import { Search, MapPin, Navigation, DoorOpen, Building2, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import type { Room, Floor, Building } from "@shared/schema";
import { trackEvent } from "@/lib/analytics-tracker";
import { AnalyticsEventType } from "@shared/analytics-schema";

interface RoomFinderDialogProps {
  open: boolean;
  onClose: () => void;
  rooms: Room[];
  floors: Floor[];
  buildings: Building[];
  onGetDirections: (buildingId: string) => void;
  onViewFloorPlan: (floor: Floor, rooms: Room[]) => void;
}

export default function RoomFinderDialog({
  open,
  onClose,
  rooms,
  floors,
  buildings,
  onGetDirections,
  onViewFloorPlan
}: RoomFinderDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  useEffect(() => {
    if (open) {
      trackEvent(AnalyticsEventType.INTERFACE_ACTION, 1, {
        action: 'room_finder_opened',
        totalRooms: rooms.length
      });
    }
  }, [open, rooms.length]);

  const getBuildingName = (buildingId: string) => {
    const building = buildings.find(b => b.id === buildingId);
    return building?.name || "Unknown Building";
  };

  const getFloorName = (floorId: string) => {
    const floor = floors.find(f => f.id === floorId);
    return floor?.floorName || `Floor ${floor?.floorNumber || "Unknown"}`;
  };

  const getFloor = (floorId: string) => {
    return floors.find(f => f.id === floorId);
  };

  const getRoomsForFloor = (floorId: string) => {
    return rooms.filter(r => r.floorId === floorId);
  };

  const getRoomTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      classroom: "bg-blue-500",
      office: "bg-green-500",
      lab: "bg-purple-500",
      library: "bg-amber-500",
      restroom: "bg-cyan-500"
    };
    return colors[type.toLowerCase()] || "bg-gray-500";
  };

  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return rooms;
    
    const query = searchQuery.toLowerCase();
    return rooms.filter(room => 
      room.name.toLowerCase().includes(query) ||
      room.type.toLowerCase().includes(query) ||
      room.description?.toLowerCase().includes(query) ||
      getBuildingName(room.buildingId).toLowerCase().includes(query) ||
      getFloorName(room.floorId).toLowerCase().includes(query)
    );
  }, [rooms, searchQuery, buildings, floors]);

  const roomsByBuilding = useMemo(() => {
    const grouped: Record<string, { building: Building; floors: Record<string, { floor: Floor; rooms: Room[] }> }> = {};
    
    filteredRooms.forEach(room => {
      const building = buildings.find(b => b.id === room.buildingId);
      const floor = floors.find(f => f.id === room.floorId);
      
      if (!building || !floor) return;
      
      if (!grouped[building.id]) {
        grouped[building.id] = { building, floors: {} };
      }
      
      if (!grouped[building.id].floors[floor.id]) {
        grouped[building.id].floors[floor.id] = { floor, rooms: [] };
      }
      
      grouped[building.id].floors[floor.id].rooms.push(room);
    });
    
    return grouped;
  }, [filteredRooms, buildings, floors]);

  const handleRoomSelect = (room: Room) => {
    setSelectedRoom(room);
    trackEvent(AnalyticsEventType.INTERFACE_ACTION, 1, {
      action: 'room_selected',
      roomId: room.id,
      roomName: room.name,
      buildingId: room.buildingId
    });
  };

  const handleGetDirections = () => {
    if (selectedRoom) {
      trackEvent(AnalyticsEventType.INTERFACE_ACTION, 1, {
        action: 'room_get_directions',
        roomId: selectedRoom.id,
        roomName: selectedRoom.name,
        buildingId: selectedRoom.buildingId
      });
      const buildingId = selectedRoom.buildingId;
      setSearchQuery("");
      setSelectedRoom(null);
      onGetDirections(buildingId);
      onClose();
    }
  };

  const handleViewFloorPlan = () => {
    if (selectedRoom) {
      const floor = getFloor(selectedRoom.floorId);
      if (floor) {
        const floorRooms = getRoomsForFloor(floor.id);
        trackEvent(AnalyticsEventType.INTERFACE_ACTION, 1, {
          action: 'room_view_floor_plan',
          roomId: selectedRoom.id,
          floorId: floor.id
        });
        onViewFloorPlan(floor, floorRooms);
      }
    }
  };

  const handleClose = () => {
    trackEvent(AnalyticsEventType.INTERFACE_ACTION, 1, {
      action: 'room_finder_closed',
      hadSelection: !!selectedRoom
    });
    setSearchQuery("");
    setSelectedRoom(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" data-testid="dialog-room-finder">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="text-room-finder-title">
            <DoorOpen className="w-5 h-5 text-primary" />
            Room Finder
          </DialogTitle>
        </DialogHeader>

        {!selectedRoom ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search rooms by name, type, or building..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-rooms"
              />
            </div>

            <ScrollArea className="flex-1 max-h-[50vh]" data-testid="scroll-room-list">
              {filteredRooms.length === 0 ? (
                <div className="text-center py-12">
                  <DoorOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Rooms Found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery ? "Try adjusting your search terms" : "No rooms have been added yet"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4 pr-4">
                  {Object.values(roomsByBuilding).map(({ building, floors: buildingFloors }) => (
                    <div key={building.id} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground sticky top-0 bg-background py-1">
                        <Building2 className="w-4 h-4 text-primary" />
                        {building.name}
                      </div>
                      
                      {Object.values(buildingFloors).map(({ floor, rooms: floorRooms }) => (
                        <div key={floor.id} className="ml-4 space-y-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Layers className="w-3 h-3" />
                            {floor.floorName || `Floor ${floor.floorNumber}`}
                          </div>
                          
                          <div className="grid gap-2 ml-4">
                            {floorRooms.map(room => (
                              <Card
                                key={room.id}
                                className="p-3 cursor-pointer hover-elevate active-elevate-2"
                                onClick={() => handleRoomSelect(room)}
                                data-testid={`room-card-${room.id}`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`w-3 h-3 rounded-full mt-1.5 ${getRoomTypeColor(room.type)}`} />
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-foreground truncate">{room.name}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="secondary" className="text-xs capitalize">
                                        {room.type}
                                      </Badge>
                                    </div>
                                    {room.description && (
                                      <p className="text-xs text-muted-foreground mt-1 truncate">
                                        {room.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="text-sm text-muted-foreground text-center pt-2 border-t" data-testid="text-room-count">
              {filteredRooms.length} room{filteredRooms.length !== 1 ? 's' : ''} found
            </div>
          </>
        ) : (
          <div className="space-y-6" data-testid="room-detail-view">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getRoomTypeColor(selectedRoom.type)}`}>
                <DoorOpen className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-foreground" data-testid="text-selected-room-name">{selectedRoom.name}</h3>
                <Badge variant="secondary" className="mt-1 capitalize" data-testid="badge-room-type">
                  {selectedRoom.type}
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-muted-foreground" data-testid="text-room-building">
                <Building2 className="w-5 h-5" />
                <span>{getBuildingName(selectedRoom.buildingId)}</span>
              </div>
              
              <div className="flex items-center gap-3 text-muted-foreground" data-testid="text-room-floor">
                <Layers className="w-5 h-5" />
                <span>{getFloorName(selectedRoom.floorId)}</span>
              </div>

              {selectedRoom.description && (
                <div className="flex items-start gap-3 text-muted-foreground">
                  <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{selectedRoom.description}</span>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t">
              {getFloor(selectedRoom.floorId)?.floorPlanImage && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleViewFloorPlan}
                  data-testid="button-view-floor-plan"
                >
                  <Layers className="w-4 h-4 mr-2" />
                  View Floor Plan
                </Button>
              )}
              
              <Button
                className="w-full"
                onClick={handleGetDirections}
                data-testid="button-room-get-directions"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Get Directions to Building
              </Button>
            </div>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setSelectedRoom(null)}
              data-testid="button-back-to-rooms"
            >
              Back to Room List
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
