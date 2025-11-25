import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Route as RouteIcon, Plus, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [walkpathSearch, setWalkpathSearch] = useState("");
  const [drivepathSearch, setDrivepathSearch] = useState("");
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
    } else {
      setEditingPath(null);
      setEditingPathType(null);
      setPathName("");
      setPathNodes([]);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPath(null);
    setEditingPathType(null);
    setPathName("");
    setPathNodes([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pathNodes.length < 2) {
      toast({ title: "Please add at least 2 waypoints to create a path", variant: "destructive" });
      return;
    }

    const data = {
      name: pathName,
      nodes: pathNodes
    };

    if (editingPath) {
      if (editingPathType === "walkpath") {
        updateWalkpath.mutate({ id: editingPath.id, data });
      } else {
        updateDrivepath.mutate({ id: editingPath.id, data });
      }
    } else {
      if (activeTab === "walkpaths") {
        createWalkpath.mutate(data);
      } else {
        createDrivepath.mutate(data);
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
            <DialogContent className="max-h-[90vh] overflow-y-auto">
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
                <div className="w-full">
                  <Label>Draw Path on Map</Label>
                  <div className="w-full" style={{ height: '350px', display: 'block' }}>
                    <PathDrawingMap
                      nodes={pathNodes}
                      onNodesChange={setPathNodes}
                      mode={activeTab === "walkpaths" ? "walking" : "driving"}
                      className="h-full w-full"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={pathNodes.length < 2}>{editingPath ? 'Update Path' : 'Create Path'}</Button>
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
                  <CampusMap buildings={buildings} />
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
                  ) : (
                    <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                      {walkpaths
                        .filter((path) => 
                          walkpathSearch === "" || (path.name || "").toLowerCase().includes(walkpathSearch.toLowerCase())
                        )
                        .map((path, index) => (
                        <div
                          key={path.id || index}
                          className="p-3 bg-muted/50 rounded-lg"
                          data-testid={`walkpath-${index}`}
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
                      ))}
                      {walkpaths.filter((path) => 
                        walkpathSearch === "" || (path.name || "").toLowerCase().includes(walkpathSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="text-center py-8">
                          <RouteIcon className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">No walking paths match your search</p>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="drivepaths">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="h-[600px] overflow-hidden">
                  <CampusMap buildings={buildings} />
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
                  ) : (
                    <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                      {drivepaths
                        .filter((path) => 
                          drivepathSearch === "" || (path.name || "").toLowerCase().includes(drivepathSearch.toLowerCase())
                        )
                        .map((path, index) => (
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
                      ))}
                      {drivepaths.filter((path) => 
                        drivepathSearch === "" || (path.name || "").toLowerCase().includes(drivepathSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="text-center py-8">
                          <RouteIcon className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">No driving paths match your search</p>
                        </div>
                      )}
                    </div>
                  )}
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
