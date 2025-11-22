import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, MapPin, Mail, Phone, Navigation } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import GetDirectionsDialog from "@/components/get-directions-dialog";
import type { Staff, Building } from "@shared/schema";
import { useGlobalInactivity } from "@/hooks/use-inactivity";

export default function StaffDirectory() {
  // Return to home after 3 minutes of inactivity
  useGlobalInactivity();
  const [searchQuery, setSearchQuery] = useState("");
  const [buildingFilter, setBuildingFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [showDirections, setShowDirections] = useState(false);
  const [directionsDestination, setDirectionsDestination] = useState<string | null>(null);
  const [, navigate] = useLocation();

  const { data: staff = [], isLoading } = useQuery<Staff[]>({
    queryKey: ['/api/staff']
  });

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings']
  });

  // Filter buildings to only show those that have staff assigned
  const buildingsWithStaff = buildings.filter(building => 
    staff.some(member => member.buildingId === building.id)
  );

  const departments = Array.from(new Set(staff.map(s => s.department).filter(Boolean)));

  const filteredStaff = staff.filter(member => {
    const matchesSearch = !searchQuery || 
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.position?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.department?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesBuilding = buildingFilter === "all" || member.buildingId === buildingFilter;
    const matchesDepartment = departmentFilter === "all" || member.department === departmentFilter;

    return matchesSearch && matchesBuilding && matchesDepartment;
  });

  const getBuildingName = (buildingId: string | null | undefined) => {
    if (!buildingId) return "Not assigned";
    const building = buildings.find(b => b.id === buildingId);
    return building?.name || "Unknown";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-card-border p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Staff Directory</h1>
            <p className="text-sm text-muted-foreground">Find faculty and staff members</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name, position, or department..."
              className="pl-10 h-12"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-staff"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                <SelectTrigger data-testid="select-building-filter">
                  <SelectValue placeholder="Filter by building" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Buildings</SelectItem>
                  {buildingsWithStaff.map(building => (
                    <SelectItem key={building.id} value={building.id}>
                      {building.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-64">
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger data-testid="select-department-filter">
                  <SelectValue placeholder="Filter by department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept!}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="h-40 animate-pulse bg-muted" />
            ))}
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-medium text-foreground mb-2">No Staff Found</h3>
            <p className="text-muted-foreground">
              {searchQuery || buildingFilter !== "all" || departmentFilter !== "all"
                ? "Try adjusting your search filters"
                : "No staff members have been added yet"}
            </p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4">
            {filteredStaff.map((member) => (
              <Card
                key={member.id}
                className="p-6 hover-elevate active-elevate-2 cursor-pointer"
                data-testid={`staff-card-${member.id}`}
                onClick={() => setSelectedStaff(member)}
              >
                <div className="flex items-start gap-4 mb-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={member.photo || undefined} alt={member.name} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                      {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground">{member.name}</h3>
                    {member.position && (
                      <p className="text-sm text-muted-foreground">{member.position}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {member.department && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {member.department}
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{getBuildingName(member.buildingId)}</span>
                  </div>

                  {member.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </div>
                  )}

                  {member.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <span>{member.phone}</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Staff Detail Dialog */}
      <Dialog 
        open={!!selectedStaff && !showDirections} 
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStaff(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md" data-testid="dialog-staff-detail">
          <DialogHeader>
            <DialogTitle>Staff Information</DialogTitle>
          </DialogHeader>
          
          {selectedStaff && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={selectedStaff.photo || undefined} alt={selectedStaff.name} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                    {selectedStaff.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-foreground mb-1">{selectedStaff.name}</h3>
                  {selectedStaff.position && (
                    <p className="text-muted-foreground">{selectedStaff.position}</p>
                  )}
                  {selectedStaff.department && (
                    <Badge variant="secondary" className="mt-2">
                      {selectedStaff.department}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="w-5 h-5" />
                  <span>{getBuildingName(selectedStaff.buildingId)}</span>
                </div>

                {selectedStaff.email && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Mail className="w-5 h-5" />
                    <span className="break-all">{selectedStaff.email}</span>
                  </div>
                )}

                {selectedStaff.phone && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Phone className="w-5 h-5" />
                    <span>{selectedStaff.phone}</span>
                  </div>
                )}
              </div>

              {selectedStaff.buildingId && buildings.find(b => b.id === selectedStaff.buildingId) && (
                <div className="pt-6 border-t border-border">
                  <Button
                    onClick={() => {
                      const building = buildings.find(b => b.id === selectedStaff.buildingId);
                      if (building) {
                        setDirectionsDestination(selectedStaff.buildingId);
                        setShowDirections(true);
                      }
                    }}
                    className="w-full"
                    data-testid="button-staff-get-directions"
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Get Directions
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Get Directions Dialog */}
      {showDirections && directionsDestination && (
        <GetDirectionsDialog
          open={showDirections}
          destination={buildings.find(b => b.id === directionsDestination) || null}
          buildings={buildings}
          onClose={() => {
            setShowDirections(false);
            setDirectionsDestination(null);
          }}
          onNavigate={(startId: string, waypointIds: string[], mode: 'walking' | 'driving', vehicleType?: 'car' | 'motorcycle' | 'bike') => {
            const waypointParam = waypointIds.length > 0 ? `&waypoints=${waypointIds.join(',')}` : '';
            const vehicleParam = vehicleType ? `&vehicle=${vehicleType}` : '';
            navigate(`/navigation?from=${startId}&to=${directionsDestination}&mode=${mode}${waypointParam}${vehicleParam}&autoGenerate=true`);
            setShowDirections(false);
            setDirectionsDestination(null);
            setSelectedStaff(null);
          }}
        />
      )}
    </div>
  );
}
