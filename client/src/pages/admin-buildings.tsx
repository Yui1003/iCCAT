import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Plus, Pencil, Trash2, Search, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PolygonDrawingMap from "@/components/polygon-drawing-map";
import ImageUploadInput from "@/components/image-upload-input";
import type { Building, InsertBuilding, LatLng, POIType } from "@shared/schema";
import { poiTypes, canHaveDepartments } from "@shared/schema";
import { invalidateEndpointCache } from "@/lib/offline-data";

export default function AdminBuildings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [formData, setFormData] = useState<InsertBuilding>({
    name: "",
    type: "Building",
    description: "",
    lat: 14.402870,
    lng: 120.8660,
    image: null,
    departments: [],
    polygon: null,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("All Types");
  const { toast } = useToast();

  const { data: buildingsData = [], isLoading } = useQuery<Building[]>({
    queryKey: ["/api/buildings"],
  });

  const buildings = useMemo(() => {
    return (buildingsData as any[]).map(b => ({
      ...b,
      polygon: (b.polygon as any) || null
    })) as Building[];
  }, [buildingsData]);

  const upsertMutation = useMutation({
    mutationFn: async (data: InsertBuilding) => {
      const res = editingBuilding
        ? await apiRequest("PATCH", `/api/buildings/${editingBuilding.id}`, data)
        : await apiRequest("POST", "/api/buildings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buildings"] });
      invalidateEndpointCache("/api/buildings");
      toast({
        title: "Success",
        description: `Building ${editingBuilding ? "updated" : "created"} successfully`,
      });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/buildings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buildings"] });
      invalidateEndpointCache("/api/buildings");
      toast({
        title: "Success",
        description: "Building deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (building?: Building) => {
    if (building) {
      setEditingBuilding(building);
      setFormData({
        name: building.name,
        type: (building.type as POIType) || "Building",
        description: building.description || "",
        lat: building.lat,
        lng: building.lng,
        image: building.image,
        departments: building.departments || [],
        polygon: building.polygon as LatLng[] | null,
      });
    } else {
      setEditingBuilding(null);
      setFormData({
        name: "",
        type: "Building",
        description: "",
        lat: 14.402870,
        lng: 120.8660,
        image: null,
        departments: [],
        polygon: null,
      });
    }
    setIsDialogOpen(true);
  };

  const handleMapClick = (latlng: LatLng) => {
    setFormData((prev) => ({ ...prev, lat: latlng.lat, lng: latlng.lng }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate(formData);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Manage Buildings</h1>
          <Button onClick={() => handleOpenDialog()} data-testid="button-add-building">
            <Plus className="w-4 h-4 mr-2" />
            Add Building
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="p-4 h-[600px]">
              <PolygonDrawingMap
                centerLat={formData.lat}
                centerLng={formData.lng}
                polygon={formData.polygon as LatLng[] | null}
                onPolygonChange={(polygon) => setFormData((prev) => ({ ...prev, polygon }))}
                existingBuildings={buildings as Building[]}
              />
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-4">
              <div className="space-y-4 mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search buildings..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-buildings"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filter by Type
                  </Label>
                  <Select value={selectedTypeFilter} onValueChange={setSelectedTypeFilter}>
                    <SelectTrigger data-testid="select-type-filter">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Types">All Types</SelectItem>
                      {poiTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : buildings.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No buildings yet</p>
                </div>
              ) : (() => {
                const filteredBuildings = buildings.filter((building) => {
                  const matchesSearch = searchQuery === "" || 
                    building.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (building.type?.toLowerCase().includes(searchQuery.toLowerCase()));
                  const matchesType = selectedTypeFilter === "All Types" || building.type === selectedTypeFilter;
                  return matchesSearch && matchesType;
                });
                return (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {filteredBuildings.length === 0 ? (
                      <div className="text-center py-8">
                        <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No buildings found</p>
                      </div>
                    ) : (
                      filteredBuildings.map((building) => (
                        <div
                          key={building.id}
                          className="flex items-start justify-between p-3 bg-muted/50 rounded-lg hover-elevate"
                          data-testid={`building-item-${building.id}`}
                        >
                          <div className="flex-1">
                            <h3 className="font-medium text-foreground">{building.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {building.type || "Building"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {building.lat.toFixed(4)}, {building.lng.toFixed(4)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleOpenDialog(building)}
                              data-testid={`button-edit-${building.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteMutation.mutate(building.id)}
                              data-testid={`button-delete-${building.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingBuilding ? "Edit Building" : "Add New Building"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    data-testid="input-building-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={formData.type || "Building"}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, type: val }))}
                  >
                    <SelectTrigger data-testid="select-building-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {poiTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formData.description || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  data-testid="input-building-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    required
                    value={formData.lat}
                    onChange={(e) => setFormData((prev) => ({ ...prev, lat: parseFloat(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input
                    type="number"
                    step="any"
                    required
                    value={formData.lng}
                    onChange={(e) => setFormData((prev) => ({ ...prev, lng: parseFloat(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Building Photo</Label>
                <ImageUploadInput
                  id="building-image"
                  label="Building Photo"
                  type="building"
                  value={formData.image || ""}
                  onChange={(val) => setFormData((prev) => ({ ...prev, image: val }))}
                />
              </div>

              {formData.type && canHaveDepartments(formData.type as POIType) && (
                <div className="space-y-2">
                  <Label>Departments (Optional - one per line)</Label>
                  <Input
                    placeholder="Enter departments..."
                    value={formData.departments?.join("\n") || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        departments: e.target.value.split("\n").filter((d) => d.trim()),
                      }))
                    }
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={upsertMutation.isPending}
                data-testid="button-save-building"
              >
                {upsertMutation.isPending ? "Saving..." : "Save Building"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
