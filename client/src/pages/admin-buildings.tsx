import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, MapPin, Building2, School, Hospital, Store, Home, Shapes, Settings, Eye, EyeOff, RotateCcw, Upload, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/admin-layout";
import CampusMap from "@/components/campus-map";
import PolygonDrawingMap from "@/components/polygon-drawing-map";
import ImageUploadInput from "@/components/image-upload-input";
import type { Building, InsertBuilding, LatLng, CustomPoiType } from "@shared/schema";
import { poiTypes, canHaveDepartments } from "@shared/schema";
import { getPoiTypeIconUrl, BUILTIN_ICON_MAP } from "@/lib/poi-type-icons";
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
  const [formData, setFormData] = useState<InsertBuilding & { polygons?: any }>({
    name: "",
    type: "Building",
    description: "",
    lat: 14.402840436027079,
    lng: 120.86602985858919,
    nodeLat: null,
    nodeLng: null,
    departments: [],
    image: "",
    markerIcon: "building",
    polygon: null,
    polygons: null,
    polygonColor: "#FACC15",
    polygonOpacity: 0.3,
    images: [],
  });
  const [departmentInput, setDepartmentInput] = useState("");
  const [mapClickEnabled, setMapClickEnabled] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("All Types");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const mapClickEnabledRef = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    mapClickEnabledRef.current = mapClickEnabled;
  }, [mapClickEnabled]);

  const [isManageTypesOpen, setIsManageTypesOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeIcon, setNewTypeIcon] = useState<string | null>(null);
  const iconFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingIconFor, setUploadingIconFor] = useState<string | null>(null);

  const { data: buildings = [], isLoading } = useQuery<Building[]>({
    queryKey: ['/api/buildings']
  });

  const { data: poiTypesData, isLoading: isPoiTypesLoading } = useQuery<{
    customTypes: CustomPoiType[];
    hiddenBuiltinTypes: string[];
    iconOverrides: Record<string, string>;
  }>({ queryKey: ['/api/poi-types'] });

  const activeTypes = useMemo(() => {
    const hidden = new Set(poiTypesData?.hiddenBuiltinTypes || []);
    const builtin = [...poiTypes].filter(t => !hidden.has(t));
    const custom = (poiTypesData?.customTypes || []).map(c => c.name);
    return [...builtin, ...custom].sort();
  }, [poiTypesData]);

  // Upload icon helper for type management
  const uploadIconFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'building');
    formData.append('id', 'poi-type-icon');
    const res = await fetch('/api/upload-image', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.url as string;
  };

  const createTypeMutation = useMutation({
    mutationFn: (data: { name: string; icon: string | null }) =>
      apiRequest('POST', '/api/poi-types', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/poi-types'] });
      setNewTypeName("");
      setNewTypeIcon(null);
      toast({ title: "Custom type created" });
    },
    onError: () => toast({ title: "Failed to create type", variant: "destructive" }),
  });

  const deleteCustomTypeMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/poi-types/custom/${id}`, null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/poi-types'] });
      toast({ title: "Custom type deleted" });
    },
    onError: () => toast({ title: "Failed to delete type", variant: "destructive" }),
  });

  const hideTypeMutation = useMutation({
    mutationFn: (name: string) => apiRequest('POST', `/api/poi-types/hide/${encodeURIComponent(name)}`, null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/poi-types'] }),
    onError: () => toast({ title: "Failed to hide type", variant: "destructive" }),
  });

  const unhideTypeMutation = useMutation({
    mutationFn: (name: string) => apiRequest('DELETE', `/api/poi-types/hide/${encodeURIComponent(name)}`, null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/poi-types'] }),
    onError: () => toast({ title: "Failed to restore type", variant: "destructive" }),
  });

  const setIconOverrideMutation = useMutation({
    mutationFn: ({ name, iconUrl }: { name: string; iconUrl: string }) =>
      apiRequest('PUT', `/api/poi-types/icon/${encodeURIComponent(name)}`, { iconUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/poi-types'] });
      toast({ title: "Icon updated" });
    },
    onError: () => toast({ title: "Failed to update icon", variant: "destructive" }),
  });

  const resetIconOverrideMutation = useMutation({
    mutationFn: (name: string) => apiRequest('DELETE', `/api/poi-types/icon/${encodeURIComponent(name)}`, null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/poi-types'] });
      toast({ title: "Icon reset to default" });
    },
    onError: () => toast({ title: "Failed to reset icon", variant: "destructive" }),
  });

  const updateCustomTypeIconMutation = useMutation({
    mutationFn: ({ id, name, iconUrl }: { id: string; name: string; iconUrl: string }) =>
      apiRequest('PATCH', `/api/poi-types/${id}`, { name, icon: iconUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/poi-types'] });
      toast({ title: "Icon updated" });
    },
    onError: () => toast({ title: "Failed to update icon", variant: "destructive" }),
  });

  const handleIconFileChange = async (e: React.ChangeEvent<HTMLInputElement>, context: { type: 'builtin'; name: string } | { type: 'custom'; id: string; name: string } | { type: 'new' }) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIconFor(context.type === 'new' ? '__new__' : context.name);
    try {
      const iconUrl = await uploadIconFile(file);
      if (context.type === 'new') {
        setNewTypeIcon(iconUrl);
      } else if (context.type === 'builtin') {
        setIconOverrideMutation.mutate({ name: context.name, iconUrl });
      } else {
        updateCustomTypeIconMutation.mutate({ id: context.id, name: context.name, iconUrl });
      }
    } catch {
      toast({ title: "Icon upload failed", variant: "destructive" });
    } finally {
      setUploadingIconFor(null);
      if (iconFileInputRef.current) iconFileInputRef.current.value = '';
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: InsertBuilding) => apiRequest('POST', '/api/buildings', data),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/buildings', queryClient);
      toast({ title: "Building created successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Failed to save building", variant: "destructive" });
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
    onError: () => {
      toast({ title: "Failed to update building", variant: "destructive" });
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
        nodeLat: (building as any).nodeLat || null,
        nodeLng: (building as any).nodeLng || null,
        departments: building.departments || [],
        image: building.image || "",
        markerIcon: building.markerIcon || "building",
        polygon: null,
        polygons: (building as any).polygons ||
          (building.polygon && Array.isArray(building.polygon) && (building.polygon as any[]).length > 0
            ? [building.polygon]
            : null),
        polygonColor: (building as any).polygonColor || "#FACC15",
        polygonOpacity: (building as any).polygonOpacity || 0.3,
        images: building.images || [],
      });
    } else {
      setEditingBuilding(null);
      setFormData({
        name: "",
        type: "Building",
        description: "",
        lat: 14.402840436027079,
        lng: 120.86602985858919,
        nodeLat: null,
        nodeLng: null,
        departments: [],
        image: "",
        markerIcon: "building",
        polygon: null,
        polygons: null,
        polygonColor: "#FACC15",
        polygonOpacity: 0.3,
        images: [],
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
      // Remove toast to prevent any potential state-related layout shifts or just keep it if it's not the cause
      toast({ title: "Location updated", description: `Set to ${lat.toFixed(6)}, ${lng.toFixed(6)}` });
    }
  };

  const handleNodeMapClick = (lat: number, lng: number) => {
    setFormData(prev => ({
      ...prev,
      nodeLat: lat,
      nodeLng: lng
    }));
    toast({ title: "Building Node updated", description: `Set to ${lat.toFixed(6)}, ${lng.toFixed(6)}` });
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
                      if (value === '__manage__') {
                        setIsManageTypesOpen(true);
                        return;
                      }
                      setFormData({
                        ...formData,
                        type: value,
                        departments: canHaveDepartments(value as any) ? formData.departments : []
                      });
                    }}
                  >
                    <SelectTrigger id="type" data-testid="select-poi-type">
                      <SelectValue placeholder="Select location type">
                        {formData.type && (
                          <div className="flex items-center gap-2">
                            <img
                              src={getPoiTypeIconUrl(formData.type, poiTypesData?.iconOverrides, poiTypesData?.customTypes)}
                              alt={formData.type}
                              className="w-4 h-4 object-contain flex-shrink-0"
                            />
                            <span>{formData.type}</span>
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="z-[10000] max-h-[300px]">
                      {activeTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center gap-2">
                            <img
                              src={getPoiTypeIconUrl(type, poiTypesData?.iconOverrides, poiTypesData?.customTypes)}
                              alt={type}
                              className="w-4 h-4 object-contain flex-shrink-0"
                            />
                            <span>{type}</span>
                          </div>
                        </SelectItem>
                      ))}
                      <Separator className="my-1" />
                      <SelectItem value="__manage__" data-testid="button-manage-types">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Settings className="w-4 h-4" />
                          <span>Manage Types...</span>
                        </div>
                      </SelectItem>
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
                      variant={mapClickEnabled ? "default" : "secondary"}
                      className={`w-full transition-all duration-300 ${
                        mapClickEnabled 
                          ? "bg-green-600 hover:bg-green-700 text-white" 
                          : "bg-blue-600 hover:bg-blue-700 text-white"
                      }`}
                      onClick={toggleMapClick}
                      data-testid="button-toggle-map-click"
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      {mapClickEnabled ? "Click map to place marker (Active)" : "Click to enable map placement"}
                    </Button>
                    
                    <div className={`h-[300px] rounded-lg overflow-hidden border transition-all duration-500 ${!mapClickEnabled ? "blur-sm grayscale-[0.5] opacity-80" : "blur-0 grayscale-0 opacity-100"}`}>
                      <CampusMap
                        buildings={[
                          ...buildings.filter(b => !editingBuilding || b.id !== editingBuilding.id),
                          { ...formData, id: "preview", name: formData.name || "New Building", markerIcon: formData.markerIcon, images: formData.images || [] }
                        ] as any}
                        onMapClick={handleMapClick}
                        centerLat={formData.lat}
                        centerLng={formData.lng}
                        poiTypeData={poiTypesData}
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
                  <div className="flex items-center justify-between mb-2">
                    <Label>Building Node (Pathfinding Entrance) *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({ ...formData, nodeLat: formData.lat, nodeLng: formData.lng })}
                      className="text-xs h-7"
                      data-testid="button-match-marker"
                    >
                      Match to Building Marker
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    Set the specific coordinate for the pathfinding entrance. This is where paths will connect to the building.
                  </p>
                  <div className="space-y-3">
                    <div className="h-[300px] rounded-lg overflow-hidden border">
                      <CampusMap
                        buildings={[
                          ...buildings.filter(b => !editingBuilding || b.id !== editingBuilding.id),
                          { 
                            ...formData, 
                            id: "preview-node", 
                            name: "Building Node", 
                            lat: formData.nodeLat ?? formData.lat,
                            lng: formData.nodeLng ?? formData.lng,
                            markerIcon: "school",
                            images: formData.images || []
                          }
                        ] as any}
                        onMapClick={handleNodeMapClick}
                        centerLat={formData.nodeLat ?? formData.lat}
                        centerLng={formData.nodeLng ?? formData.lng}
                        poiTypeData={poiTypesData}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="nodeLat" className="text-xs">Node Latitude</Label>
                        <Input
                          id="nodeLat"
                          type="number"
                          step="any"
                          value={formData.nodeLat ?? ""}
                          onChange={(e) => setFormData({ ...formData, nodeLat: e.target.value ? parseFloat(e.target.value) : null })}
                          placeholder="Uses building lat"
                          className="text-sm"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="nodeLng" className="text-xs">Node Longitude</Label>
                        <Input
                          id="nodeLng"
                          type="number"
                          step="any"
                          value={formData.nodeLng ?? ""}
                          onChange={(e) => setFormData({ ...formData, nodeLng: e.target.value ? parseFloat(e.target.value) : null })}
                          placeholder="Uses building lng"
                          className="text-sm"
                          required
                        />
                      </div>
                    </div>
                    {(formData.nodeLat || formData.nodeLng) && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setFormData({ ...formData, nodeLat: null, nodeLng: null })}
                        className="text-destructive"
                      >
                        Reset to Building Center
                      </Button>
                    )}
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
                    label="Upload Photos"
                    value={formData.images || []}
                    onChange={(urls) => setFormData({ ...formData, images: urls as string[] })}
                    onUploadingChange={setIsUploading}
                    type="building"
                    id={editingBuilding?.id || 'new'}
                    testId="building-additional-images"
                    multiple={true}
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
                      polygons={(formData as any).polygons as LatLng[][] | null}
                      onPolygonsChange={(polygons) => setFormData({ ...formData, polygons } as any)}
                      polygonColor={formData.polygonColor || "#FACC15"}
                      existingBuildings={buildings.filter(b => !editingBuilding || b.id !== editingBuilding.id) as any}
                    />
                  </div>
                  {(formData as any).polygons && Array.isArray((formData as any).polygons) && (formData as any).polygons.length > 0 && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Shapes className="w-4 h-4" />
                      <span>
                        {(formData as any).polygons.length} polygon{(formData as any).polygons.length > 1 ? 's' : ''} &mdash;&nbsp;
                        {(formData as any).polygons.reduce((sum: number, p: LatLng[]) => sum + p.length, 0)} total points
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData({ ...formData, polygons: null } as any)}
                        data-testid="button-clear-polygon"
                        className="ml-auto text-destructive"
                      >
                        Clear All Polygons
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
                    disabled={createMutation.isPending || updateMutation.isPending || isUploading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending || isUploading}
                    data-testid="button-save-building"
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : (isUploading ? "Uploading..." : (editingBuilding ? "Update" : "Create"))}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="h-[600px] overflow-hidden">
              <CampusMap buildings={buildings} onBuildingClick={handleOpenDialog} poiTypeData={poiTypesData} />
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
                      {activeTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center gap-2">
                            <img
                              src={getPoiTypeIconUrl(type, poiTypesData?.iconOverrides, poiTypesData?.customTypes)}
                              alt={type}
                              className="w-4 h-4 object-contain flex-shrink-0"
                            />
                            <span>{type}</span>
                          </div>
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
                const sortedBuildings = [...buildings].sort((a, b) => 
                  (a.name || "").localeCompare(b.name || "")
                );
                const filteredBuildings = sortedBuildings.filter((building) => {
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

      {/* Manage POI Types Dialog */}
      <Dialog open={isManageTypesOpen} onOpenChange={setIsManageTypesOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto z-[10001]">
          <DialogHeader>
            <DialogTitle>Manage Location Types</DialogTitle>
          </DialogHeader>

          {/* Hidden file input for icon uploads */}
          <input
            ref={iconFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={() => {}}
          />

          {/* Add Custom Type */}
          <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
            <h3 className="font-semibold text-sm">Add Custom Type</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Type name (e.g. Meditation Room)"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                data-testid="input-new-type-name"
                className="flex-1"
              />
            </div>
            {newTypeIcon && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <img src={newTypeIcon} alt="icon preview" className="w-8 h-8 object-contain rounded border" />
                <span>Icon selected</span>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setNewTypeIcon(null)}>Remove</Button>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="button-upload-new-type-icon"
                disabled={uploadingIconFor === '__new__'}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e) => handleIconFileChange(e as any, { type: 'new' });
                  input.click();
                }}
              >
                <Upload className="w-3 h-3 mr-1" />
                {uploadingIconFor === '__new__' ? 'Uploading...' : 'Upload Icon (optional)'}
              </Button>
              <Button
                type="button"
                size="sm"
                data-testid="button-add-custom-type"
                disabled={!newTypeName.trim() || createTypeMutation.isPending}
                onClick={() => {
                  if (!newTypeName.trim()) return;
                  createTypeMutation.mutate({ name: newTypeName.trim(), icon: newTypeIcon });
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                {createTypeMutation.isPending ? 'Adding...' : 'Add Type'}
              </Button>
            </div>
          </div>

          {isPoiTypesLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Loading types...</div>
          ) : (
            <div className="space-y-4">
              {/* Built-in Types */}
              <div>
                <h3 className="font-semibold text-sm mb-2">Built-in Types</h3>
                <div className="space-y-1">
                  {[...poiTypes].sort().map((type) => {
                    const isHidden = poiTypesData?.hiddenBuiltinTypes?.includes(type);
                    const hasOverride = !!poiTypesData?.iconOverrides?.[type];
                    return (
                      <div
                        key={type}
                        data-testid={`poi-type-row-${type}`}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-opacity ${isHidden ? 'opacity-40 bg-muted/20' : 'bg-muted/30'}`}
                      >
                        <img
                          src={getPoiTypeIconUrl(type, poiTypesData?.iconOverrides, poiTypesData?.customTypes)}
                          alt={type}
                          className="w-6 h-6 object-contain flex-shrink-0"
                        />
                        <span className="flex-1 text-sm">{type}</span>
                        {isHidden && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Replace Icon"
                            data-testid={`button-replace-icon-${type}`}
                            disabled={uploadingIconFor === type}
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = (e) => handleIconFileChange(e as any, { type: 'builtin', name: type });
                              input.click();
                            }}
                          >
                            {uploadingIconFor === type ? <Upload className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                          </Button>
                          {hasOverride && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Reset Icon"
                              data-testid={`button-reset-icon-${type}`}
                              onClick={() => resetIconOverrideMutation.mutate(type)}
                            >
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title={isHidden ? 'Restore' : 'Hide'}
                            data-testid={`button-toggle-hide-${type}`}
                            onClick={() => isHidden ? unhideTypeMutation.mutate(type) : hideTypeMutation.mutate(type)}
                          >
                            {isHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Types */}
              {(poiTypesData?.customTypes?.length ?? 0) > 0 && (
                <div>
                  <Separator className="mb-3" />
                  <h3 className="font-semibold text-sm mb-2">Custom Types</h3>
                  <div className="space-y-1">
                    {poiTypesData!.customTypes.map((ct) => (
                      <div
                        key={ct.id}
                        data-testid={`custom-type-row-${ct.id}`}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30"
                      >
                        <img
                          src={getPoiTypeIconUrl(ct.name, poiTypesData?.iconOverrides, poiTypesData?.customTypes)}
                          alt={ct.name}
                          className="w-6 h-6 object-contain flex-shrink-0"
                        />
                        <span className="flex-1 text-sm">{ct.name}</span>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Replace Icon"
                            data-testid={`button-replace-icon-custom-${ct.id}`}
                            disabled={uploadingIconFor === ct.name}
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = (e) => handleIconFileChange(e as any, { type: 'custom', id: ct.id, name: ct.name });
                              input.click();
                            }}
                          >
                            {uploadingIconFor === ct.name ? <Upload className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Delete type"
                            data-testid={`button-delete-custom-type-${ct.id}`}
                            onClick={() => deleteCustomTypeMutation.mutate(ct.id)}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
