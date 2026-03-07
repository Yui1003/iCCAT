import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Route as RouteIcon, Plus, Pencil, Trash2, Zap, ChevronDown, Building2, MapPin, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/admin-layout";
import FloorPlanDrawingCanvas from "@/components/floor-plan-drawing-canvas";
import SearchableSelect from "@/components/searchable-select";
import FloorPlanNodePlacer from "@/components/floor-plan-node-placer";
import ImageUploadInput from "@/components/image-upload-input";
import type { Building, Floor, Room, IndoorNode, RoomPath, RoomPathWaypoint } from "@shared/schema";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STANDARD_NODE_TYPES = ['entrance', 'room', 'stairway', 'elevator'];

export default function AdminFloorPlanManagement() {
  const [tab, setTab] = useState<"paths" | "nodes">("paths");
  const [pathDialogOpen, setPathDialogOpen] = useState(false);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<RoomPath | null>(null);
  const [editingNode, setEditingNode] = useState<IndoorNode | null>(null);
  const [deletingPath, setDeletingPath] = useState<RoomPath | null>(null);
  const [deletingNode, setDeletingNode] = useState<IndoorNode | null>(null);

  // Path dialog states
  const [pathName, setPathName] = useState("");
  const [pathType, setPathType] = useState<string>("hallway");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [waypoints, setWaypoints] = useState<RoomPathWaypoint[]>([]);

  // List view navigation states
  const [pathsExpandedBuildings, setPathsExpandedBuildings] = useState<Set<string>>(new Set());
  const [pathsExpandedFloors, setPathsExpandedFloors] = useState<Set<string>>(new Set());
  const [nodesExpandedBuildings, setNodesExpandedBuildings] = useState<Set<string>>(new Set());
  const [nodesExpandedFloors, setNodesExpandedFloors] = useState<Set<string>>(new Set());
  const [buildingPathSearch, setBuildingPathSearch] = useState("");
  const [buildingNodeSearch, setBuildingNodeSearch] = useState("");

  // Node dialog states
  const [nodeSelectedBuildingId, setNodeSelectedBuildingId] = useState<string>("");
  const [nodeSelectedFloorId, setNodeSelectedFloorId] = useState<string>("");
  const [nodeType, setNodeType] = useState<string>("entrance");
  const [customTypeInput, setCustomTypeInput] = useState("");
  const [nodeLabel, setNodeLabel] = useState("");
  const [nodeDescription, setNodeDescription] = useState("");
  const [nodeCategory, setNodeCategory] = useState("");
  const [nodeImageUrl, setNodeImageUrl] = useState("");
  const [nodeLabelX, setNodeLabelX] = useState<number | null>(null);
  const [nodeLabelY, setNodeLabelY] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const [connectedFloorIds, setConnectedFloorIds] = useState<string[]>([]);
  const [pairedNodeId, setPairedNodeId] = useState<string>("");

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

  const existingCategories = useMemo(() =>
    [...new Set(indoorNodes.filter(n => n.type === 'room' && n.category).map(n => n.category as string))],
    [indoorNodes]
  );

  const existingCustomTypes = useMemo(() =>
    [...new Set(indoorNodes.filter(n => !STANDARD_NODE_TYPES.includes(n.type)).map(n => n.type))],
    [indoorNodes]
  );

  const isRoomLike = !['entrance', 'stairway', 'elevator'].includes(nodeType);

  // Path queries
  const buildingsWithFloorPlans = buildings.filter(b => {
    const buildingFloors = floors.filter(f => f.buildingId === b.id);
    return buildingFloors.some(f => f.floorPlanImage);
  }).sort((a, b) => a.name.localeCompare(b.name));

  // Buildings with paths/nodes for list views
  const buildingsWithPaths = buildings.filter(b => {
    const buildingFloors = floors.filter(f => f.buildingId === b.id);
    return buildingFloors.some(f => roomPaths.some(p => p.floorId === f.id));
  }).sort((a, b) => a.name.localeCompare(b.name));

  const buildingsWithNodes = buildings.filter(b => {
    const buildingFloors = floors.filter(f => f.buildingId === b.id);
    return buildingFloors.some(f => indoorNodes.some(n => n.floorId === f.id));
  }).sort((a, b) => a.name.localeCompare(b.name));

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
    setSelectedBuildingId("");
    setSelectedFloorId("");
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
      setCustomTypeInput('');
      setNodeLabel(node.label || "");
      setNodeDescription(node.description || "");
      setNodeCategory((node as any).category || "");
      setNodeImageUrl((node as any).imageUrl || "");
      setNodeLabelX((node as any).labelX ?? null);
      setNodeLabelY((node as any).labelY ?? null);
      setX(node.x.toString());
      setY(node.y.toString());
      setConnectedFloorIds(node.connectedFloorIds || []);
      setPairedNodeId((node as any).pairedNodeId || "");
    } else {
      setEditingNode(null);
      setNodeSelectedBuildingId("");
      setNodeSelectedFloorId("");
      setNodeType("entrance");
      setCustomTypeInput('');
      setNodeLabel("");
      setNodeDescription("");
      setNodeCategory("");
      setNodeImageUrl("");
      setNodeLabelX(null);
      setNodeLabelY(null);
      setX("");
      setY("");
      setConnectedFloorIds([]);
      setPairedNodeId("");
    }
    setNodeDialogOpen(true);
  };

  const handleCloseNodeDialog = () => {
    setNodeDialogOpen(false);
    setEditingNode(null);
    setNodeSelectedBuildingId("");
    setNodeSelectedFloorId("");
    setNodeType("entrance");
    setCustomTypeInput('');
    setNodeLabel("");
    setNodeDescription("");
    setNodeCategory("");
    setNodeImageUrl("");
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
    if (nodeType === '__custom__' && !customTypeInput.trim()) {
      toast({ title: "Please enter a custom type name", variant: "destructive" });
      return;
    }

    const resolvedType = nodeType === '__custom__' ? customTypeInput.trim() : nodeType;

    const data = {
      floorId: nodeSelectedFloorId,
      type: resolvedType,
      label: nodeLabel,
      description: nodeDescription || null,
      category: nodeCategory || null,
      imageUrl: nodeImageUrl || null,
      labelX: nodeLabelX,
      labelY: nodeLabelY,
      x: parseFloat(x),
      y: parseFloat(y),
      connectedFloorIds: connectedFloorIds,
      pairedNodeId: pairedNodeId || null
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

  const togglePathBuildingExpanded = (id: string) => {
    const newSet = new Set(pathsExpandedBuildings);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setPathsExpandedBuildings(newSet);
  };

  const togglePathFloorExpanded = (id: string) => {
    const newSet = new Set(pathsExpandedFloors);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setPathsExpandedFloors(newSet);
  };

  const toggleNodeBuildingExpanded = (id: string) => {
    const newSet = new Set(nodesExpandedBuildings);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setNodesExpandedBuildings(newSet);
  };

  const toggleNodeFloorExpanded = (id: string) => {
    const newSet = new Set(nodesExpandedFloors);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setNodesExpandedFloors(newSet);
  };

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

          {/* Paths Tab */}
          <TabsContent value="paths" className="space-y-4">
            <div className="flex justify-end">
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
                          disabled={!!editingPath}
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
                          disabled={!!editingPath}
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

                    {editingPath && waypoints.length < 2 ? (
                      <Button
                        type="button"
                        variant="destructive"
                        className="w-full"
                        data-testid="button-delete-path-confirm"
                        onClick={() => { deleteRoomPath.mutate(editingPath.id); }}
                      >
                        Delete Path
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={waypoints.length < 2 || !selectedFloorId}
                        data-testid="button-submit-path"
                      >
                        {editingPath ? 'Update Path' : 'Create Path'}
                      </Button>
                    )}
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Expandable List View for Paths */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search buildings..."
                value={buildingPathSearch}
                onChange={(e) => setBuildingPathSearch(e.target.value)}
                className="pl-9"
                data-testid="input-path-building-search"
              />
            </div>
            <div className="space-y-2">
              {buildingsWithPaths.filter(b => b.name.toLowerCase().includes(buildingPathSearch.toLowerCase())).length === 0 ? (
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">No buildings with paths</p>
                </Card>
              ) : (
                buildingsWithPaths.filter(b => b.name.toLowerCase().includes(buildingPathSearch.toLowerCase())).map(building => {
                  const buildingFloors = floors.filter(f => f.buildingId === building.id);
                  const isExpanded = pathsExpandedBuildings.has(building.id);
                  
                  return (
                    <div key={building.id}>
                      <Card 
                        className="p-4 cursor-pointer hover-elevate"
                        onClick={() => togglePathBuildingExpanded(building.id)}
                        data-testid={`card-building-${building.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                            <Building2 className="w-5 h-5" />
                            <span className="font-semibold">{building.name}</span>
                          </div>
                        </div>
                      </Card>

                      {isExpanded && (
                        <div className="ml-4 mt-2 space-y-2 pl-4 border-l">
                          {buildingFloors.map(floor => {
                            const floorPaths = roomPaths.filter(p => p.floorId === floor.id);
                            const floorExpanded = pathsExpandedFloors.has(floor.id);
                            
                            return (
                              <div key={floor.id}>
                                <Card
                                  className="p-3 cursor-pointer hover-elevate"
                                  onClick={() => togglePathFloorExpanded(floor.id)}
                                  data-testid={`card-floor-${floor.id}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <ChevronDown className={`w-4 h-4 transition-transform ${floorExpanded ? '' : '-rotate-90'}`} />
                                      <MapPin className="w-4 h-4" />
                                      <span className="font-medium text-sm">{floor.floorName || `Floor ${floor.floorNumber}`}</span>
                                      <span className="text-xs text-muted-foreground">({floorPaths.length})</span>
                                    </div>
                                  </div>
                                </Card>

                                {floorExpanded && (
                                  <div className="ml-4 mt-2 space-y-2 pl-4 border-l">
                                    {floorPaths.length === 0 ? (
                                      <p className="text-xs text-muted-foreground">No paths on this floor</p>
                                    ) : (
                                      floorPaths.map(path => (
                                        <Card key={path.id} className="p-3" data-testid={`card-room-path-${path.id}`}>
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                              <h4 className="font-sm font-medium truncate text-sm">{path.name || 'Unnamed'}</h4>
                                              <p className="text-xs text-muted-foreground">{(path.waypoints as RoomPathWaypoint[])?.length || 0} waypoints</p>
                                            </div>
                                            <div className="flex gap-1">
                                              <Button size="icon" variant="ghost" onClick={() => handleOpenPathDialog(path)} className="h-6 w-6" data-testid={`button-edit-path-${path.id}`}>
                                                <Pencil className="w-3 h-3" />
                                              </Button>
                                              <Button size="icon" variant="ghost" onClick={() => setDeletingPath(path)} className="h-6 w-6" data-testid={`button-delete-path-${path.id}`}>
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        </Card>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

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

          {/* Nodes Tab */}
          <TabsContent value="nodes" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={nodeDialogOpen} onOpenChange={(open) => open ? handleOpenNodeDialog() : handleCloseNodeDialog()}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-indoor-node">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Node
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingNode ? 'Edit' : 'Add'} Indoor Node</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      Create entrance, stairway, or elevator nodes to connect indoor paths
                    </p>
                  </DialogHeader>
                  <form onSubmit={handleNodeSubmit} className="space-y-4 pb-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Building</Label>
                        <SearchableSelect
                          options={buildingsWithFloorPlans.map(b => ({ id: b.id, name: b.name }))}
                          selectedId={nodeSelectedBuildingId}
                          onSelect={(value) => {
                            setNodeSelectedBuildingId(value);
                            setNodeSelectedFloorId("");
                          }}
                          placeholder="Select building"
                          testId="select-node-building"
                          disabled={!!editingNode}
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
                          disabled={!!editingNode}
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
                            { id: 'elevator', name: 'Elevator' },
                            { id: 'room', name: 'Room' },
                            ...existingCustomTypes.map(t => ({ id: t, name: t })),
                            { id: '__custom__', name: 'Custom Type...' },
                          ]}
                          selectedId={nodeType}
                          onSelect={(val) => { setNodeType(val); setCustomTypeInput(''); }}
                          placeholder="Select type"
                          testId="select-node-type"
                        />
                        {nodeType === '__custom__' && (
                          <Input
                            className="mt-2"
                            value={customTypeInput}
                            onChange={(e) => setCustomTypeInput(e.target.value)}
                            placeholder="e.g., Faculty Office, Laboratory"
                            data-testid="input-custom-type"
                          />
                        )}
                      </div>
                      <div>
                        <Label htmlFor="label">{isRoomLike ? 'Room Name' : 'Label'}</Label>
                        <Textarea
                          id="label"
                          rows={2}
                          className="resize-none"
                          value={nodeLabel}
                          onChange={(e) => setNodeLabel(e.target.value)}
                          placeholder={isRoomLike ? "e.g., Comfort Room\n(HE)" : "e.g., Main Entrance"}
                          data-testid="input-node-label"
                        />
                      </div>
                    </div>

                    {isRoomLike && (
                      <div>
                        <Label htmlFor="description">Room Description</Label>
                        <Input
                          id="description"
                          value={nodeDescription}
                          onChange={(e) => setNodeDescription(e.target.value)}
                          placeholder="e.g., Main conference room with capacity for 50 people"
                          data-testid="input-room-description"
                        />
                      </div>
                    )}

                    {isRoomLike && (
                      <>
                        <div>
                          <Label htmlFor="category">Room Category</Label>
                          <Input
                            id="category"
                            list="room-category-options"
                            value={nodeCategory}
                            onChange={(e) => setNodeCategory(e.target.value)}
                            placeholder="e.g., Classroom, Laboratory, Office"
                            data-testid="input-room-category"
                          />
                          <datalist id="room-category-options">
                            {existingCategories.map(cat => (
                              <option key={cat} value={cat} />
                            ))}
                          </datalist>
                        </div>
                        <div>
                          <Label>Room Photo</Label>
                          <ImageUploadInput
                            label="Upload Room Photo"
                            value={nodeImageUrl ? [nodeImageUrl] : []}
                            onChange={(urls) => setNodeImageUrl(Array.isArray(urls) ? urls[0] || "" : "")}
                            onUploadingChange={setIsUploading}
                            type="room"
                            id={editingNode?.id || 'new'}
                            testId="input-room-image"
                            multiple={false}
                          />
                        </div>
                      </>
                    )}

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
                          labelX={isRoomLike ? nodeLabelX : undefined}
                          labelY={isRoomLike ? nodeLabelY : undefined}
                          onLabelCoordinatesChange={isRoomLike ? (lx, ly) => {
                            setNodeLabelX(lx);
                            setNodeLabelY(ly);
                          } : undefined}
                          rooms={rooms.filter(r => r.floorId === nodeSelectedFloorId)}
                          existingNodes={indoorNodes.filter(n => n.floorId === nodeSelectedFloorId && n.id !== editingNode?.id)}
                          currentFloorId={nodeSelectedFloorId}
                          className="h-[350px] border rounded-lg"
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

                    {(nodeType === 'stairway' || nodeType === 'elevator') && connectedFloorIds.length > 0 && (
                      <div>
                        <Label>Paired Stair/Elevator Node on Connected Floor</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Select the specific node on the connected floor that this stair/elevator leads to. This ensures navigation uses the correct staircase.
                        </p>
                        <SearchableSelect
                          options={[
                            { id: "", name: "— None (use any stair on next floor) —" },
                            ...indoorNodes
                              .filter(n =>
                                connectedFloorIds.includes(n.floorId) &&
                                (n.type === 'stairway' || n.type === 'elevator') &&
                                n.id !== editingNode?.id
                              )
                              .map(n => ({
                                id: n.id,
                                name: `${n.label || n.type} (${floors.find(f => f.id === n.floorId)?.floorName || n.floorId})`
                              }))
                          ]}
                          selectedId={pairedNodeId || ""}
                          onSelect={(val) => setPairedNodeId(val)}
                          placeholder="Select paired node"
                          testId="select-paired-node"
                        />
                      </div>
                    )}

                    <Button type="submit" className="w-full" data-testid="button-submit-node">
                      {editingNode ? 'Update Node' : 'Create Node'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Expandable List View for Nodes */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search buildings..."
                value={buildingNodeSearch}
                onChange={(e) => setBuildingNodeSearch(e.target.value)}
                className="pl-9"
                data-testid="input-node-building-search"
              />
            </div>
            <div className="space-y-2">
              {buildingsWithNodes.filter(b => b.name.toLowerCase().includes(buildingNodeSearch.toLowerCase())).length === 0 ? (
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">No buildings with nodes</p>
                </Card>
              ) : (
                buildingsWithNodes.filter(b => b.name.toLowerCase().includes(buildingNodeSearch.toLowerCase())).map(building => {
                  const buildingFloors = floors.filter(f => f.buildingId === building.id);
                  const isExpanded = nodesExpandedBuildings.has(building.id);
                  
                  return (
                    <div key={building.id}>
                      <Card 
                        className="p-4 cursor-pointer hover-elevate"
                        onClick={() => toggleNodeBuildingExpanded(building.id)}
                        data-testid={`card-nodes-building-${building.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                            <Building2 className="w-5 h-5" />
                            <span className="font-semibold">{building.name}</span>
                          </div>
                        </div>
                      </Card>

                      {isExpanded && (
                        <div className="ml-4 mt-2 space-y-2 pl-4 border-l">
                          {buildingFloors.map(floor => {
                            const floorNodes = indoorNodes.filter(n => n.floorId === floor.id);
                            const floorExpanded = nodesExpandedFloors.has(floor.id);
                            
                            return (
                              <div key={floor.id}>
                                <Card
                                  className="p-3 cursor-pointer hover-elevate"
                                  onClick={() => toggleNodeFloorExpanded(floor.id)}
                                  data-testid={`card-nodes-floor-${floor.id}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <ChevronDown className={`w-4 h-4 transition-transform ${floorExpanded ? '' : '-rotate-90'}`} />
                                      <MapPin className="w-4 h-4" />
                                      <span className="font-medium text-sm">{floor.floorName || `Floor ${floor.floorNumber}`}</span>
                                      <span className="text-xs text-muted-foreground">({floorNodes.length})</span>
                                    </div>
                                  </div>
                                </Card>

                                {floorExpanded && (
                                  <div className="ml-4 mt-2 space-y-2 pl-4 border-l">
                                    {floorNodes.length === 0 ? (
                                      <p className="text-xs text-muted-foreground">No nodes on this floor</p>
                                    ) : (
                                      floorNodes.map(node => (
                                        <Card key={node.id} className="p-3" data-testid={`card-indoor-node-${node.id}`}>
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                              <h4 className="font-sm font-medium truncate text-sm">{node.label || node.type}</h4>
                                              <p className="text-xs text-muted-foreground capitalize">{node.type}</p>
                                            </div>
                                            <div className="flex gap-1">
                                              <Button size="icon" variant="ghost" onClick={() => handleOpenNodeDialog(node)} className="h-6 w-6" data-testid={`button-edit-node-${node.id}`}>
                                                <Pencil className="w-3 h-3" />
                                              </Button>
                                              <Button size="icon" variant="ghost" onClick={() => setDeletingNode(node)} className="h-6 w-6" data-testid={`button-delete-node-${node.id}`}>
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        </Card>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <AlertDialog open={!!deletingNode} onOpenChange={() => setDeletingNode(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Node</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{deletingNode?.label || deletingNode?.type}"? This action cannot be undone.
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
