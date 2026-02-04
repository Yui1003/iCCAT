import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, MapPin, Building2, School, Hospital, Store, Home, Shapes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/admin-layout";
import CampusMap from "@/components/campus-map";
import PolygonDrawingMap from "@/components/polygon-drawing-map";
import ImageUploadInput from "@/components/image-upload-input";
import type { Building, InsertBuilding, LatLng } from "@shared/schema";
import { poiTypes, canHaveDepartments } from "@shared/schema";
import { invalidateEndpointCache } from "@/lib/offline-data";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 }
};

export default function AdminBuildings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [formData, setFormData] = useState<InsertBuilding>({
    name: "",
    type: "Building",
    description: "",
    lat: 14.402870,
    lng: 120.8640,
    departments: [],
    image: "",
    markerIcon: "building",
    polygon: null,
    polygonColor: "#FACC15",
    polygonOpacity: 0.3,
  });
  const [departmentInput, setDepartmentInput] = useState("");
  const [mapClickEnabled, setMapClickEnabled] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("All Types");
  const [searchQuery, setSearchQuery] = useState("");
  const mapClickEnabledRef = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    mapClickEnabledRef.current = mapClickEnabled;
  }, [mapClickEnabled]);

  const { data: buildings = [], isLoading } = useQuery<Building[]>({
    queryKey: ['/api/buildings']
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertBuilding) => apiRequest('POST', '/api/buildings', data),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/buildings', queryClient);
      toast({ title: "Building created successfully" });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsertBuilding }) =>
      apiRequest('PUT', `/api/buildings/${id}`, data),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/buildings', queryClient);
      toast({ title: "Building updated successfully" });
      handleCloseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/buildings/${id}`, null),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/buildings', queryClient);
      toast({ title: "Building deleted successfully" });
    },
  });

  const handleOpenDialog = (building?: Building) => {
    if (building) {
      setEditingBuilding(building);
      setFormData({
        name: building.name,
        type: building.type || "Building",
        description: building.description || "",
        lat: building.lat,
        lng: building.lng,
        departments: building.departments || [],
        image: building.image || "",
        markerIcon: building.markerIcon || "building",
        polygon: building.polygon || null,
        polygonColor: (building as any).polygonColor || "#FACC15",
        polygonOpacity: (building as any).polygonOpacity || 0.3,
      });
    } else {
      setEditingBuilding(null);
      setFormData({
        name: "",
        type: "Building",
        description: "",
        lat: 14.402870,
        lng: 120.8640,
        departments: [],
        image: "",
        markerIcon: "building",
        polygon: null,
        polygonColor: "#FACC15",
        polygonOpacity: 0.3,
      });
    }
    setMapClickEnabled(false);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingBuilding(null);
    setDepartmentInput("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBuilding) {
      updateMutation.mutate({ id: editingBuilding.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleAddDepartment = () => {
    if (departmentInput.trim()) {
      setFormData({
        ...formData,
        departments: [...(formData.departments || []), departmentInput.trim()]
      });
      setDepartmentInput("");
    }
  };

  const handleRemoveDepartment = (index: number) => {
    setFormData({
      ...formData,
      departments: formData.departments?.filter((_, i) => i !== index) || []
    });
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (mapClickEnabledRef.current) {
      setFormData(prev => ({
        ...prev,
        lat,
        lng
      }));
      toast({ title: "Location updated", description: `Set to ${lat.toFixed(6)}, ${lng.toFixed(6)}` });
    }
  };

  const toggleMapClick = () => {
    setMapClickEnabled(!mapClickEnabled);
  };

  const markerIconOptions = [
    { value: "building", label: "Building", icon: Building2 },
    { value: "school", label: "School", icon: School },
    { value: "hospital", label: "Hospital", icon: Hospital },
    { value: "store", label: "Store", icon: Store },
    { value: "home", label: "Home", icon: Home },
  ];

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Building Management</h1>
            <p className="text-muted-foreground">Manage campus buildings and locations</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} data-testid="button-add-building">
                <Plus className="w-4 h-4 mr-2" />
                Add Building
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingBuilding ? "Edit Building" : "Add New Building"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="name">Location Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="input-building-name"
                  />
                </div>

                <div>
                  <Label htmlFor="type">Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => {
                      setFormData({ 
                        ...formData, 
                        type: value,
                        departments: canHaveDepartments(value as any) ? formData.departments : []
                      });
                    }}
                  >
                    <SelectTrigger id="type" data-testid="select-poi-type">
                      <SelectValue placeholder="Select location type" />
                    </SelectTrigger>
                    <SelectContent className="z-[10000] max-h-[300px]">
                      {poiTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    data-testid="textarea-building-description"
                  />
                </div>

                <div>
                  <Label>Location *</Label>
                  <div className="mt-2 space-y-3">
                    <Button
                      type="button"
                      variant={mapClickEnabled ? "default" : "outline"}
                      className="w-full"
                      onClick={toggleMapClick}
                      data-testid="button-toggle-map-click"
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      {mapClickEnabled ? "Click map to place marker (Active)" : "Click to enable map placement"}
                    </Button>
                    
                    <div className="h-[300px] rounded-lg overflow-hidden border">
                      <CampusMap
                        buildings={[{ ...formData, id: "preview", name: formData.name || "New Building", markerIcon: formData.markerIcon }] as Building[]}
                        onMapClick={handleMapClick}
                        centerLat={formData.lat}
                        centerLng={formData.lng}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="lat" className="text-xs">Latitude</Label>
                        <Input
                          id="lat"
                          type="number"
                          step="any"
                          value={formData.lat}
                          onChange={(e) => setFormData({ ...formData, lat: parseFloat(e.target.value) })}
                          required
                          data-testid="input-building-lat"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lng" className="text-xs">Longitude</Label>
                        <Input
                          id="lng"
                          type="number"
                          step="any"
                          value={formData.lng}
                          onChange={(e) => setFormData({ ...formData, lng: parseFloat(e.target.value) })}
                          required
                          data-testid="input-building-lng"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="markerIcon">Marker Icon</Label>
                  <Select
                    value={formData.markerIcon || "building"}
                    onValueChange={(value) => setFormData({ ...formData, markerIcon: value })}
                  >
                    <SelectTrigger id="markerIcon" data-testid="select-marker-icon">
                      <SelectValue placeholder="Select marker icon" />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      {markerIconOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <option.icon className="w-4 h-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <ImageUploadInput
                  label="Building Photo"
                  value={formData.image}
                  onChange={(url) => setFormData({ ...formData, image: url })}
                  type="building"
                  id={editingBuilding?.id || 'new'}
                  testId="building-image"
                />

                <div>
                  <Label>
                    <Shapes className="w-4 h-4 inline mr-2" />
                    Building Area / Boundary (Optional)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    Draw a polygon or rectangle to highlight the building's area on the map. This helps users identify the building's footprint.
                  </p>
                  
                  <div className="mb-4 space-y-4">
                    <div>
                      <Label htmlFor="polygonColor" className="text-sm">Polygon Color</Label>
                      <div className="flex items-center gap-3 mt-2">
                        <Input
                          id="polygonColor"
                          type="color"
                          value={formData.polygonColor || "#FACC15"}
                          onChange={(e) => setFormData({ ...formData, polygonColor: e.target.value })}
                          data-testid="input-polygon-color"
                          className="w-16 h-10 cursor-pointer"
                        />
                        <span className="text-sm text-muted-foreground">{formData.polygonColor || "#FACC15"}</span>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="polygonOpacity" className="text-sm">Polygon Opacity</Label>
                      <div className="flex items-center gap-3 mt-2">
                        <input
                          id="polygonOpacity"
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={formData.polygonOpacity || 0.3}
                          onChange={(e) => setFormData({ ...formData, polygonOpacity: parseFloat(e.target.value) })}
                          data-testid="input-polygon-opacity"
                          className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-sm text-muted-foreground w-12 text-right">{((formData.polygonOpacity || 0.3) * 100).toFixed(0)}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">0% = transparent, 100% = solid (fully opaque)</p>
                    </div>
                  </div>

                  <div className="h-[300px] rounded-lg overflow-hidden border">
                    <PolygonDrawingMap
                      centerLat={formData.lat}
                      centerLng={formData.lng}
                      polygon={formData.polygon as LatLng[] | null}
                      onPolygonChange={(polygon) => setFormData({ ...formData, polygon: polygon as any })}
                      polygonColor={formData.polygonColor || "#FACC15"}
                      existingBuildings={buildings.filter(b => !editingBuilding || b.id !== editingBuilding.id) as any}
                    />
                  </div>
                  {formData.polygon && Array.isArray(formData.polygon) && formData.polygon.length > 0 && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Shapes className="w-4 h-4" />
                      <span>Polygon with {formData.polygon.length} points</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData({ ...formData, polygon: null })}
                        data-testid="button-clear-polygon"
                        className="ml-auto text-destructive"
                      >
                        Clear Polygon
                      </Button>
                    </div>
                  )}
                </div>

                {canHaveDepartments(formData.type as any) && (
                  <div>
                    <Label>Departments</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        value={departmentInput}
                        onChange={(e) => setDepartmentInput(e.target.value)}
                        placeholder="Department name"
                        data-testid="input-department"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddDepartment}
                        data-testid="button-add-department"
                      >
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {formData.departments?.map((dept, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 bg-secondary px-3 py-1 rounded-md"
                        >
                          <span className="text-sm">{dept}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDepartment(index)}
                            className="text-destructive hover:text-destructive/80"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-building"
                  >
                    {editingBuilding ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="h-[600px] overflow-hidden">
              <CampusMap buildings={buildings} onBuildingClick={handleOpenDialog} />
            </Card>
          </div>

          <div>
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Buildings List</h2>
              
              <div className="mb-4 space-y-3">
                <div>
                  <Label htmlFor="search-buildings" className="text-sm">Search Buildings</Label>
                  <Input
                    id="search-buildings"
                    placeholder="Search by name or type..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-buildings"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="type-filter" className="text-sm">Filter by Type</Label>
                  <Select
                    value={selectedTypeFilter}
                    onValueChange={setSelectedTypeFilter}
                  >
                    <SelectTrigger id="type-filter" data-testid="select-type-filter" className="mt-1">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent className="z-[100] max-h-[300px]">
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
                  <motion.div 
                    className="space-y-3 max-h-[500px] overflow-y-auto"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    {filteredBuildings.length === 0 ? (
                      <div className="text-center py-8">
                        <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No buildings found</p>
                      </div>
                    ) : (
                      filteredBuildings.map((building) => (
                        <motion.div key={building.id} variants={itemVariants}>
                          <div
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
                        </motion.div>
                      ))
                    )}
                  </motion.div>
                );
              })()}
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
