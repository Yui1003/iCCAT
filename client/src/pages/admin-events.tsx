import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Calendar as CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/admin-layout";
import ImageUploadInput from "@/components/image-upload-input";
import { ProxiedImage } from "@/components/proxied-image";
import type { Event, InsertEvent, Building } from "@shared/schema";
import { eventClassifications } from "@shared/schema";
import { invalidateEndpointCache } from "@/lib/offline-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export default function AdminEvents() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [classificationFilter, setClassificationFilter] = useState<string>("All");
  const [formData, setFormData] = useState<InsertEvent>({
    title: "",
    description: "",
    date: "",
    time: "",
    endDate: "",
    endTime: "",
    location: "",
    buildingId: null,
    image: "",
    classification: "Event",
  });
  const { toast } = useToast();

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ['/api/events']
  });

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings']
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertEvent) => apiRequest('POST', '/api/events', data),
    onSuccess: async () => {
      await invalidateEndpointCache('/api/events', queryClient);
      toast({ title: "Event created successfully" });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsertEvent }) =>
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
    },
  });

  const handleOpenDialog = (event?: Event) => {
    if (event) {
      setEditingEvent(event);
      setFormData({
        title: event.title,
        description: event.description || "",
        date: event.date,
        time: event.time || "",
        endDate: event.endDate || "",
        endTime: event.endTime || "",
        location: event.location || "",
        buildingId: event.buildingId || null,
        image: event.image || "",
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
        image: "",
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
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <AdminLayout>
      <div className="p-8">
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
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
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
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          data-testid="input-event-end-date"
                        />
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
                                setFormData({ ...formData, buildingId: null });
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Select if event is at a specific campus building (enables "Get Direction" button)
                  </p>
                </div>

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
                  label="Event Photo"
                  value={formData.image || ""}
                  onChange={(url) => setFormData({ ...formData, image: url })}
                  type="event"
                  id={editingEvent?.id || 'new'}
                  testId="event-image"
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
                    data-testid="button-save-event"
                  >
                    {editingEvent ? "Update" : "Create"}
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
              filteredEvents.map((event) => (
                <Card key={event.id} className="flex flex-col overflow-hidden" data-testid={`event-item-${event.id}`}>
                  {event.image ? (
                    <div className="w-full overflow-hidden">
                      <ProxiedImage src={event.image} alt={event.title} className="w-full h-auto" />
                    </div>
                  ) : (
                    <div className="w-full aspect-[4/3] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <CalendarIcon className="w-12 h-12 text-primary/40" />
                    </div>
                  )}
                  <div className="p-6 flex flex-col flex-1">
                    <div className="mb-3">
                      <Badge variant="secondary" className="mb-2">
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
                        onClick={() => deleteMutation.mutate(event.id)}
                        data-testid={`button-delete-${event.id}`}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            );
          })()}
        </div>
      </div>
    </AdminLayout>
  );
}
