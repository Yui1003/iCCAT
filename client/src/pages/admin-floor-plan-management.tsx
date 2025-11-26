import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Route as RouteIcon, Plus, Pencil, Trash2, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/admin-layout";
import FloorPlanDrawingCanvas from "@/components/floor-plan-drawing-canvas";
import SearchableSelect from "@/components/searchable-select";
import FloorPlanNodePlacer from "@/components/floor-plan-node-placer";
import type { Building, Floor, Room, IndoorNode, RoomPath, RoomPathWaypoint } from "@shared/schema";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminFloorPlanManagement() {
  const [tab, setTab] = useState<"paths" | "nodes">("paths");
  const [pathDialogOpen, setPathDialogOpen] = useState(false);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<RoomPath | null>(null);
  const [editingNode, setEditingNode] = useState<IndoorNode | null>(null);
  const [deletingPath, setDeletingPath] = useState<RoomPath | null>(null);
  const [deletingNode, setDeletingNode] = useState<IndoorNode | null>(null);

  // Path states
  const [pathName, setPathName] = useState("");
  const [pathType, setPathType] = useState<string>("hallway");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [waypoints, setWaypoints] = useState<RoomPathWaypoint[]>([]);
  const [pathSearchTerm, setPathSearchTerm] = useState("");

  // Node states
  const [nodeSelectedBuildingId, setNodeSelectedBuildingId] = useState<string>("");
  const [nodeSelectedFloorId, setNodeSelectedFloorId] = useState<string>("");
  const [nodeType, setNodeType] = useState<string>("entrance");
  const [nodeLabel, setNodeLabel] = useState("");
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const [connectedFloorIds, setConnectedFloorIds] = useState<string[]>([]);
  const [nodeSearchTerm, setNodeSearchTerm] = useState("");

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

  // Path queries
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

  // Node queries
  const nodeFloorsForBuilding = floors.filter(f => f.buildingId === nodeSelectedBuildingId);
  const selectedNodeFloor = floors.find(f => f.id === nodeSelectedFloorId);
  const nodesForNodeFloor = indoorNodes.filter(n => n.floorId === nodeSelectedFloorId);

  // Path mutations
  const createRoomPath = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/room-paths', data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/room-paths'] });
      toast({ title: "Room path created successfully" });
      handleClosePathDialog();
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
      handleClosePathDialog();
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

  // Node mutations
  const createIndoorNode = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/indoor-nodes', data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/indoor-nodes'] });
      toast({ title: "Indoor node created successfully" });
      handleCloseNodeDialog();
    },
    onError: () => {
      toast({ title: "Failed to create indoor node", variant: "destructive" });
    }
  });

  const updateIndoorNode = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest('PUT', `/api/indoor-nodes/${id}`, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/indoor-nodes'] });
      toast({ title: "Indoor node updated successfully" });
      handleCloseNodeDialog();
    },
    onError: () => {
      toast({ title: "Failed to update indoor node", variant: "destructive" });
    }
  });

  const deleteIndoorNode = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/indoor-nodes/${id}`, null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/indoor-nodes'] });
      toast({ title: "Indoor node deleted successfully" });
      setDeletingNode(null);
    },
    onError: () => {
      toast({ title: "Failed to delete indoor node", variant: "destructive" });
    }
  });

  // Path handlers
  const handleOpenPathDialog = (path?: RoomPath) => {
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
    setPathDialogOpen(true);
  };

  const handleClosePathDialog = () => {
    setPathDialogOpen(false);
    setEditingPath(null);
    setPathName("");
    setPathType("hallway");
    setWaypoints([]);
  };

  const handlePathSubmit = (e: React.FormEvent) => {
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

  // Node handlers
  const handleOpenNodeDialog = (node?: IndoorNode) => {
    if (node) {
      setEditingNode(node);
      setNodeSelectedFloorId(node.floorId);
      const floor = floors.find(f => f.id === node.floorId);
      if (floor) {
        setNodeSelectedBuildingId(floor.buildingId);
      }
      setNodeType(node.type);
      setNodeLabel(node.label || "");
      setX(node.x.toString());
      setY(node.y.toString());
      setConnectedFloorIds(node.connectedFloorIds || []);
    } else {
      setEditingNode(null);
      setNodeSelectedBuildingId("");
      setNodeSelectedFloorId("");
      setNodeType("entrance");
      setNodeLabel("");
      setX("");
      setY("");
      setConnectedFloorIds([]);
    }
    setNodeDialogOpen(true);
  };

  const handleCloseNodeDialog = () => {
    setNodeDialogOpen(false);
    setEditingNode(null);
    setNodeSelectedBuildingId("");
    setNodeSelectedFloorId("");
    setNodeType("entrance");
    setNodeLabel("");
    setX("");
    setY("");
    setConnectedFloorIds([]);
  };

  const handleNodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeSelectedFloorId || !x || !y) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const data = {
      floorId: nodeSelectedFloorId,
      type: nodeType,
      label: nodeLabel,
      x: parseFloat(x),
      y: parseFloat(y),
      connectedFloorIds: connectedFloorIds
    };

    if (editingNode) {
      updateIndoorNode.mutate({ id: editingNode.id, data });
    } else {
      createIndoorNode.mutate(data);
    }
  };

  const getFloorName = (floorId: string) => {
    const floor = floors.find(f => f.id === floorId);
    if (!floor) return 'Unknown Floor';
    const building = buildings.find(b => b.id === floor.buildingId);
    return `${building?.name || 'Unknown'} - ${floor.floorName || `Floor ${floor.floorNumber}`}`;
  };

  const filteredPaths = roomPaths.filter(path => {
    if (!pathSearchTerm) return true;
    const searchLower = pathSearchTerm.toLowerCase();
    return (path.name?.toLowerCase().includes(searchLower)) ||
           (path.pathType?.toLowerCase().includes(searchLower));
  });

  const filteredNodes = indoorNodes.filter(node => {
    if (!nodeSearchTerm) return true;
    const searchLower = nodeSearchTerm.toLowerCase();
    return (node.label?.toLowerCase().includes(searchLower)) ||
           (node.type?.toLowerCase().includes(searchLower));
  });

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Floor Plan Management</h1>
          <p className="text-muted-foreground">Create paths and nodes on floor plans for indoor navigation</p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "paths" | "nodes")} className="space-y-4">
          <TabsList>
            <TabsTrigger value="paths">Indoor Paths</TabsTrigger>
            <TabsTrigger value="nodes">Indoor Nodes</TabsTrigger>
          </TabsList>

          <TabsContent value="paths" className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <Input
                placeholder="Search paths..."
                value={pathSearchTerm}
                onChange={(e) => setPathSearchTerm(e.target.value)}
                className="max-w-sm"
                data-testid="input-search-paths"
              />
              <Dialog open={pathDialogOpen} onOpenChange={(open) => open ? handleOpenPathDialog() : handleClosePathDialog()}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-room-path">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Path
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingPath ? 'Edit' : 'Add'} Indoor Path</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      Draw paths on the floor plan to connect rooms, entrances, and stairways
                    </p>
                  </DialogHeader>
                  <form onSubmit={handlePathSubmit} className="space-y-4">
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
                          Click on the floor plan to add waypoints. Rooms (blue) and nodes (colored) are shown. Click markers to connect.
                        </p>
                        <FloorPlanDrawingCanvas
                          floorPlanImage={selectedFloor.floorPlanImage}
                          waypoints={waypoints}
                          onWaypointsChange={setWaypoints}
                          rooms={roomsForFloor}
                          indoorNodes={nodesForFloor}
                          existingPaths={pathsForFloor}
                          currentPathId={editingPath?.id}
                          className="h-[600px] w-full border rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center bg-muted rounded-lg border">
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

            {filteredPaths.length === 0 ? (
              <Card className="p-8 text-center">
                <RouteIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Indoor Paths Yet</h3>
                <p className="text-muted-foreground mb-4">Create paths to enable room-level navigation</p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredPaths.map(path => (
                  <Card key={path.id} className="p-4" data-testid={`card-room-path-${path.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{path.name || 'Unnamed Path'}</h3>
                        <p className="text-sm text-muted-foreground truncate">{getFloorName(path.floorId)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs px-2 py-1 bg-muted rounded">{path.pathType}</span>
                          <span className="text-xs text-muted-foreground">
                            {(path.waypoints as RoomPathWaypoint[])?.length || 0} waypoints
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleOpenPathDialog(path)} data-testid={`button-edit-path-${path.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeletingPath(path)} data-testid={`button-delete-path-${path.id}`}>
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
                  <AlertDialogAction onClick={() => deletingPath && deleteRoomPath.mutate(deletingPath.id)}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

          <TabsContent value="nodes" className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <Input
                placeholder="Search nodes..."
                value={nodeSearchTerm}
                onChange={(e) => setNodeSearchTerm(e.target.value)}
                className="max-w-sm"
                data-testid="input-search-nodes"
              />
              <Dialog open={nodeDialogOpen} onOpenChange={(open) => open ? handleOpenNodeDialog() : handleCloseNodeDialog()}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-indoor-node">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Node
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingNode ? 'Edit' : 'Add'} Indoor Node</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      Create entrance, stairway, or elevator nodes to connect indoor paths
                    </p>
                  </DialogHeader>
                  <form onSubmit={handleNodeSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Building</Label>
                        <SearchableSelect
                          options={buildings.map(b => ({ id: b.id, name: b.name }))}
                          selectedId={nodeSelectedBuildingId}
                          onSelect={(value) => {
                            setNodeSelectedBuildingId(value);
                            setNodeSelectedFloorId("");
                          }}
                          placeholder="Select building"
                          testId="select-node-building"
                        />
                      </div>
                      <div>
                        <Label>Floor</Label>
                        <SearchableSelect
                          options={nodeFloorsForBuilding.map(f => ({ id: f.id, name: f.floorName || `Floor ${f.floorNumber}` }))}
                          selectedId={nodeSelectedFloorId}
                          onSelect={setNodeSelectedFloorId}
                          placeholder="Select floor"
                          testId="select-node-floor"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Node Type</Label>
                        <SearchableSelect
                          options={[
                            { id: 'entrance', name: 'Entrance' },
                            { id: 'stairway', name: 'Stairway' },
                            { id: 'elevator', name: 'Elevator' }
                          ]}
                          selectedId={nodeType}
                          onSelect={setNodeType}
                          placeholder="Select type"
                          testId="select-node-type"
                        />
                      </div>
                      <div>
                        <Label htmlFor="label">Label</Label>
                        <Input
                          id="label"
                          value={nodeLabel}
                          onChange={(e) => setNodeLabel(e.target.value)}
                          placeholder="e.g., Main Entrance"
                          data-testid="input-node-label"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="x">X Coordinate</Label>
                        <Input
                          id="x"
                          type="number"
                          value={x}
                          onChange={(e) => setX(e.target.value)}
                          placeholder="0"
                          required
                          data-testid="input-node-x"
                        />
                      </div>
                      <div>
                        <Label htmlFor="y">Y Coordinate</Label>
                        <Input
                          id="y"
                          type="number"
                          value={y}
                          onChange={(e) => setY(e.target.value)}
                          placeholder="0"
                          required
                          data-testid="input-node-y"
                        />
                      </div>
                    </div>

                    {nodeSelectedFloorId && selectedNodeFloor?.floorPlanImage ? (
                      <div>
                        <Label>Place Node on Floor Plan</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Click on the floor plan to place the node. Rooms (blue R) and existing nodes are shown.
                        </p>
                        <FloorPlanNodePlacer
                          floorPlanImage={selectedNodeFloor.floorPlanImage}
                          x={x ? parseFloat(x) : null}
                          y={y ? parseFloat(y) : null}
                          onCoordinatesChange={(coordX, coordY) => {
                            setX(coordX.toString());
                            setY(coordY.toString());
                          }}
                          rooms={rooms.filter(r => r.floorId === nodeSelectedFloorId)}
                          existingNodes={indoorNodes.filter(n => n.floorId === nodeSelectedFloorId && n.id !== editingNode?.id)}
                          currentFloorId={nodeSelectedFloorId}
                          className="h-[400px] border rounded-lg"
                        />
                      </div>
                    ) : nodeSelectedFloorId ? (
                      <div className="h-[200px] flex items-center justify-center bg-muted rounded-lg border">
                        <p className="text-muted-foreground">No floor plan available for this floor</p>
                      </div>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center bg-muted rounded-lg border">
                        <p className="text-muted-foreground">Select a floor to see the floor plan</p>
                      </div>
                    )}

                    {(nodeType === 'stairway' || nodeType === 'elevator') && (
                      <div>
                        <Label>Connected Floors</Label>
                        <div className="space-y-2">
                          {nodeFloorsForBuilding.filter(f => f.id !== nodeSelectedFloorId).map(floor => (
                            <div key={floor.id} className="flex items-center gap-2">
                              <Checkbox
                                id={floor.id}
                                checked={connectedFloorIds.includes(floor.id)}
                                onCheckedChange={(checked) => {
                                  setConnectedFloorIds(
                                    checked
                                      ? [...connectedFloorIds, floor.id]
                                      : connectedFloorIds.filter(id => id !== floor.id)
                                  );
                                }}
                                data-testid={`checkbox-floor-${floor.id}`}
                              />
                              <Label htmlFor={floor.id} className="text-sm cursor-pointer">
                                {floor.floorName || `Floor ${floor.floorNumber}`}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button type="submit" className="w-full" data-testid="button-submit-node">
                      {editingNode ? 'Update Node' : 'Create Node'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {filteredNodes.length === 0 ? (
              <Card className="p-8 text-center">
                <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Indoor Nodes Yet</h3>
                <p className="text-muted-foreground mb-4">Create nodes to enable multi-floor and entry point navigation</p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredNodes.map(node => (
                  <Card key={node.id} className="p-4" data-testid={`card-indoor-node-${node.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold">{node.label || node.type}</h3>
                        <p className="text-sm text-muted-foreground">{getFloorName(node.floorId)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs px-2 py-1 bg-muted rounded capitalize">{node.type}</span>
                          <span className="text-xs text-muted-foreground">
                            ({node.x}, {node.y})
                          </span>
                        </div>
                        {node.connectedFloorIds && node.connectedFloorIds.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Connects to {node.connectedFloorIds.length} floor(s)
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleOpenNodeDialog(node)} data-testid={`button-edit-node-${node.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeletingNode(node)} data-testid={`button-delete-node-${node.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <AlertDialog open={!!deletingNode} onOpenChange={() => setDeletingNode(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Node</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this indoor node? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deletingNode && deleteIndoorNode.mutate(deletingNode.id)}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
