import { useState, useMemo, useEffect } from "react";
import { Search, MapPin, Navigation, DoorOpen, Building2, Layers, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VirtualKeyboardInput } from "./virtual-keyboard-input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import type { Room, Floor, Building, IndoorNode } from "@shared/schema";
import { trackEvent } from "@/lib/analytics-tracker";
import { AnalyticsEventType } from "@shared/analytics-schema";

interface CombinedRoom {
  id: string;
  name: string;
  type: string;
  description: string | null;
  floorId: string;
  buildingId: string;
  x: number;
  y: number;
  isIndoorNode?: boolean;
}

interface RoomFinderDialogProps {
  open: boolean;
  onClose: () => void;
  rooms: Room[];
  floors: Floor[];
  buildings: Building[];
  indoorNodes?: IndoorNode[];
  onGetDirections: (buildingId: string, roomId?: string) => void;
  onViewFloorPlan: (floor: Floor, rooms: CombinedRoom[]) => void;
}

export default function RoomFinderDialog({
  open,
  onClose,
  rooms,
  floors,
  buildings,
  indoorNodes = [],
  onGetDirections,
  onViewFloorPlan
}: RoomFinderDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<CombinedRoom | null>(null);
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set());
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());

  const toggleBuildingExpanded = (id: string) => {
    const newSet = new Set(expandedBuildings);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedBuildings(newSet);
  };

  const toggleFloorExpanded = (id: string) => {
    const newSet = new Set(expandedFloors);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedFloors(newSet);
  };

  // Show ONLY indoor node rooms (not old rooms table)
  const allRooms = useMemo(() => {
    const combined: CombinedRoom[] = indoorNodes
      .filter(n => n.type === 'room')
      .map(n => ({
        id: n.id,
        name: n.label || 'Unnamed Room',
        type: 'room',
        description: n.description || null,
        floorId: n.floorId,
        buildingId: floors.find(f => f.id === n.floorId)?.buildingId || '',
        x: n.x || 0,
        y: n.y || 0,
        isIndoorNode: true
      }));
    return combined;
  }, [indoorNodes, floors]);

  useEffect(() => {
    if (open) {
      trackEvent(AnalyticsEventType.INTERFACE_ACTION, 1, {
        action: 'room_finder_opened',
        totalRooms: allRooms.length
      });
    }
  }, [open, allRooms.length]);

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
    return allRooms.filter(r => r.floorId === floorId);
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
    if (!searchQuery.trim()) return allRooms;
    
    const query = searchQuery.toLowerCase();
    return allRooms.filter(room => 
      room.name.toLowerCase().includes(query) ||
      room.type.toLowerCase().includes(query) ||
      room.description?.toLowerCase().includes(query) ||
      getBuildingName(room.buildingId).toLowerCase().includes(query) ||
      getFloorName(room.floorId).toLowerCase().includes(query)
    );
  }, [allRooms, searchQuery, buildings, floors]);

  const roomsByBuilding = useMemo(() => {
    const grouped: Record<string, { building: Building; floors: Record<string, { floor: Floor; rooms: CombinedRoom[] }> }> = {};
    
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

  const handleRoomSelect = (room: CombinedRoom) => {
    setSelectedRoom(room);
    trackEvent(AnalyticsEventType.INTERFACE_ACTION, 1, {
      action: 'room_selected',
      roomId: room.id,
      roomName: room.name,
      buildingId: room.buildingId,
      isIndoorNode: room.isIndoorNode
    });
  };

  const handleGetDirections = () => {
    if (selectedRoom) {
      trackEvent(AnalyticsEventType.INTERFACE_ACTION, 1, {
        action: 'room_get_directions',
        roomId: selectedRoom.id,
        roomName: selectedRoom.name,
        buildingId: selectedRoom.buildingId,
        isIndoorNode: selectedRoom.isIndoorNode
      });
      const buildingId = selectedRoom.buildingId;
      const roomId = selectedRoom.id;
      setSearchQuery("");
      setSelectedRoom(null);
      onGetDirections(buildingId, roomId);
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
          floorId: floor.id,
          isIndoorNode: selectedRoom.isIndoorNode
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
              <VirtualKeyboardInput
                placeholder="Search rooms by name, type, or building..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery("")}
                data-testid="input-search-rooms"
              />
            </div>

            <ScrollArea className="flex-1 h-[50vh] overflow-y-auto" data-testid="scroll-room-list">
              {filteredRooms.length === 0 ? (
                <div className="text-center py-12">
                  <DoorOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Rooms Found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery ? "Try adjusting your search terms" : "No rooms have been added yet"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pr-4 pb-4">
                  {Object.values(roomsByBuilding).map(({ building, floors: buildingFloors }) => {
                    const buildingExpanded = expandedBuildings.has(building.id);
                    const buildingRoomCount = Object.values(buildingFloors).reduce((sum, f) => sum + f.rooms.length, 0);
                    
                    return (
                      <div key={building.id}>
                        <Card 
                          className="p-3 cursor-pointer hover-elevate"
                          onClick={() => toggleBuildingExpanded(building.id)}
                          data-testid={`card-building-${building.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ChevronDown className={`w-4 h-4 transition-transform ${buildingExpanded ? '' : '-rotate-90'}`} />
                              <Building2 className="w-4 h-4 text-primary" />
                              <span className="font-medium">{building.name}</span>
                              <span className="text-xs text-muted-foreground">({buildingRoomCount})</span>
                            </div>
                          </div>
                        </Card>

                        {buildingExpanded && (
                          <div className="ml-4 mt-2 space-y-2 pl-4 border-l">
                            {Object.values(buildingFloors).map(({ floor, rooms: floorRooms }) => {
                              const floorExpanded = expandedFloors.has(floor.id);
                              
                              return (
                                <div key={floor.id}>
                                  <Card
                                    className="p-2 cursor-pointer hover-elevate"
                                    onClick={() => toggleFloorExpanded(floor.id)}
                                    data-testid={`card-floor-${floor.id}`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <ChevronDown className={`w-4 h-4 transition-transform ${floorExpanded ? '' : '-rotate-90'}`} />
                                        <Layers className="w-4 h-4" />
                                        <span className="text-sm font-medium">{floor.floorName || `Floor ${floor.floorNumber}`}</span>
                                        <span className="text-xs text-muted-foreground">({floorRooms.length})</span>
                                      </div>
                                    </div>
                                  </Card>

                                  {floorExpanded && (
                                    <div className="ml-4 mt-2 space-y-2 pl-4 border-l">
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
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                <Badge variant="secondary" className="capitalize" data-testid="badge-room-type">
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
                Get Directions to Room
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
