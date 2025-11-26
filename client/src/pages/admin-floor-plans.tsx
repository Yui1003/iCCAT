import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layers, Building2, Plus, Pencil, Trash2, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/admin-layout";
import SearchableSelect from "@/components/searchable-select";
import type { Building, Floor } from "@shared/schema";
import { poiTypes, canHaveFloorPlan, floorPlanEligibleTypes } from "@shared/schema";
import FloorPlanViewer from "@/components/floor-plan-viewer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { invalidateEndpointCache } from "@/lib/offline-data";

export default function AdminFloorPlans() {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [isFloorDialogOpen, setIsFloorDialogOpen] = useState(false);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
  const [deletingFloor, setDeletingFloor] = useState<Floor | null>(null);
  const [floorData, setFloorData] = useState({ floorNumber: "", floorName: "", image: "" });
  const [filterType, setFilterType] = useState<string>("all");
  const { toast } = useToast();

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings']
  });

  const { data: floors = [] } = useQuery<Floor[]>({
    queryKey: ['/api/floors']
  });

  const createFloor = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/floors', data),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/floors', queryClient);
      toast({ title: "Floor created successfully" });
      setIsFloorDialogOpen(false);
      setFloorData({ floorNumber: "", floorName: "", image: "" });
    },
  });

  const updateFloor = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest('PUT', `/api/floors/${id}`, data),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/floors', queryClient);
      toast({ title: "Floor updated successfully" });
      setIsFloorDialogOpen(false);
      setEditingFloor(null);
      setFloorData({ floorNumber: "", floorName: "", image: "" });
    },
  });

  const deleteFloor = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/floors/${id}`, null),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/floors', queryClient);
      toast({ title: "Floor deleted successfully" });
      setDeletingFloor(null);
    },
  });

  // Only show buildings that can have floor plans
  const floorPlanEligibleBuildings = buildings.filter(b => canHaveFloorPlan(b.type as any));
  
  const filteredBuildings = filterType === "all" 
    ? floorPlanEligibleBuildings 
    : floorPlanEligibleBuildings.filter(b => b.type === filterType);

  const buildingFloors = selectedBuildingId
    ? floors.filter(f => f.buildingId === selectedBuildingId)
    : [];

  const handleOpenFloorDialog = (floor?: Floor) => {
    if (floor) {
      setEditingFloor(floor);
      setFloorData({
        floorNumber: floor.floorNumber.toString(),
        floorName: floor.floorName || "",
        image: floor.floorPlanImage || ""
      });
    } else {
      setEditingFloor(null);
      setFloorData({ floorNumber: "", floorName: "", image: "" });
    }
    setIsFloorDialogOpen(true);
  };

  const handleCloseFloorDialog = () => {
    setIsFloorDialogOpen(false);
    setEditingFloor(null);
    setFloorData({ floorNumber: "", floorName: "", image: "" });
  };

  const handleCreateFloor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuildingId) return;
    
    const data = {
      buildingId: selectedBuildingId,
      floorNumber: parseInt(floorData.floorNumber),
      floorName: floorData.floorName || null,
      floorPlanImage: floorData.image || null
    };

    if (editingFloor) {
      updateFloor.mutate({ id: editingFloor.id, data });
    } else {
      createFloor.mutate(data);
    }
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Floor Plan Management</h1>
            <p className="text-muted-foreground">Manage building floor plans and room markers</p>
          </div>
          <Dialog open={isFloorDialogOpen} onOpenChange={(open) => open ? handleOpenFloorDialog() : handleCloseFloorDialog()}>
            <DialogTrigger asChild>
              <Button disabled={!selectedBuildingId} data-testid="button-add-floor">
                <Plus className="w-4 h-4 mr-2" />
                Add Floor
              </Button>
            </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingFloor ? 'Edit' : 'Add'} Floor Plan</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    {editingFloor ? 'Update' : 'Create a new'} floor for the selected building
                  </p>
                </DialogHeader>
                <form onSubmit={handleCreateFloor} className="space-y-4">
                  <div>
                    <Label htmlFor="floorNumber">Floor Number *</Label>
                    <Input
                      id="floorNumber"
                      type="number"
                      value={floorData.floorNumber}
                      onChange={(e) => setFloorData({ ...floorData, floorNumber: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="floorName">Floor Name</Label>
                    <Input
                      id="floorName"
                      value={floorData.floorName}
                      onChange={(e) => setFloorData({ ...floorData, floorName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="image">Floor Plan Image URL</Label>
                    <Input
                      id="image"
                      value={floorData.image}
                      onChange={(e) => setFloorData({ ...floorData, image: e.target.value })}
                      placeholder="https://example.com/floorplan.png"
                    />
                  </div>
                  <Button type="submit" className="w-full">{editingFloor ? 'Update Floor' : 'Create Floor'}</Button>
                </form>
              </DialogContent>
            </Dialog>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filter by Building Type
                  </label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger data-testid="select-building-type-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Eligible Types</SelectItem>
                      {Array.from(floorPlanEligibleTypes).map(type => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Select Building
                  </label>
                  <SearchableSelect
                    options={filteredBuildings.map(b => ({ id: b.id, name: `${b.name} • ${b.type}` }))}
                    selectedId={selectedBuildingId}
                    onSelect={setSelectedBuildingId}
                    placeholder="Choose a building"
                    testId="select-building"
                  />
                </div>
              </div>

              {selectedBuildingId ? (
                buildingFloors.length > 0 ? (
                  <div className="space-y-3">
                    {buildingFloors.map((floor) => (
                      <div
                        key={floor.id}
                        className={`flex items-center justify-between p-4 rounded-lg ${
                          selectedFloor?.id === floor.id ? 'bg-primary/20 border-2 border-primary' : 'bg-muted/50'
                        }`}
                        data-testid={`floor-item-${floor.id}`}
                      >
                        <div 
                          className="flex items-center gap-3 flex-1 hover-elevate cursor-pointer rounded-md -m-4 p-4"
                          onClick={() => setSelectedFloor(floor)}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            selectedFloor?.id === floor.id ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
                          }`}>
                            <Layers className={`w-6 h-6 ${
                              selectedFloor?.id === floor.id ? 'text-primary-foreground' : 'text-primary'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-foreground">
                              {floor.floorName || `Floor ${floor.floorNumber}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Level {floor.floorNumber}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenFloorDialog(floor);
                            }}
                            data-testid={`button-edit-floor-${floor.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingFloor(floor);
                            }}
                            data-testid={`button-delete-floor-${floor.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No floor plans for this building</p>
                  </div>
                )
              ) : (
                <div className="text-center py-16">
                  <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Select a building to view floor plans</p>
                </div>
              )}
            </Card>
          </div>

          <div>
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Floor Plan Viewer</h2>
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-2">
                  Click on a floor plan to view
                </p>
                <p className="text-xs text-muted-foreground">
                  Rooms are created via Indoor Nodes in Floor Plan Management
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={!!deletingFloor} onOpenChange={(open) => !open && setDeletingFloor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Floor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingFloor?.floorName || `Floor ${deletingFloor?.floorNumber}`}"? This action cannot be undone and will also delete all rooms on this floor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingFloor) {
                  deleteFloor.mutate(deletingFloor.id);
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
