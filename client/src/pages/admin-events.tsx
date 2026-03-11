import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Calendar as CalendarIcon, Check, ChevronsUpDown, X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/admin-layout";
import ImageUploadInput from "@/components/image-upload-input";
import { ProxiedImage } from "@/components/proxied-image";
import type { Event, InsertEvent, Building, Floor, IndoorNode } from "@shared/schema";
import { eventClassifications } from "@shared/schema";
import { invalidateEndpointCache } from "@/lib/offline-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

function getClassificationBadgeClass(classification: string | null | undefined) {
  switch (classification) {
    case "Event": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "Announcement": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "Achievement": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    default: return "";
  }
}

export default function AdminEvents() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [classificationFilter, setClassificationFilter] = useState<string>("All");
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [formData, setFormData] = useState<InsertEvent & { images?: string[] }>({
    title: "",
    description: "",
    date: "",
    time: "",
    endDate: "",
    endTime: "",
    location: "",
    buildingId: null,
    roomId: null as string | null,
    image: "",
    images: [],
    classification: "Event",
  });
  const { toast } = useToast();

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ['/api/events']
  });

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings']
  });

  const { data: floors = [] } = useQuery<Floor[]>({
    queryKey: ['/api/floors']
  });

  const { data: indoorNodes = [] } = useQuery<IndoorNode[]>({
    queryKey: ['/api/indoor-nodes']
  });

  const formBuildingRoomNodes = useMemo(() => {
    if (!formData.buildingId) return [];
    const buildingFloorIds = new Set(
      floors.filter(f => f.buildingId === formData.buildingId).map(f => f.id)
    );
    return indoorNodes
      .filter(n => !['entrance', 'stairway', 'elevator', 'hallway'].includes(n.type) && buildingFloorIds.has(n.floorId))
      .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }, [formData.buildingId, floors, indoorNodes]);

  const createMutation = useMutation({
    mutationFn: (data: InsertEvent & { images?: string[] }) => apiRequest('POST', '/api/events', data),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/events', queryClient);
      toast({ title: "Event created successfully" });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsertEvent & { images?: string[] } }) =>
      apiRequest('PUT', `/api/events/${id}`, data),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/events', queryClient);
      toast({ title: "Event updated successfully" });
      handleCloseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/events/${id}`, null),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/events', queryClient);
      toast({ title: "Event deleted successfully" });
      setDeletingEventId(null);
    },
  });

  const handleOpenDialog = (event?: Event) => {
    if (event) {
      setEditingEvent(event);
      const eventImages = (event as any).images?.length ? (event as any).images : (event.image ? [event.image] : []);
      setFormData({
        title: event.title,
        description: event.description || "",
        date: event.date,
        time: event.time || "",
        endDate: event.endDate || "",
        endTime: event.endTime || "",
        location: event.location || "",
        buildingId: event.buildingId || null,
        roomId: (event as any).roomId || null,
        image: event.image || "",
        images: eventImages,
        classification: event.classification || "Event",
      });
    } else {
      setEditingEvent(null);
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        title: "",
        description: "",
        date: today,
        time: "",
        endDate: "",
        endTime: "",
        location: "",
        buildingId: null,
        roomId: null,
        image: "",
        images: [],
        classification: "Event",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingEvent(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.endDate && formData.date && formData.endDate < formData.date) {
      toast({ title: "Invalid dates", description: "End date cannot be before the start date.", variant: "destructive" });
      return;
    }
    const images = formData.images || [];
    const submitData = {
      ...formData,
      image: images[0] || formData.image || "",
      images,
    };
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  return (
    <AdminLayout>
      <div className="p-8 relative">
        {isLoading && (
          <div className="absolute inset-0 z-50 bg-background/90 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid hsl(var(--muted-foreground) / 0.2)', borderTopColor: 'hsl(var(--primary))' }} />
            <span className="text-base font-semibold text-foreground">Event Management</span>
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        )}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Events Management</h1>
            <p className="text-muted-foreground">Manage campus events and announcements</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} data-testid="button-add-event">
                <Plus className="w-4 h-4 mr-2" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingEvent ? "Edit Event" : "Add New Event"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="title">Event Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    data-testid="input-event-title"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    data-testid="textarea-event-description"
                  />
                </div>

                <div>
                  <Label htmlFor="classification">Classification *</Label>
                  <Select
                    value={formData.classification}
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      classification: value as typeof formData.classification
                    })}
                  >
                    <SelectTrigger data-testid="select-event-classification">
                      <SelectValue placeholder="Select classification" />
                    </SelectTrigger>
                    <SelectContent className="z-[1002]">
                      {eventClassifications.map((classification) => (
                        <SelectItem key={classification} value={classification}>
                          {classification}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Only show date and time for non-Achievement classifications */}
                {formData.classification !== "Achievement" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="date">Start Date *</Label>
                        <Input
                          id="date"
                          type="date"
                          value={formData.date}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            const updates: any = { ...formData, date: newDate };
                            if (formData.endDate && newDate > formData.endDate) {
                              updates.endDate = "";
                            }
                            setFormData(updates);
                          }}
                          required
                          data-testid="input-event-date"
                        />
                      </div>
                      <div>
                        <Label htmlFor="time">Start Time</Label>
                        <Input
                          id="time"
                          type="time"
                          value={formData.time || ""}
                          onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                          data-testid="input-event-time"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="endDate">End Date</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={formData.endDate || ""}
                          min={formData.date || undefined}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          data-testid="input-event-end-date"
                        />
                        {formData.date && formData.endDate && formData.endDate < formData.date && (
                          <p className="text-xs text-destructive mt-1">End date must be on or after the start date.</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="endTime">End Time</Label>
                        <Input
                          id="endTime"
                          type="time"
                          value={formData.endTime || ""}
                          onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                          data-testid="input-event-end-time"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="building">Event Location (Building)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                        data-testid="select-event-building"
                      >
                        {formData.buildingId 
                          ? buildings.find(b => b.id === formData.buildingId)?.name 
                          : "No specific building"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 z-[1002]">
                      <Command>
                        <CommandInput placeholder="Search building..." />
                        <CommandList>
                          <CommandEmpty>No building found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="none"
                              onSelect={() => {
                                setFormData({ ...formData, buildingId: null, roomId: null });
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.buildingId === null ? "opacity-100" : "opacity-0"
                                )}
                              />
                              No specific building
                            </CommandItem>
                            {buildings
                              .slice()
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((building) => (
                                <CommandItem
                                  key={building.id}
                                  value={building.name}
                                  onSelect={() => {
                                    setFormData({ ...formData, buildingId: building.id, roomId: null });
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Select if event is at a specific campus building (enables "Get Direction" button)
                  </p>
                </div>

                {formData.buildingId && (
                  <div>
                    <Label htmlFor="room">Room (optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                          data-testid="select-event-room"
                        >
                          {formData.roomId
                            ? formBuildingRoomNodes.find(n => n.id === formData.roomId)?.label ?? "Unknown room"
                            : "None (building only)"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[1002]">
                        <Command>
                          <CommandInput placeholder="Search room..." />
                          <CommandList className="max-h-60 overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
                            <CommandEmpty>No room nodes found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="none"
                                onSelect={() => setFormData({ ...formData, roomId: null })}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    !formData.roomId ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                None (building only)
                              </CommandItem>
                              {formBuildingRoomNodes.map((node) => (
                                <CommandItem
                                  key={node.id}
                                  value={node.label || node.id}
                                  onSelect={() => setFormData({ ...formData, roomId: node.id })}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.roomId === node.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {node.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground mt-1">
                      If a room is assigned, directions will navigate indoors to that room.
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="location">Additional Location Details</Label>
                  <Input
                    id="location"
                    value={formData.location || ""}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Room 101, Auditorium, or off-campus address"
                    data-testid="input-event-location"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Add room number or additional details about the location
                  </p>
                </div>

                <ImageUploadInput
                  label="Event Photos"
                  value={formData.images || []}
                  onChange={(val) => setFormData({ ...formData, images: Array.isArray(val) ? val : (val ? [val] : []) })}
                  type="event"
                  id={editingEvent?.id || 'new'}
                  testId="event-image"
                  multiple={true}
                  onUploadingChange={setIsUploadingImage}
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
                    disabled={createMutation.isPending || updateMutation.isPending || isUploadingImage}
                    className={cn(isUploadingImage && "opacity-50 pointer-events-none cursor-not-allowed")}
                    data-testid="button-save-event"
                  >
                    {isUploadingImage ? "Uploading..." : editingEvent ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="search-events" className="text-sm">Search Events</Label>
              <Input
                id="search-events"
                placeholder="Search by title, description, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-events"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="classification-filter" className="text-sm">Filter by Classification</Label>
              <Select
                value={classificationFilter}
                onValueChange={setClassificationFilter}
              >
                <SelectTrigger id="classification-filter" data-testid="select-classification-filter" className="mt-1">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  <SelectItem value="All">All Classifications</SelectItem>
                  {eventClassifications.map((classification) => (
                    <SelectItem key={classification} value={classification}>
                      {classification}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-6">
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <Card key={i} className="h-80 animate-pulse bg-muted" />
            ))
          ) : events.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <CalendarIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-medium text-foreground mb-2">No Events Yet</h3>
              <p className="text-muted-foreground">Create your first event to get started</p>
            </div>
          ) : (() => {
            const filteredEvents = events.filter((event) => {
              const matchesSearch = searchQuery === "" || 
                event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (event.description?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (event.location?.toLowerCase().includes(searchQuery.toLowerCase()));
              const matchesClassification = classificationFilter === "All" || event.classification === classificationFilter;
              return matchesSearch && matchesClassification;
            });
            return filteredEvents.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <CalendarIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-medium text-foreground mb-2">No Events Found</h3>
                <p className="text-muted-foreground">Try adjusting your search or filters</p>
              </div>
            ) : (
              filteredEvents.map((event) => {
                const eventImages: string[] = (event as any).images?.length ? (event as any).images : (event.image ? [event.image] : []);
                const primaryImage = eventImages[0] || null;
                return (
                  <Card key={event.id} className="flex flex-col overflow-hidden" data-testid={`event-item-${event.id}`}>
                    {primaryImage ? (
                      <div className="w-full overflow-hidden relative group cursor-pointer" onClick={() => setLightboxUrl(primaryImage)}>
                        <ProxiedImage src={primaryImage} alt={event.title} className="w-full h-auto" />
                        {eventImages.length > 1 && (
                          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                            +{eventImages.length - 1} more
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full aspect-[4/3] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <CalendarIcon className="w-12 h-12 text-primary/40" />
                      </div>
                    )}
                    <div className="p-6 flex flex-col flex-1">
                      <div className="mb-3">
                        <Badge variant="secondary" className={cn("mb-2", getClassificationBadgeClass(event.classification))}>
                          {event.classification}
                        </Badge>
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-2">
                        {event.title}
                      </h3>
                      {event.classification !== "Achievement" && (
                        <div className="text-sm text-muted-foreground mb-3 space-y-1">
                          <div>{event.date} {event.time && `• ${event.time}`}</div>
                          {event.endDate && (
                            <div className="text-xs">→ {event.endDate} {event.endTime && `• ${event.endTime}`}</div>
                          )}
                        </div>
                      )}
                      {event.description && (
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                          {event.description}
                        </p>
                      )}
                      <div className="flex gap-2 mt-auto">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleOpenDialog(event)}
                          data-testid={`button-edit-${event.id}`}
                        >
                          <Pencil className="w-3 h-3 mr-2" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeletingEventId(event.id)}
                          data-testid={`button-delete-${event.id}`}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })
            );
          })()}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingEventId} onOpenChange={(open) => !open && setDeletingEventId(null)}>
        <AlertDialogContent className="z-[10002]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingEventId && deleteMutation.mutate(deletingEventId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxUrl(null)}
          data-testid="lightbox-overlay"
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setLightboxUrl(null)}
            data-testid="button-close-lightbox"
          >
            <X className="w-6 h-6" />
          </Button>
          <img
            src={lightboxUrl}
            alt="Full size preview"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
            data-testid="lightbox-image"
          />
        </div>
      )}
    </AdminLayout>
  );
}
