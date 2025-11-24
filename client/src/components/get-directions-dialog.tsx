import React from "react";
import { Navigation, Car, Bike, Plus, X, GripVertical, MapPin, Clock } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import SearchableStartingPointSelect from "./searchable-starting-point-select";
import SearchableDestinationSelect from "./searchable-destination-select";
import type { Building, VehicleType } from "@shared/schema";
import { KIOSK_LOCATION } from "@shared/schema";
import { calculateETA, parseDistance } from "@/lib/eta-calculator";

interface GetDirectionsDialogProps {
  open: boolean;
  destination: Building | null;
  buildings: Building[];
  onClose: () => void;
  onNavigate: (startId: string, waypointIds: string[], mode: 'walking' | 'driving', vehicleType?: VehicleType) => void;
}

export default function GetDirectionsDialog({
  open,
  destination,
  buildings,
  onClose,
  onNavigate
}: GetDirectionsDialogProps) {
  const [selectedStart, setSelectedStart] = React.useState<string>("kiosk");
  const [waypoints, setWaypoints] = React.useState<string[]>([]);
  const [mode, setMode] = React.useState<'walking' | 'driving'>('walking');
  const [showVehicleSelector, setShowVehicleSelector] = React.useState(false);
  const [selectedVehicle, setSelectedVehicle] = React.useState<VehicleType | null>(null);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedVehicle(null);
      setShowVehicleSelector(false);
      setSelectedStart("kiosk");
      setWaypoints([]);
    }
  }, [open, destination]);

  const handleAddWaypoint = () => {
    setWaypoints([...waypoints, '']);
  };

  const handleRemoveWaypoint = (index: number) => {
    setWaypoints(waypoints.filter((_, i) => i !== index));
  };

  const handleWaypointChange = (index: number, buildingId: string) => {
    const newWaypoints = [...waypoints];
    newWaypoints[index] = buildingId;
    setWaypoints(newWaypoints);
  };

  const handleMoveWaypoint = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === waypoints.length - 1)
    ) {
      return;
    }

    const newWaypoints = [...waypoints];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newWaypoints[index], newWaypoints[targetIndex]] = [newWaypoints[targetIndex], newWaypoints[index]];
    setWaypoints(newWaypoints);
  };

  const handleNavigate = () => {
    if (selectedStart) {
      // Filter out empty waypoints
      const validWaypoints = waypoints.filter(w => w !== '');
      
      if (mode === 'driving' && !selectedVehicle) {
        setShowVehicleSelector(true);
      } else {
        onNavigate(selectedStart, validWaypoints, mode, selectedVehicle || undefined);
        onClose();
      }
    }
  };

  const handleVehicleSelection = (vehicle: VehicleType) => {
    setSelectedVehicle(vehicle);
    setShowVehicleSelector(false);
    const validWaypoints = waypoints.filter(w => w !== '');
    onNavigate(selectedStart, validWaypoints, mode, vehicle);
    onClose();
  };

  // Get list of building IDs to exclude from dropdowns
  const getExcludedIds = (currentIndex?: number) => {
    const excluded = [destination?.id, selectedStart];
    waypoints.forEach((w, i) => {
      if (i !== currentIndex && w) {
        excluded.push(w);
      }
    });
    return excluded.filter(Boolean) as string[];
  };

  const getBuildingName = (id: string) => {
    if (id === 'kiosk') return 'Your Location (Kiosk)';
    return buildings.find(b => b.id === id)?.name || '';
  };

  // Calculate distance between two buildings
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Get estimated time for current route
  const getEstimatedTime = (): string | null => {
    if (!selectedStart || !destination) return null;

    const startBuilding = selectedStart === 'kiosk'
      ? KIOSK_LOCATION
      : buildings.find(b => b.id === selectedStart);

    if (!startBuilding) return null;

    const distanceMeters = calculateDistance(
      startBuilding.lat,
      startBuilding.lng,
      destination.lat,
      destination.lng
    );

    return calculateETA(distanceMeters, mode);
  };

  const estimatedTime = getEstimatedTime();

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-get-directions">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              Get Directions
            </DialogTitle>
            <DialogDescription>
              Plan your route to {destination?.name}. Add stops along the way if needed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {/* Starting Point */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Starting Point
              </label>
              <SearchableStartingPointSelect
                selectedId={selectedStart}
                onSelect={setSelectedStart}
                buildings={buildings}
                excludeBuildingId={destination?.id}
                testId="select-dialog-start"
              />
            </div>

            {/* Waypoints */}
            {waypoints.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Stops ({waypoints.length})
                </label>
                {waypoints.map((waypointId, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => handleMoveWaypoint(index, 'up')}
                        disabled={index === 0}
                        data-testid={`button-waypoint-up-${index}`}
                      >
                        <GripVertical className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => handleMoveWaypoint(index, 'down')}
                        disabled={index === waypoints.length - 1}
                        data-testid={`button-waypoint-down-${index}`}
                      >
                        <GripVertical className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex-1">
                      <SearchableDestinationSelect
                        selectedId={waypointId}
                        onSelect={(id) => handleWaypointChange(index, id)}
                        buildings={buildings}
                        excludeBuildingId={getExcludedIds(index)[0] || ''}
                        placeholder={`Stop ${index + 1}`}
                        testId={`select-waypoint-${index}`}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveWaypoint(index)}
                      data-testid={`button-remove-waypoint-${index}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Waypoint Button */}
            <Button
              variant="outline"
              onClick={handleAddWaypoint}
              className="w-full"
              data-testid="button-add-waypoint"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Stop
            </Button>

            {/* Destination (read-only display) */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Destination
              </label>
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted text-foreground">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>{destination?.name}</span>
              </div>
            </div>

            {/* Travel Mode */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Travel Mode
              </label>
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'walking' | 'driving')}>
                <TabsList className="w-full">
                  <TabsTrigger value="walking" className="flex-1" data-testid="dialog-tab-walking">
                    Walking
                  </TabsTrigger>
                  <TabsTrigger value="driving" className="flex-1" data-testid="dialog-tab-driving">
                    Driving
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              {/* Estimated Time */}
              {estimatedTime && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                  <Clock className="w-4 h-4" />
                  <span>Estimated time: <span className="font-semibold text-foreground">{estimatedTime}</span></span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
                data-testid="button-dialog-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleNavigate}
                disabled={!selectedStart}
                className="flex-1"
                data-testid="button-dialog-navigate"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Navigate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vehicle Selector Dialog */}
      <Dialog open={showVehicleSelector} onOpenChange={setShowVehicleSelector}>
        <DialogContent className="sm:max-w-md z-[9999]" data-testid="dialog-directions-vehicle-selector">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="w-5 h-5" />
              Choose Your Vehicle
            </DialogTitle>
            <DialogDescription>
              Select the vehicle you'll be using to reach {destination?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-4 pt-4">
            <Button
              variant="outline"
              className="h-28 flex flex-col gap-2 hover-elevate active-elevate-2"
              onClick={() => handleVehicleSelection('car')}
              data-testid="button-directions-vehicle-car"
            >
              <Car className="w-8 h-8" />
              <span className="font-semibold">Car</span>
            </Button>

            <Button
              variant="outline"
              className="h-28 flex flex-col gap-2 hover-elevate active-elevate-2"
              onClick={() => handleVehicleSelection('motorcycle')}
              data-testid="button-directions-vehicle-motorcycle"
            >
              <Bike className="w-8 h-8" />
              <span className="font-semibold">Motorcycle</span>
            </Button>

            <Button
              variant="outline"
              className="h-28 flex flex-col gap-2 hover-elevate active-elevate-2"
              onClick={() => handleVehicleSelection('bike')}
              data-testid="button-directions-vehicle-bike"
            >
              <Bike className="w-8 h-8" />
              <span className="font-semibold">Bike</span>
            </Button>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowVehicleSelector(false)}
              className="flex-1"
              data-testid="button-directions-vehicle-cancel"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
