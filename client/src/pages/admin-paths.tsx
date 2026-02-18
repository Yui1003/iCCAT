import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Route as RouteIcon, Plus, Pencil, Trash2, Accessibility, HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/admin-layout";
import CampusMap from "@/components/campus-map";
import PathDrawingMap from "@/components/path-drawing-map";
import type { Building } from "@shared/schema";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { invalidateEndpointCache } from "@/lib/offline-data";

interface PathNode {
  lat: number;
  lng: number;
}

export default function AdminPaths() {
  const [activeTab, setActiveTab] = useState("walkpaths");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<any | null>(null);
  const [editingPathType, setEditingPathType] = useState<'walkpath' | 'drivepath' | null>(null);
  const [deletingPath, setDeletingPath] = useState<any | null>(null);
  const [pathName, setPathName] = useState("");
  const [pathNodes, setPathNodes] = useState<PathNode[]>([]);
  const [isPwdFriendly, setIsPwdFriendly] = useState(false); // PWD-friendly off by default
  const [strictlyPwdOnly, setStrictlyPwdOnly] = useState(false); // Strictly PWD-only by default
  const [walkpathSearch, setWalkpathSearch] = useState("");
  const [drivepathSearch, setDrivepathSearch] = useState("");
  const [polarTracking, setPolarTracking] = useState(false);
  const [polarIncrement, setPolarIncrement] = useState(45);
  const modifiedConnectedPathsRef = useRef<Map<string, { id: string; nodes: PathNode[] }>>(new Map());
  const { toast } = useToast();

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings']
  });

  const { data: walkpaths = [] } = useQuery<any[]>({
    queryKey: ['/api/walkpaths']
  });

  const { data: drivepaths = [] } = useQuery<any[]>({
    queryKey: ['/api/drivepaths']
  });

  const createWalkpath = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/walkpaths', data),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/walkpaths', queryClient);
      toast({ title: "Walkpath created successfully" });
      setIsDialogOpen(false);
      setPathName("");
      setPathNodes([]);
    },
  });

  const createDrivepath = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/drivepaths', data),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/drivepaths', queryClient);
      toast({ title: "Drivepath created successfully" });
      setIsDialogOpen(false);
      setPathName("");
      setPathNodes([]);
    },
  });

  const updateWalkpath = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest('PUT', `/api/walkpaths/${id}`, data),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/walkpaths', queryClient);
      toast({ title: "Walkpath updated successfully" });
      setIsDialogOpen(false);
      setEditingPath(null);
      setPathName("");
      setPathNodes([]);
    },
  });

  const updateDrivepath = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest('PUT', `/api/drivepaths/${id}`, data),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/drivepaths', queryClient);
      toast({ title: "Drivepath updated successfully" });
      setIsDialogOpen(false);
      setEditingPath(null);
      setPathName("");
      setPathNodes([]);
    },
  });

  const deleteWalkpath = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/walkpaths/${id}`, null),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/walkpaths', queryClient);
      toast({ title: "Walkpath deleted successfully" });
      setDeletingPath(null);
    },
  });

  const deleteDrivepath = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/drivepaths/${id}`, null),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/drivepaths', queryClient);
      toast({ title: "Drivepath deleted successfully" });
      setDeletingPath(null);
    },
  });

  const handleOpenDialog = (path?: any, pathType?: 'walkpath' | 'drivepath') => {
    if (path) {
      setEditingPath(path);
      setEditingPathType(pathType ?? (activeTab === 'walkpaths' ? 'walkpath' : 'drivepath'));
      setPathName(path.name || "");
      setPathNodes(Array.isArray(path.nodes) ? path.nodes : []);
      // Set isPwdFriendly for walkpaths (default to true if not set)
      setIsPwdFriendly(path.isPwdFriendly !== false);
      // Set strictlyPwdOnly for walkpaths (default to false if not set)
      setStrictlyPwdOnly(path.strictlyPwdOnly === true);
    } else {
      setEditingPath(null);
      setEditingPathType(null);
      setPathName("");
      setPathNodes([]);
      setIsPwdFriendly(false); // Default to off for new paths
      setStrictlyPwdOnly(false); // Default to not strictly PWD-only
    }
    modifiedConnectedPathsRef.current.clear();
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPath(null);
    setEditingPathType(null);
    setPathName("");
    setPathNodes([]);
    setIsPwdFriendly(false);
    setStrictlyPwdOnly(false);
    modifiedConnectedPathsRef.current.clear();
  };

  const handleConnectedPathsChange = useCallback((modifiedPaths: Array<{ id: string; nodes: PathNode[] }>) => {
    modifiedPaths.forEach((mp) => {
      modifiedConnectedPathsRef.current.set(mp.id, mp);
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // If no waypoints, delete the path if it exists
    if (pathNodes.length === 0 && editingPath) {
      if (editingPathType === "walkpath") {
        deleteWalkpath.mutate(editingPath.id);
      } else {
        deleteDrivepath.mutate(editingPath.id);
      }
      setIsDialogOpen(false);
      return;
    }

    if (pathNodes.length < 2) {
      toast({ title: "Please add at least 2 waypoints to create a path", variant: "destructive" });
      return;
    }

    // Base data for all path types
    const baseData = {
      name: pathName,
      nodes: pathNodes
    };

    // Add isPwdFriendly and strictlyPwdOnly only for walkpaths
    const walkpathData = {
      ...baseData,
      isPwdFriendly,
      strictlyPwdOnly
    };

    const saveConnectedPaths = () => {
      if (modifiedConnectedPathsRef.current.size === 0) return;

      const walkpathIds = new Set((walkpaths || []).map((w: any) => w.id));
      const drivepathIds = new Set((drivepaths || []).map((d: any) => d.id));

      modifiedConnectedPathsRef.current.forEach((modPath) => {
        const originalPath = [...(walkpaths || []), ...(drivepaths || [])].find((p: any) => p.id === modPath.id);
        if (!originalPath) return;

        if (walkpathIds.has(modPath.id)) {
          apiRequest('PUT', `/api/walkpaths/${modPath.id}`, {
            name: originalPath.name,
            nodes: modPath.nodes,
            isPwdFriendly: originalPath.isPwdFriendly,
            strictlyPwdOnly: originalPath.strictlyPwdOnly
          }).then(() => {
            invalidateEndpointCache('/api/walkpaths', queryClient);
          });
        } else if (drivepathIds.has(modPath.id)) {
          apiRequest('PUT', `/api/drivepaths/${modPath.id}`, {
            name: originalPath.name,
            nodes: modPath.nodes
          }).then(() => {
            invalidateEndpointCache('/api/drivepaths', queryClient);
          });
        }
      });
      modifiedConnectedPathsRef.current.clear();
    };

    if (editingPath) {
      if (editingPathType === "walkpath") {
        updateWalkpath.mutate({ id: editingPath.id, data: walkpathData });
      } else {
        updateDrivepath.mutate({ id: editingPath.id, data: baseData });
      }
      saveConnectedPaths();
    } else {
      if (activeTab === "walkpaths") {
        createWalkpath.mutate(walkpathData);
      } else {
        createDrivepath.mutate(baseData);
      }
    }
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Path Management</h1>
            <p className="text-muted-foreground">Manage walking and driving paths for navigation</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => open ? handleOpenDialog() : handleCloseDialog()}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-path">
                <Plus className="w-4 h-4 mr-2" />
                Add Path
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPath ? 'Edit' : 'Add'} {activeTab === "walkpaths" ? "Walking" : "Driving"} Path</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {editingPath ? 'Update' : 'Create a new'} {activeTab === "walkpaths" ? "walking" : "driving"} path by clicking on the map
                </p>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Path Name</Label>
                  <Input
                    id="name"
                    value={pathName}
                    onChange={(e) => setPathName(e.target.value)}
                    required
                    data-testid="input-path-name"
                  />
                </div>
                
                {/* PWD Friendly and Strictly PWD Only toggles - only show for walkpaths */}
                {(activeTab === "walkpaths" || editingPathType === "walkpath") && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Accessibility className="w-5 h-5 text-orange-500" />
                        <div>
                          <Label htmlFor="pwd-friendly" className="text-sm font-medium cursor-pointer">
                            PWD Accessible
                          </Label>
                          <p className="text-[10px] leading-tight text-muted-foreground">
                            Mark as wheelchair-friendly
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="pwd-friendly"
                        checked={isPwdFriendly}
                        onCheckedChange={setIsPwdFriendly}
                        data-testid="switch-pwd-friendly"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Accessibility className="w-5 h-5 text-red-500" />
                        <div>
                          <Label htmlFor="strictly-pwd-only" className="text-sm font-medium cursor-pointer">
                            Strictly PWD Only
                          </Label>
                          <p className="text-[10px] leading-tight text-muted-foreground">
                            Only for accessible mode
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="strictly-pwd-only"
                        checked={strictlyPwdOnly}
                        onCheckedChange={setStrictlyPwdOnly}
                        data-testid="switch-strictly-pwd-only"
                      />
                    </div>
                  </div>
                )}

                <div className="w-full">
                  <Label>Draw Path on Map</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    🏢 Orange markers = buildings (click to snap path) • Gray dots = existing waypoints • Click map to add waypoints
                  </p>
                  <div className="w-full border rounded-md overflow-hidden" style={{ height: '450px', display: 'block' }}>
                    <PathDrawingMap
                      nodes={pathNodes}
                      onNodesChange={setPathNodes}
                      mode={activeTab === "walkpaths" ? "walking" : "driving"}
                      className="h-full w-full"
                      existingPaths={activeTab === "walkpaths" ? walkpaths : drivepaths}
                      currentPathId={editingPath?.id}
                      polarTracking={polarTracking}
                      polarIncrement={polarIncrement}
                      onConnectedPathsChange={handleConnectedPathsChange}
                      buildings={buildings.map(b => ({ 
                        id: b.id, 
                        name: b.name, 
                        lat: (b as any).nodeLat ?? b.lat, 
                        lng: (b as any).nodeLng ?? b.lng,
                        polygon: Array.isArray(b.polygon) ? b.polygon as any : null,
                        polygonColor: b.polygonColor || "#FACC15"
                      }))}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-blue-500" />
                    <div>
                      <Label htmlFor="polar-tracking" className="text-sm font-medium cursor-pointer">
                        Polar Tracking
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Snap nodes to {polarIncrement}° increments
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-auto">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="polar-increment" className="text-xs whitespace-nowrap">Angle (°):</Label>
                      <Input
                        id="polar-increment"
                        type="text"
                        value={polarIncrement}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setPolarIncrement(0 as any);
                            return;
                          }
                          const num = parseInt(val);
                          if (!isNaN(num)) {
                            setPolarIncrement(Math.min(360, Math.max(0, num)));
                          }
                        }}
                        className="w-16 h-8 text-xs text-center"
                      />
                    </div>
                    <Switch
                      id="polar-tracking"
                      checked={polarTracking}
                      onCheckedChange={setPolarTracking}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  {pathNodes.length === 0 && editingPath ? 'Delete Path' : (editingPath ? 'Update Path' : 'Create Path')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="walkpaths" data-testid="tab-walkpaths">
              Walking Paths
            </TabsTrigger>
            <TabsTrigger value="drivepaths" data-testid="tab-drivepaths">
              Driving Paths
            </TabsTrigger>
          </TabsList>

          <TabsContent value="walkpaths">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="h-[600px] overflow-hidden">
                  <CampusMap 
                    buildings={buildings as any} 
                    existingPaths={walkpaths} 
                    pathsColor="#22c55e" 
                    hideKiosk
                    thinPaths
                    showBuildingNodes
                    onPathClick={(path) => handleOpenDialog(path, 'walkpath')}
                  />
                </Card>
              </div>

              <div>
                <Card className="p-6 flex flex-col h-[600px]">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Walking Paths</h2>
                  <div className="mb-4">
                    <Label htmlFor="search-walkpaths" className="text-sm">Search Walking Paths</Label>
                    <Input
                      id="search-walkpaths"
                      placeholder="Search by path name..."
                      value={walkpathSearch}
                      onChange={(e) => setWalkpathSearch(e.target.value)}
                      data-testid="input-search-walkpaths"
                      className="mt-1"
                    />
                  </div>
                  {walkpaths.length === 0 ? (
                    <div className="text-center py-8">
                      <RouteIcon className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No walking paths yet</p>
                    </div>
                  ) : (() => {
                    const sortedWalkpaths = [...walkpaths].sort((a, b) => 
                      (a.name || "").localeCompare(b.name || "")
                    );
                    const filteredWalkpaths = sortedWalkpaths.filter((path) => 
                      walkpathSearch === "" || (path.name || "").toLowerCase().includes(walkpathSearch.toLowerCase())
                    );
                    return (
                      <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                        {filteredWalkpaths.length === 0 ? (
                          <div className="text-center py-8">
                            <RouteIcon className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No walking paths match your search</p>
                          </div>
                        ) : (
                          filteredWalkpaths.map((path, index) => (
                            <div
                              key={path.id || index}
                              className="p-3 bg-muted/50 rounded-lg"
                              data-testid={`walkpath-${index}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-foreground">
                                      {path.name || `Path ${index + 1}`}
                                    </p>
                                    {path.strictlyPwdOnly === true ? (
                                      <Badge variant="secondary" className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                        <Accessibility className="w-3 h-3 mr-1" />
                                        PWD Only
                                      </Badge>
                                    ) : path.isPwdFriendly !== false ? (
                                      <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                        <Accessibility className="w-3 h-3 mr-1" />
                                        PWD Friendly
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs text-muted-foreground">
                                        Regular
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {Array.isArray(path.nodes) ? path.nodes.length : 0} waypoints
                                  </p>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleOpenDialog(path, 'walkpath')}
                                    data-testid={`button-edit-walkpath-${index}`}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setDeletingPath({ ...path, type: 'walkpath' })}
                                    data-testid={`button-delete-walkpath-${index}`}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })()}
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="drivepaths">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="h-[600px] overflow-hidden">
                  <CampusMap 
                    buildings={buildings as any} 
                    existingPaths={drivepaths} 
                    pathsColor="#3b82f6" 
                    hideKiosk
                    thinPaths
                    showBuildingNodes
                    onPathClick={(path) => handleOpenDialog(path, 'drivepath')}
                  />
                </Card>
              </div>

              <div>
                <Card className="p-6 flex flex-col h-[600px]">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Driving Paths</h2>
                  <div className="mb-4">
                    <Label htmlFor="search-drivepaths" className="text-sm">Search Driving Paths</Label>
                    <Input
                      id="search-drivepaths"
                      placeholder="Search by path name..."
                      value={drivepathSearch}
                      onChange={(e) => setDrivepathSearch(e.target.value)}
                      data-testid="input-search-drivepaths"
                      className="mt-1"
                    />
                  </div>
                  {drivepaths.length === 0 ? (
                    <div className="text-center py-8">
                      <RouteIcon className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No driving paths yet</p>
                    </div>
                  ) : (() => {
                    const sortedDrivepaths = [...drivepaths].sort((a, b) => 
                      (a.name || "").localeCompare(b.name || "")
                    );
                    const filteredDrivepaths = sortedDrivepaths.filter((path) => 
                      drivepathSearch === "" || (path.name || "").toLowerCase().includes(drivepathSearch.toLowerCase())
                    );
                    return (
                      <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                        {filteredDrivepaths.length === 0 ? (
                          <div className="text-center py-8">
                            <RouteIcon className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No driving paths match your search</p>
                          </div>
                        ) : (
                          filteredDrivepaths.map((path, index) => (
                            <div
                              key={path.id || index}
                              className="p-3 bg-muted/50 rounded-lg"
                              data-testid={`drivepath-${index}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="font-medium text-foreground">
                                    {path.name || `Path ${index + 1}`}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {Array.isArray(path.nodes) ? path.nodes.length : 0} waypoints
                                  </p>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleOpenDialog(path, 'drivepath')}
                                    data-testid={`button-edit-drivepath-${index}`}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setDeletingPath({ ...path, type: 'drivepath' })}
                                    data-testid={`button-delete-drivepath-${index}`}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })()}
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!deletingPath} onOpenChange={(open) => !open && setDeletingPath(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Path</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingPath?.name || 'this path'}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingPath) {
                  if (deletingPath.type === 'walkpath') {
                    deleteWalkpath.mutate(deletingPath.id);
                  } else {
                    deleteDrivepath.mutate(deletingPath.id);
                  }
                }
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
