import { X, MapPin, Users as UsersIcon, Layers, Navigation } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import type { Building, Staff, Floor } from "@shared/schema";
import { canHaveDepartments, canHaveFloorPlan, isDescriptionOnly } from "@shared/schema";
import { useState, useRef, useEffect } from "react";

interface BuildingInfoModalProps {
  building: Building;
  staff?: Staff[];
  floors?: Floor[];
  onClose: () => void;
  onOpenFloorPlan?: (floor: Floor) => void;
  onGetDirections?: () => void;
}

export default function BuildingInfoModal({
  building,
  staff = [],
  floors = [],
  onClose,
  onOpenFloorPlan,
  onGetDirections
}: BuildingInfoModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.modal-header')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card
        ref={modalRef}
        className="relative max-w-2xl w-full mx-4 shadow-2xl overflow-hidden z-[1001]"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        data-testid="modal-building-info"
      >
        <div
          className="modal-header bg-primary p-4 flex items-center justify-between cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-foreground/20 rounded-lg flex items-center justify-center">
              <MapPin className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-primary-foreground">{building.name}</h2>
              <p className="text-sm text-primary-foreground/80">Building Information</p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="text-primary-foreground hover:bg-primary-foreground/20"
            data-testid="button-close-modal"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start px-4 pt-4 bg-transparent">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            {!isDescriptionOnly(building.type as any) && (
              <TabsTrigger value="staff" data-testid="tab-staff">Staff</TabsTrigger>
            )}
            {canHaveFloorPlan(building.type as any) && (
              <TabsTrigger value="floors" data-testid="tab-floors">Floor Plans</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="p-6">
            {building.image && (
              <div className="w-full mb-4 rounded-lg bg-muted flex items-center justify-center">
                <img
                  src={building.image}
                  alt={building.name}
                  className="w-full h-auto object-contain max-h-[min(60vh,400px)]"
                />
              </div>
            )}

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">Description</h3>
                <p className="text-base text-muted-foreground">
                  {building.description || "No description available"}
                </p>
              </div>

              {canHaveDepartments(building.type as any) && (
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Departments</h3>
                  <div className="flex flex-wrap gap-2">
                    {building.departments && building.departments.length > 0 ? (
                      building.departments.map((dept, index) => (
                        <Badge key={index} variant="secondary">
                          {dept}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No departments listed</p>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Latitude</p>
                  <p className="text-base font-medium text-foreground">{building.lat.toFixed(6)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Longitude</p>
                  <p className="text-base font-medium text-foreground">{building.lng.toFixed(6)}</p>
                </div>
              </div>

              {onGetDirections && (
                <div className="pt-4">
                  <Button
                    className="w-full"
                    onClick={onGetDirections}
                    data-testid="button-get-directions"
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Get Directions
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {!isDescriptionOnly(building.type as any) && (
            <TabsContent value="staff" className="p-6">
              <div className="space-y-3">
                {staff.length > 0 ? (
                  staff.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover-elevate"
                      data-testid={`staff-card-${member.id}`}
                    >
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={member.photo || undefined} alt={member.name} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.position}</p>
                        {member.department && (
                          <p className="text-xs text-muted-foreground">{member.department}</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <UsersIcon className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No staff members assigned</p>
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {canHaveFloorPlan(building.type as any) && (
            <TabsContent value="floors" className="p-6">
              <div className="space-y-3">
                {floors.length > 0 ? (
                  floors.map((floor) => (
                    <div
                      key={floor.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover-elevate"
                      data-testid={`floor-card-${floor.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Layers className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {floor.floorName || `Floor ${floor.floorNumber}`}
                          </p>
                          <p className="text-sm text-muted-foreground">Level {floor.floorNumber}</p>
                        </div>
                      </div>
                      {onOpenFloorPlan && (
                        <Button
                          size="sm"
                          onClick={() => onOpenFloorPlan(floor)}
                          data-testid={`button-view-floor-${floor.id}`}
                        >
                          View Floor Plan
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No floor plans available</p>
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </Card>
    </div>
  );
}
