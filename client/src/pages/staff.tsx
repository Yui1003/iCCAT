import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Search, MapPin, Mail, Phone, Navigation, ChevronRight, Building2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProxiedImage } from "@/components/proxied-image";
import GetDirectionsDialog from "@/components/get-directions-dialog";
import type { Staff, Building } from "@shared/schema";
import { useGlobalInactivity } from "@/hooks/use-inactivity";
import { trackEvent } from "@/lib/analytics-tracker";
import { AnalyticsEventType } from "@shared/analytics-schema";
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
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

// StaffCard component for consistency and animations
function StaffCard({ member, onClick, getBuildingName }: { member: Staff; onClick: () => void; getBuildingName: (id: string | null | undefined) => string }) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        className="p-6 hover-elevate active-elevate-2 cursor-pointer h-full"
        data-testid={`staff-card-${member.id}`}
        onClick={onClick}
      >
        <div className="flex items-start gap-4 mb-4">
          <Avatar className="w-16 h-16">
            {member.photo ? (
              <ProxiedImage
                src={member.photo}
                alt={member.name}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            )}
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
              <MapPin className="w-4 h-4 opacity-0 flex-shrink-0" /> {/* Spacer */}
              <span className="truncate">{member.email}</span>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

export default function StaffDirectory() {
  // Return to home after 3 minutes of inactivity
  useGlobalInactivity();
  const [viewMode, setViewMode] = useState<"departments" | "staff">("departments");
  const [searchQuery, setSearchQuery] = useState("");
  const [buildingFilter, setBuildingFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [showDirections, setShowDirections] = useState(false);
  const [directionsDestination, setDirectionsDestination] = useState<string | null>(null);
  const [, navigate] = useLocation();

  // Track staff search
  useEffect(() => {
    if (searchQuery.trim()) {
      const startTime = performance.now();
      const duration = performance.now() - startTime;
      trackEvent(AnalyticsEventType.INTERFACE_ACTION, Math.max(1, Math.round(duration)), {
        action: 'staff_searched',
        searchQuery: searchQuery,
        viewMode: viewMode
      });
    }
  }, [searchQuery, viewMode]);

  // Track filter changes
  useEffect(() => {
    if (buildingFilter !== "all" || departmentFilter !== "all") {
      const startTime = performance.now();
      const duration = performance.now() - startTime;
      trackEvent(AnalyticsEventType.INTERFACE_ACTION, Math.max(1, Math.round(duration)), {
        action: 'staff_filtered',
        buildingFilter: buildingFilter,
        departmentFilter: departmentFilter
      });
    }
  }, [buildingFilter, departmentFilter]);

  // Track staff selection
  useEffect(() => {
    if (selectedStaff) {
      const startTime = performance.now();
      const duration = performance.now() - startTime;
      trackEvent(AnalyticsEventType.INTERFACE_ACTION, Math.max(1, Math.round(duration)), {
        action: 'staff_profile_viewed',
        staffId: selectedStaff.id,
        staffName: selectedStaff.name,
        position: selectedStaff.position,
        department: selectedStaff.department
      });
    }
  }, [selectedStaff]);

  const { data: staff = [], isLoading } = useQuery<Staff[]>({
    queryKey: ['/api/staff']
  });

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings']
  });

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  // Filter buildings to only show those that have staff assigned
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

  const staffWithoutDepartment = useMemo(() => 
    staffInSelectedBuilding.filter(s => !s.department),
    [staffInSelectedBuilding]
  );

  const filteredStaff = useMemo(() => {
    return staff.filter(member => {
      const matchesSearch = !searchQuery || 
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.position?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.department?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesBuilding = buildingFilter === "all" || member.buildingId === buildingFilter;
      const matchesDepartment = departmentFilter === "all" || member.department === departmentFilter;

      return matchesSearch && matchesBuilding && matchesDepartment;
    });
  }, [staff, searchQuery, buildingFilter, departmentFilter]);

  const getBuildingName = (buildingId: string | null | undefined) => {
    if (!buildingId) return "Not assigned";
    const building = buildings.find(b => b.id === buildingId);
    return building?.name || "Unknown";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-card-border px-4 py-3 flex-shrink-0 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button className="rounded-full bg-primary text-primary-foreground px-5 gap-1" data-testid="button-back">
                <ChevronLeft className="w-5 h-5" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Staff Directory</h1>
              <p className="text-sm text-muted-foreground">
                {selectedBuildingId ? `Find staff in ${selectedBuilding?.name}` : "Find staff by building"}
              </p>
            </div>
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

          {(selectedBuildingId || searchQuery) && (
            <div className="flex flex-wrap gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedBuildingId(null);
                  setDepartmentFilter("all");
                  setBuildingFilter("all");
                  setSearchQuery("");
                }}
                data-testid="button-back-to-buildings"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Buildings
              </Button>

              {searchQuery && (
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
              )}
            </div>
          )}
        </div>

        {searchQuery ? (
          // SEARCH RESULTS VIEW
          <motion.div 
            className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {filteredStaff.map((member) => (
              <StaffCard 
                key={member.id} 
                member={member} 
                onClick={() => setSelectedStaff(member)} 
                getBuildingName={getBuildingName}
              />
            ))}
          </motion.div>
        ) : !selectedBuildingId ? (
          // BUILDINGS VIEW
          <>
            {isLoading ? (
              <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="h-32 animate-pulse bg-muted" />
                ))}
              </div>
            ) : buildingsWithStaff.length === 0 ? (
              <div className="text-center py-16">
                <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-medium text-foreground mb-2">No Buildings with Staff</h3>
                <p className="text-muted-foreground">No staff members have been added to any buildings yet.</p>
              </div>
            ) : (
              <motion.div 
                className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-4"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {buildingsWithStaff.map((building) => {
                  const buildingStaffCount = staff.filter(s => s.buildingId === building.id).length;
                  return (
                    <motion.div key={building.id} variants={itemVariants}>
                      <Card
                        className="p-6 hover-elevate active-elevate-2 cursor-pointer h-full"
                        data-testid={`building-card-${building.id}`}
                        onClick={() => setSelectedBuildingId(building.id)}
                      >
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                            <MapPin className="w-8 h-8 text-primary" />
                          </div>
                          <h3 className="text-lg font-semibold text-foreground mb-1">{building.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {buildingStaffCount} staff {buildingStaffCount === 1 ? "member" : "members"}
                          </p>
                          <ChevronRight className="w-5 h-5 text-muted-foreground mt-4" />
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </>
        ) : (
          // DEPARTMENTS & STAFF IN BUILDING VIEW
          <div className="space-y-8">
            {departmentsInSelectedBuilding.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4">Departments</h2>
                <motion.div 
                  className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-4"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {departmentsInSelectedBuilding.map((dept) => (
                    <motion.div key={dept.name} variants={itemVariants}>
                      <Card
                        className="p-6 hover-elevate active-elevate-2 cursor-pointer h-full"
                        data-testid={`department-card-${dept.name}`}
                        onClick={() => {
                          setDepartmentFilter(dept.name!);
                          setBuildingFilter(selectedBuildingId);
                          setSearchQuery(dept.name!);
                        }}
                      >
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                            <span className="text-lg font-bold text-primary">{dept.count}</span>
                          </div>
                          <h3 className="text-md font-semibold text-foreground">{dept.name}</h3>
                          <ChevronRight className="w-4 h-4 text-muted-foreground mt-2" />
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              </section>
            )}

            {staffWithoutDepartment.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4">Other Staff</h2>
                <motion.div 
                  className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {staffWithoutDepartment.map((member) => (
                    <StaffCard 
                      key={member.id} 
                      member={member} 
                      onClick={() => setSelectedStaff(member)} 
                      getBuildingName={getBuildingName}
                    />
                  ))}
                </motion.div>
              </section>
            )}
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
                  {selectedStaff.photo ? (
                    <ProxiedImage
                      src={selectedStaff.photo}
                      alt={selectedStaff.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                      {selectedStaff.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  )}
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
          onNavigate={(startId: string, waypointIds: string[], mode: 'walking' | 'driving' | 'accessible', vehicleType?: 'car' | 'motorcycle' | 'bike') => {
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
