import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Route as RouteIcon, Plus, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/admin-layout";
import FloorPlanDrawingCanvas from "@/components/floor-plan-drawing-canvas";
import SearchableSelect from "@/components/searchable-select";
import type { Building, Floor, Room, IndoorNode, RoomPath, RoomPathWaypoint } from "@shared/schema";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function AdminRoomPaths() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<RoomPath | null>(null);
  const [deletingPath, setDeletingPath] = useState<RoomPath | null>(null);
  const [pathName, setPathName] = useState("");
  const [pathType, setPathType] = useState<string>("hallway");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [waypoints, setWaypoints] = useState<RoomPathWaypoint[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings']
  });

  const { data: floors = [] } = useQuery<Floor[]>({
    queryKey: ['/api/floors']
  });

  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ['/api/rooms']
  });

  const { data: indoorNodes = [] } = useQuery<IndoorNode[]>({
    queryKey: ['/api/indoor-nodes']
  });

  const { data: roomPaths = [] } = useQuery<RoomPath[]>({
    queryKey: ['/api/room-paths']
  });

  const buildingsWithFloorPlans = buildings.filter(b => {
    const buildingFloors = floors.filter(f => f.buildingId === b.id);
    return buildingFloors.some(f => f.floorPlanImage);
  });

  const floorsForBuilding = floors.filter(f => 
    f.buildingId === selectedBuildingId && f.floorPlanImage
  );

  const selectedFloor = floors.find(f => f.id === selectedFloorId);
  const roomsForFloor = rooms.filter(r => r.floorId === selectedFloorId);
  const nodesForFloor = indoorNodes.filter(n => n.floorId === selectedFloorId);
  const pathsForFloor = roomPaths.filter(p => p.floorId === selectedFloorId);

  const createRoomPath = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/room-paths', data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/room-paths'] });
      toast({ title: "Room path created successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Failed to create room path", variant: "destructive" });
    }
  });

  const updateRoomPath = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest('PUT', `/api/room-paths/${id}`, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/room-paths'] });
      toast({ title: "Room path updated successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Failed to update room path", variant: "destructive" });
    }
  });

  const deleteRoomPath = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/room-paths/${id}`, null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/room-paths'] });
      toast({ title: "Room path deleted successfully" });
      setDeletingPath(null);
    },
    onError: () => {
      toast({ title: "Failed to delete room path", variant: "destructive" });
    }
  });

  const handleOpenDialog = (path?: RoomPath) => {
    if (path) {
      setEditingPath(path);
      setPathName(path.name || "");
      setPathType(path.pathType || "hallway");
      setSelectedFloorId(path.floorId);
      const floor = floors.find(f => f.id === path.floorId);
      if (floor) {
        setSelectedBuildingId(floor.buildingId);
      }
      setWaypoints(Array.isArray(path.waypoints) ? path.waypoints as RoomPathWaypoint[] : []);
    } else {
      setEditingPath(null);
      setPathName("");
      setPathType("hallway");
      setWaypoints([]);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPath(null);
    setPathName("");
    setPathType("hallway");
    setWaypoints([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFloorId) {
      toast({ title: "Please select a floor", variant: "destructive" });
      return;
    }

    if (waypoints.length < 2) {
      toast({ title: "Please add at least 2 waypoints to create a path", variant: "destructive" });
      return;
    }

    const data = {
      floorId: selectedFloorId,
      name: pathName,
      waypoints: waypoints,
      pathType: pathType
    };

    if (editingPath) {
      updateRoomPath.mutate({ id: editingPath.id, data });
    } else {
      createRoomPath.mutate(data);
    }
  };

  const filteredPaths = roomPaths.filter(path => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (path.name?.toLowerCase().includes(searchLower)) ||
           (path.pathType?.toLowerCase().includes(searchLower));
  });

  const getFloorName = (floorId: string) => {
    const floor = floors.find(f => f.id === floorId);
    if (!floor) return 'Unknown Floor';
    const building = buildings.find(b => b.id === floor.buildingId);
    return `${building?.name || 'Unknown'} - ${floor.floorName || `Floor ${floor.floorNumber}`}`;
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Indoor Path Management</h1>
            <p className="text-muted-foreground">Create paths on floor plans for indoor navigation</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => open ? handleOpenDialog() : handleCloseDialog()}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-room-path">
                <Plus className="w-4 h-4 mr-2" />
                Add Room Path
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPath ? 'Edit' : 'Add'} Indoor Path</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Draw paths on the floor plan to connect rooms, entrances, and stairways
                </p>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="building">Building</Label>
                    <SearchableSelect
                      options={buildingsWithFloorPlans.map(b => ({ id: b.id, name: b.name }))}
                      selectedId={selectedBuildingId}
                      onSelect={(value) => {
                        setSelectedBuildingId(value);
                        setSelectedFloorId("");
                      }}
                      placeholder="Select building"
                      testId="select-building"
                    />
                  </div>
                  <div>
                    <Label htmlFor="floor">Floor</Label>
                    <SearchableSelect
                      options={floorsForBuilding.map(f => ({ id: f.id, name: f.floorName || `Floor ${f.floorNumber}` }))}
                      selectedId={selectedFloorId}
                      onSelect={setSelectedFloorId}
                      placeholder="Select floor"
                      testId="select-floor"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Path Name</Label>
                    <Input
                      id="name"
                      value={pathName}
                      onChange={(e) => setPathName(e.target.value)}
                      placeholder="e.g., Main Hallway, Room Corridor"
                      required
                      data-testid="input-path-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pathType">Path Type</Label>
                    <SearchableSelect
                      options={[
                        { id: 'hallway', name: 'Hallway' },
                        { id: 'corridor', name: 'Corridor' }
                      ]}
                      selectedId={pathType}
                      onSelect={setPathType}
                      placeholder="Select path type"
                      testId="select-path-type"
                    />
                  </div>
                </div>

                {selectedFloorId && selectedFloor?.floorPlanImage ? (
                  <div>
                    <Label>Draw Path on Floor Plan</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Click on the floor plan to add waypoints. Click on room/node markers to connect them.
                    </p>
                    <FloorPlanDrawingCanvas
                      floorPlanImage={selectedFloor.floorPlanImage}
                      waypoints={waypoints}
                      onWaypointsChange={setWaypoints}
                      rooms={roomsForFloor}
                      indoorNodes={nodesForFloor}
                      existingPaths={pathsForFloor}
                      currentPathId={editingPath?.id}
                      className="h-[400px]"
                    />
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center bg-muted rounded-lg border">
                    <p className="text-muted-foreground">
                      {!selectedBuildingId ? "Select a building first" : 
                       !selectedFloorId ? "Select a floor with a floor plan" :
                       "No floor plan available for this floor"}
                    </p>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={waypoints.length < 2 || !selectedFloorId}
                  data-testid="button-submit-path"
                >
                  {editingPath ? 'Update Path' : 'Create Path'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-4">
          <Input
            placeholder="Search paths..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
            data-testid="input-search-paths"
          />
        </div>

        {filteredPaths.length === 0 ? (
          <Card className="p-8 text-center">
            <RouteIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Indoor Paths Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create indoor paths to enable room-level navigation
            </p>
            <Button onClick={() => handleOpenDialog()} data-testid="button-create-first-path">
              <Plus className="w-4 h-4 mr-2" />
              Create First Path
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPaths.map(path => (
              <Card key={path.id} className="p-4" data-testid={`card-room-path-${path.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{path.name || 'Unnamed Path'}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {getFloorName(path.floorId)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-1 bg-muted rounded">
                        {path.pathType}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {(path.waypoints as RoomPathWaypoint[])?.length || 0} waypoints
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenDialog(path)}
                      data-testid={`button-edit-path-${path.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeletingPath(path)}
                      data-testid={`button-delete-path-${path.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <AlertDialog open={!!deletingPath} onOpenChange={() => setDeletingPath(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Path</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingPath?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingPath && deleteRoomPath.mutate(deletingPath.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
