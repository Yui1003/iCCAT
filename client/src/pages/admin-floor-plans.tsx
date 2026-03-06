import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layers, Building2, Plus, Pencil, Trash2, Filter, ChevronDown, ChevronRight, Check, ChevronsUpDown, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/admin-layout";
import ImageUploadInput from "@/components/image-upload-input";
import type { Building, Floor } from "@shared/schema";
import { canHaveFloorPlan, floorPlanEligibleTypes } from "@shared/schema";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { invalidateEndpointCache } from "@/lib/offline-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export default function AdminFloorPlans() {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [expandedBuildingId, setExpandedBuildingId] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [isFloorDialogOpen, setIsFloorDialogOpen] = useState(false);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
  const [deletingFloor, setDeletingFloor] = useState<Floor | null>(null);
  const [floorData, setFloorData] = useState({ floorNumber: "", floorName: "", image: "" });
  const [filterType, setFilterType] = useState<string>("all");
  const [dialogBuildingId, setDialogBuildingId] = useState<string | null>(null);
  const [buildingPopoverOpen, setBuildingPopoverOpen] = useState(false);
  const [buildingSearch, setBuildingSearch] = useState("");
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
      if (selectedFloor) {
        const updated = floors.find(f => f.id === selectedFloor.id);
        if (updated) setSelectedFloor(updated);
      }
    },
  });

  const deleteFloor = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/floors/${id}`, null),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/floors', queryClient);
      toast({ title: "Floor deleted successfully" });
      if (selectedFloor?.id === deletingFloor?.id) setSelectedFloor(null);
      setDeletingFloor(null);
    },
  });

  const floorPlanEligibleBuildings = buildings.filter(b => {
    if (!canHaveFloorPlan(b.type as any)) return false;
    return floors.some(f => f.buildingId === b.id && f.floorPlanImage);
  });

  const filteredBuildings = (filterType === "all"
    ? floorPlanEligibleBuildings
    : floorPlanEligibleBuildings.filter(b => b.type === filterType)
  )
    .filter(b => b.name.toLowerCase().includes(buildingSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const getFloorsForBuilding = (buildingId: string) =>
    floors
      .filter(f => f.buildingId === buildingId)
      .sort((a, b) => a.floorNumber - b.floorNumber);

  const handleBuildingClick = (building: Building) => {
    const isExpanding = expandedBuildingId !== building.id;
    setExpandedBuildingId(isExpanding ? building.id : null);
    setSelectedBuildingId(building.id);
    if (!isExpanding) setSelectedFloor(null);
  };

  const handleOpenFloorDialog = (floor?: Floor) => {
    if (floor) {
      setEditingFloor(floor);
      setDialogBuildingId(floor.buildingId);
      setFloorData({
        floorNumber: floor.floorNumber.toString(),
        floorName: floor.floorName || "",
        image: floor.floorPlanImage || ""
      });
    } else {
      setEditingFloor(null);
      setDialogBuildingId(selectedBuildingId || null);
      setFloorData({ floorNumber: "", floorName: "", image: "" });
    }
    setIsFloorDialogOpen(true);
  };

  const handleCloseFloorDialog = () => {
    setIsFloorDialogOpen(false);
    setEditingFloor(null);
    setDialogBuildingId(null);
    setFloorData({ floorNumber: "", floorName: "", image: "" });
  };

  const allEligibleBuildings = buildings
    .filter(b => canHaveFloorPlan(b.type as any))
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleCreateFloor = (e: React.FormEvent) => {
    e.preventDefault();
    const targetBuildingId = editingFloor ? editingFloor.buildingId : dialogBuildingId;
    if (!targetBuildingId) {
      toast({ title: "Please select a building", variant: "destructive" });
      return;
    }

    const data = {
      buildingId: targetBuildingId,
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
              <Button data-testid="button-add-floor">
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
                {!editingFloor && (
                  <div>
                    <Label>Building *</Label>
                    <Popover open={buildingPopoverOpen} onOpenChange={setBuildingPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                          data-testid="select-dialog-building"
                        >
                          {dialogBuildingId
                            ? allEligibleBuildings.find(b => b.id === dialogBuildingId)?.name ?? "Select building"
                            : "Select building"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 z-[1002]" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                        <Command>
                          <CommandInput placeholder="Search building..." />
                          <CommandList className="max-h-[200px] overflow-y-auto">
                            <CommandEmpty>No building found.</CommandEmpty>
                            <CommandGroup>
                              {allEligibleBuildings.map((b) => (
                                <CommandItem
                                  key={b.id}
                                  value={b.name}
                                  onSelect={() => {
                                    setDialogBuildingId(b.id);
                                    setBuildingPopoverOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      dialogBuildingId === b.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {b.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
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
                <ImageUploadInput
                  label="Floor Plan Image"
                  value={floorData.image}
                  onChange={(url) => setFloorData({ ...floorData, image: typeof url === 'string' ? url : url[0] || '' })}
                  type="floor"
                  id={editingFloor?.id || 'new'}
                  testId="floor-plan-image"
                />
                <Button type="submit" className="w-full">{editingFloor ? 'Update Floor' : 'Create Floor'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filter by Building Type
                </label>
                <Select value={filterType} onValueChange={(v) => { setFilterType(v); setBuildingSearch(""); }}>
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
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search buildings..."
                    value={buildingSearch}
                    onChange={(e) => setBuildingSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-building-search"
                  />
                </div>
              </div>

              {filteredBuildings.length === 0 ? (
                <div className="text-center py-16">
                  <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No buildings with floor plans found</p>
                </div>
              ) : (
                <ScrollArea className="h-[520px] pr-2">
                  <div className="space-y-2">
                    {filteredBuildings.map((building) => {
                      const buildingFloors = getFloorsForBuilding(building.id);
                      const isExpanded = expandedBuildingId === building.id;

                      return (
                        <div key={building.id}>
                          <div
                            className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors ${
                              isExpanded
                                ? 'bg-primary/10 border-2 border-primary'
                                : 'bg-muted/50 hover:bg-muted'
                            }`}
                            onClick={() => handleBuildingClick(building)}
                            data-testid={`building-card-${building.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                isExpanded ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
                              }`}>
                                <Building2 className={`w-5 h-5 ${isExpanded ? 'text-primary-foreground' : 'text-primary'}`} />
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{building.name}</p>
                                <p className="text-sm text-muted-foreground capitalize">{building.type} · {buildingFloors.length} floor{buildingFloors.length !== 1 ? 's' : ''}</p>
                              </div>
                            </div>
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            }
                          </div>

                          {isExpanded && (
                            <div className="ml-4 mt-1 space-y-1 pl-4 border-l-2 border-primary/30">
                              {buildingFloors.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-3 px-2">No floors added yet</p>
                              ) : (
                                buildingFloors.map((floor) => (
                                  <div
                                    key={floor.id}
                                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                                      selectedFloor?.id === floor.id
                                        ? 'bg-primary/20 border border-primary'
                                        : 'bg-background hover:bg-muted/70'
                                    }`}
                                    data-testid={`floor-item-${floor.id}`}
                                  >
                                    <div
                                      className="flex items-center gap-3 flex-1 cursor-pointer"
                                      onClick={() => setSelectedFloor(floor)}
                                    >
                                      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                                        selectedFloor?.id === floor.id ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
                                      }`}>
                                        <Layers className={`w-4 h-4 ${selectedFloor?.id === floor.id ? 'text-primary-foreground' : 'text-primary'}`} />
                                      </div>
                                      <div>
                                        <p className="font-medium text-sm text-foreground">
                                          {floor.floorName || `Floor ${floor.floorNumber}`}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Level {floor.floorNumber}</p>
                                      </div>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenFloorDialog(floor);
                                        }}
                                        data-testid={`button-edit-floor-${floor.id}`}
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeletingFloor(floor);
                                        }}
                                        data-testid={`button-delete-floor-${floor.id}`}
                                      >
                                        <Trash2 className="w-3 h-3 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </Card>
          </div>

          <div>
            <Card className="p-6 sticky top-4">
              <h2 className="text-lg font-semibold text-foreground mb-4">Floor Plan Viewer</h2>
              {selectedFloor?.floorPlanImage ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {selectedFloor.floorName || `Floor ${selectedFloor.floorNumber}`}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">Level {selectedFloor.floorNumber}</p>
                  <div className="rounded-lg overflow-hidden border bg-muted/30">
                    <img
                      src={selectedFloor.floorPlanImage}
                      alt={selectedFloor.floorName || `Floor ${selectedFloor.floorNumber}`}
                      className="w-full object-contain max-h-[420px]"
                      data-testid="floor-plan-preview-image"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">
                    {selectedFloor ? 'No floor plan image uploaded' : 'Click on a floor to preview'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Rooms are created via Indoor Nodes in Floor Plan Management
                  </p>
                </div>
              )}
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
