import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Users as UsersIcon, Search, Check, ChevronsUpDown, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/admin-layout";
import ImageUploadInput from "@/components/image-upload-input";
import type { Staff, InsertStaff, Building } from "@shared/schema";
import { canHaveDepartments, canHaveStaff } from "@shared/schema";
import { invalidateEndpointCache } from "@/lib/offline-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export default function AdminStaff() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState<InsertStaff>({
    name: "",
    position: "",
    department: "",
    buildingId: null,
    floorId: null,
    roomId: null,
    email: "",
    phone: "",
    photo: "",
  });
  const { toast } = useToast();

  const { data: staff = [], isLoading } = useQuery<Staff[]>({
    queryKey: ['/api/staff']
  });

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings']
  });

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: InsertStaff) => apiRequest('POST', '/api/staff', data),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/staff', queryClient);
      toast({ title: "Staff member created successfully" });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsertStaff }) =>
      apiRequest('PUT', `/api/staff/${id}`, data),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/staff', queryClient);
      toast({ title: "Staff member updated successfully" });
      handleCloseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/staff/${id}`, null),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/staff', queryClient);
      toast({ title: "Staff member deleted successfully" });
    },
  });

  const handleOpenDialog = (member?: Staff) => {
    if (member) {
      setEditingStaff(member);
      setFormData({
        name: member.name,
        position: member.position || "",
        department: member.department || "",
        buildingId: member.buildingId || null,
        floorId: member.floorId || null,
        roomId: member.roomId || null,
        email: member.email || "",
        phone: member.phone || "",
        photo: member.photo || "",
      });
    } else {
      setEditingStaff(null);
      setFormData({
        name: "",
        position: "",
        department: "",
        buildingId: null,
        floorId: null,
        roomId: null,
        email: "",
        phone: "",
        photo: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingStaff(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStaff) {
      updateMutation.mutate({ id: editingStaff.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Get unique departments from buildings with type="Building"
  const availableDepartments = Array.from(
    new Set(
      buildings
        .filter(b => canHaveDepartments(b.type as any))
        .flatMap(b => b.departments || [])
        .filter(Boolean)
    )
  ).sort();

  const staffAllowedBuildings = useMemo(() => 
    buildings.filter(b => canHaveStaff(b.type as any)),
    [buildings]
  );

  const buildingsWithStaff = useMemo(() => {
    return buildings
      .filter(building => staff.some(member => member.buildingId === building.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [buildings, staff]);

  const selectedBuilding = useMemo(() => 
    buildings.find(b => b.id === selectedBuildingId),
    [buildings, selectedBuildingId]
  );

  const staffInSelectedBuilding = useMemo(() => 
    [...staff].filter(s => s.buildingId === selectedBuildingId)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [staff, selectedBuildingId]
  );

  const departmentsInSelectedBuilding = useMemo(() => {
    const depts = Array.from(new Set(staffInSelectedBuilding.map(s => s.department).filter(Boolean)));
    return depts.map(dept => ({
      name: dept,
      count: staffInSelectedBuilding.filter(s => s.department === dept).length
    })).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [staffInSelectedBuilding]);

  const staffInSelectedDepartment = useMemo(() => {
    if (!selectedDepartment) return [];
    return staffInSelectedBuilding.filter(s => s.department === selectedDepartment)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [staffInSelectedBuilding, selectedDepartment]);

  const staffWithoutDepartment = useMemo(() => 
    staffInSelectedBuilding.filter(s => !s.department),
    [staffInSelectedBuilding]
  );

  const filteredStaff = useMemo(() => {
    if (!searchQuery.trim()) return staff;

    const query = searchQuery.toLowerCase();
    return staff.filter((member) => {
      const building = buildings.find(b => b.id === member.buildingId);

      return (
        member.name.toLowerCase().includes(query) ||
        member.position?.toLowerCase().includes(query) ||
        member.department?.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query) ||
        member.phone?.toLowerCase().includes(query) ||
        building?.name.toLowerCase().includes(query)
      );
    });
  }, [staff, buildings, searchQuery]);

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Staff Management</h1>
            <p className="text-muted-foreground">Manage faculty and staff directory</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} data-testid="button-add-staff">
                <Plus className="w-4 h-4 mr-2" />
                Add Staff Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingStaff ? "Edit Staff Member" : "Add New Staff Member"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="input-staff-name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="position">Position</Label>
                    <Input
                      id="position"
                      value={formData.position || ""}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      data-testid="input-staff-position"
                    />
                  </div>
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                          data-testid="select-staff-department"
                        >
                          {formData.department || "Select department"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0 z-[1002]">
                        <Command>
                          <CommandInput placeholder="Search department..." />
                          <CommandList>
                            <CommandEmpty>No department found.</CommandEmpty>
                            <CommandGroup>
                              {availableDepartments.map((dept) => (
                                <CommandItem
                                  key={dept}
                                  value={dept}
                                  onSelect={(currentValue) => {
                                    setFormData({ ...formData, department: currentValue });
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.department === dept ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {dept}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div>
                  <Label htmlFor="building">Building</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                        data-testid="select-staff-building"
                      >
                        {formData.buildingId 
                          ? staffAllowedBuildings.find(b => b.id === formData.buildingId)?.name 
                          : "Select building"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 z-[1002]">
                      <Command>
                        <CommandInput placeholder="Search building..." />
                        <CommandList>
                          <CommandEmpty>No building found.</CommandEmpty>
                          <CommandGroup>
                            {staffAllowedBuildings
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((building) => (
                                <CommandItem
                                  key={building.id}
                                  value={building.name}
                                  onSelect={() => {
                                    setFormData({ ...formData, buildingId: building.id });
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.buildingId === building.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {building.name}
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email || ""}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      data-testid="input-staff-email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone || ""}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      data-testid="input-staff-phone"
                    />
                  </div>
                </div>

                  <ImageUploadInput
                    label="Staff Photo"
                    value={(typeof formData.photo === 'string' ? formData.photo : "") || ""}
                    onChange={(url) => setFormData({ ...formData, photo: url })}
                    type="staff"
                    id={editingStaff?.id || 'new'}
                    testId="staff-photo"
                  />

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
                    data-testid="button-save-staff"
                  >
                    {editingStaff ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search staff by name, position, department, building, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12"
              data-testid="input-staff-search"
            />
          </div>

          {(selectedBuildingId || selectedDepartment || searchQuery) && (
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  if (selectedDepartment) {
                    setSelectedDepartment(null);
                  } else if (selectedBuildingId) {
                    setSelectedBuildingId(null);
                  } else {
                    setSearchQuery("");
                  }
                }}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                {selectedDepartment ? `Back to ${selectedBuilding?.name} Departments` : 
                 selectedBuildingId ? "Back to Buildings" : "Clear Search"}
              </Button>
              {selectedBuildingId && (
                <div className="text-sm font-medium text-muted-foreground">
                  {selectedBuilding?.name} {selectedDepartment ? `> ${selectedDepartment}` : ""}
                </div>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : staff.length === 0 ? (
          <Card className="p-16">
            <div className="text-center">
              <UsersIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-medium text-foreground mb-2">No Staff Members</h3>
              <p className="text-muted-foreground">Add your first staff member to get started</p>
            </div>
          </Card>
        ) : searchQuery ? (
          <div className="grid gap-4 lg:grid-cols-3 md:grid-cols-2 grid-cols-1">
            {filteredStaff.map((member) => (
              <Card key={member.id} className="p-6 hover-elevate group">
                <div className="flex items-start gap-4">
                    <Avatar className="w-16 h-16">
                      {member.photo ? (
                        <AvatarImage src={member.photo} alt={member.name} />
                      ) : (
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {member.name ? member.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : "???"}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg truncate">{member.name}</h3>
                    {member.position && <p className="text-sm text-muted-foreground truncate">{member.position}</p>}
                    <div className="mt-2 space-y-1">
                      {member.department && (
                        <Badge variant="secondary" className="text-xs">
                          {member.department}
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {buildings.find(b => b.id === member.buildingId)?.name || "Other"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleOpenDialog(member)}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this staff member?")) {
                        deleteMutation.mutate(member.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : !selectedBuildingId ? (
          <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-4">
            {buildingsWithStaff.map((building) => {
              const buildingStaffCount = staff.filter(s => s.buildingId === building.id).length;
              return (
                <Card
                  key={building.id}
                  className="p-6 hover-elevate cursor-pointer text-center group"
                  onClick={() => setSelectedBuildingId(building.id)}
                >
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    <Building2 className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">{building.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {buildingStaffCount} staff {buildingStaffCount === 1 ? "member" : "members"}
                  </p>
                  <ChevronRight className="w-5 h-5 text-muted-foreground mx-auto mt-4" />
                </Card>
              );
            })}
          </div>
        ) : !selectedDepartment ? (
          <div className="space-y-8">
            {departmentsInSelectedBuilding.length > 0 && (
              <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-4">
                {departmentsInSelectedBuilding.map((dept) => (
                  <Card
                    key={dept.name}
                    className="p-6 hover-elevate cursor-pointer text-center group"
                    onClick={() => setSelectedDepartment(dept.name)}
                  >
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                      <span className="text-lg font-bold text-primary">{dept.count}</span>
                    </div>
                    <h3 className="text-md font-semibold text-foreground">{dept.name}</h3>
                    <ChevronRight className="w-4 h-4 text-muted-foreground mx-auto mt-2" />
                  </Card>
                ))}
              </div>
            )}
            
            {staffWithoutDepartment.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Other Staff</h2>
                <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4">
                  {staffWithoutDepartment.map((member) => (
                    <Card key={member.id} className="p-6 hover-elevate group">
                      <div className="flex items-start gap-4">
                    <Avatar className="w-16 h-16">
                      {member.photo ? (
                        <AvatarImage src={member.photo} alt={member.name} />
                      ) : (
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {member.name ? member.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : "???"}
                        </AvatarFallback>
                      )}
                    </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg truncate">{member.name}</h3>
                          {member.position && <p className="text-sm text-muted-foreground truncate">{member.position}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4 pt-4 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleOpenDialog(member)}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this staff member?")) {
                              deleteMutation.mutate(member.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4">
            {staffInSelectedDepartment.map((member) => (
              <Card key={member.id} className="p-6 hover-elevate group">
                <div className="flex items-start gap-4">
                    <Avatar className="w-16 h-16">
                      {member.photo ? (
                        <AvatarImage src={member.photo} alt={member.name} />
                      ) : (
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {member.name ? member.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : "???"}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg truncate">{member.name}</h3>
                    {member.position && <p className="text-sm text-muted-foreground truncate">{member.position}</p>}
                  </div>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleOpenDialog(member)}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this staff member?")) {
                        deleteMutation.mutate(member.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
