import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Users as UsersIcon, Search, Check, ChevronsUpDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

  // Filter buildings to only show staff-allowed POI types
  const staffAllowedBuildings = buildings.filter(b => canHaveStaff(b.type as any));

  // Filter staff based on search query
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

  const groupedStaff = useMemo(() => {
    const grouped: Record<string, Record<string, Staff[]>> = {};

    filteredStaff.forEach(member => {
      const building = buildings.find(b => b.id === member.buildingId);
      const buildingName = building?.name || "Other";
      const departmentName = member.department || "Other";

      if (!grouped[buildingName]) {
        grouped[buildingName] = {};
      }
      if (!grouped[buildingName][departmentName]) {
        grouped[buildingName][departmentName] = [];
      }
      grouped[buildingName][departmentName].push(member);
    });

    return grouped;
  }, [filteredStaff, buildings]);

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
                  value={formData.photo || ""}
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

        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search staff by name, position, department, building, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-staff-search"
          />
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
        ) : Object.keys(groupedStaff).length === 0 ? (
          <Card className="p-16">
            <div className="text-center">
              <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-medium text-foreground mb-2">No Results Found</h3>
              <p className="text-muted-foreground">No staff members match your search criteria</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-12">
            {Object.entries(groupedStaff).sort(([a], [b]) => a.localeCompare(b)).map(([buildingName, departments]) => (
              <div key={buildingName} className="space-y-6">
                <div className="flex items-center gap-2 border-b pb-2">
                  <Building2 className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-bold text-foreground">{buildingName}</h2>
                </div>
                
                <div className="space-y-8 pl-4">
                  {Object.entries(departments).sort(([a], [b]) => a.localeCompare(b)).map(([deptName, members]) => (
                    <div key={deptName} className="space-y-4">
                      <h3 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
                        <span className="w-2 h-2 bg-primary rounded-full" />
                        {deptName}
                      </h3>
                      <div className="grid gap-4">
                        {members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-4 bg-card border border-card-border rounded-lg hover-elevate transition-all"
                            data-testid={`staff-item-${member.id}`}
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <Avatar className="w-12 h-12">
                                <AvatarImage src={(member.photo as string) || undefined} alt={member.name} />
                                <AvatarFallback className="bg-primary text-primary-foreground">
                                  {member.name ? member.name.split(' ').map(n => n[0]).join('').slice(0, 2) : "???"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <h3 className="font-medium text-foreground">{member.name}</h3>
                                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                                  {member.position && <span>{member.position}</span>}
                                  {member.department && (
                                    <>
                                      {member.position && <span>•</span>}
                                      <span>{member.department}</span>
                                    </>
                                  )}
                                </div>
                                <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                                  {member.email && <span>{member.email}</span>}
                                  {member.phone && <span>{member.phone}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleOpenDialog(member)}
                                data-testid={`button-edit-${member.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this staff member?")) {
                                    deleteMutation.mutate(member.id);
                                  }
                                }}
                                data-testid={`button-delete-${member.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
