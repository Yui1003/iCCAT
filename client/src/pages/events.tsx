import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Clock, MapPin, X, Navigation, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProxiedImage } from "@/components/proxied-image";
import GetDirectionsDialog from "@/components/get-directions-dialog";
import { CalendarView } from "@/components/calendar-view";
import type { Event, Building } from "@shared/schema";
import { eventClassifications } from "@shared/schema";
import { useGlobalInactivity } from "@/hooks/use-inactivity";
import useEmblaCarousel from "embla-carousel-react";
import { trackEvent } from "@/lib/analytics-tracker";
import { AnalyticsEventType } from "@shared/analytics-schema";
import { motion, AnimatePresence } from "framer-motion";

// Helper function to determine if event is upcoming/ongoing (green) or past (red)
function getEventStatus(date: string, time?: string | null): 'upcoming' | 'past' {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Parse event date in local timezone to avoid UTC offset issues
  // Handle both ISO (YYYY-MM-DD) and other formats
  let eventDateOnly: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // ISO format: parse manually to avoid UTC interpretation
    const [year, month, day] = date.split('-').map(Number);
    eventDateOnly = new Date(year, month - 1, day);
  } else {
    // Other formats: parse with Date constructor
    const eventDate = new Date(date);
    eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  }
  
  // If event date is in the future, it's upcoming
  if (eventDateOnly > today) {
    return 'upcoming';
  }
  
  // If event date is today and has a valid time
  if (eventDateOnly.getTime() === today.getTime() && time && time.trim()) {
    try {
      const [hours, minutes] = time.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        const eventDateTime = new Date();
        eventDateTime.setHours(hours, minutes, 0, 0);
        
        // If event time hasn't passed yet, it's upcoming
        if (eventDateTime >= now) {
          return 'upcoming';
        }
      }
    } catch {
      // If time parsing fails, treat as upcoming for today's events
      return 'upcoming';
    }
  }
  
  // If event date is today but no valid time specified, consider it upcoming
  if (eventDateOnly.getTime() === today.getTime()) {
    return 'upcoming';
  }
  
  // Otherwise, event is past
  return 'past';
}

// Carousel Navigation Component
function CarouselNavigation({ 
  emblaApi, 
  carouselName 
}: { 
  emblaApi: any;
  carouselName: string;
}) {
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);

  const onSelect = () => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  };

  emblaApi?.on('select', onSelect);

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={() => emblaApi?.scrollPrev()}
        disabled={!canScrollPrev}
        className="h-9 w-9"
        data-testid={`carousel-prev-${carouselName}`}
      >
        <ChevronLeft className="w-5 h-5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => emblaApi?.scrollNext()}
        disabled={!canScrollNext}
        className="h-9 w-9"
        data-testid={`carousel-next-${carouselName}`}
      >
        <ChevronRight className="w-5 h-5" />
      </Button>
    </div>
  );
}

export default function Events() {
  // Return to home after 3 minutes of inactivity
  useGlobalInactivity();
  
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showDirections, setShowDirections] = useState(false);
  const [directionsDestination, setDirectionsDestination] = useState<string | null>(null);
  const [classificationFilter, setClassificationFilter] = useState<string>("all");
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [, navigate] = useLocation();

  // Track filter changes
  useEffect(() => {
    if (classificationFilter !== "all") {
      const startTime = performance.now();
      const duration = performance.now() - startTime;
      trackEvent(AnalyticsEventType.INTERFACE_ACTION, Math.max(1, Math.round(duration)), {
        action: 'events_filtered',
        classification: classificationFilter
      });
    }
  }, [classificationFilter]);

  // Track event selection
  useEffect(() => {
    if (selectedEvent) {
      const startTime = performance.now();
      const duration = performance.now() - startTime;
      trackEvent(AnalyticsEventType.INTERFACE_ACTION, Math.max(1, Math.round(duration)), {
        action: 'event_details_viewed',
        eventId: selectedEvent.id,
        eventTitle: selectedEvent.title,
        classification: selectedEvent.classification
      });
    }
  }, [selectedEvent]);

  // Carousel refs and embla instances
  const [ongoingEmblaRef, ongoingEmblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    skipSnaps: false,
  });

  const [achievementsEmblaRef, achievementsEmblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    skipSnaps: false,
  });

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ['/api/events']
  });

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings']
  });

  // Filter events by classification
  const filteredEvents = classificationFilter === "all" 
    ? events 
    : events.filter(event => event.classification === classificationFilter);

  // Separate achievements from date-based events
  const achievements = filteredEvents.filter(event => event.classification === "Achievement");
  const dateBasedEvents = filteredEvents.filter(event => event.classification !== "Achievement");

  // Separate ongoing/upcoming from ended events (only for non-achievements)
  const ongoingUpcoming = dateBasedEvents.filter(event => getEventStatus(event.date, event.time) === 'upcoming');
  const ended = dateBasedEvents.filter(event => getEventStatus(event.date, event.time) === 'past');

  return (
    <AnimatePresence>
      {selectedEvent && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" data-testid="modal-event-detail">
              <div className="sticky top-0 bg-card border-b border-card-border p-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-semibold text-foreground">Event Details</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedEvent(null)}
                  data-testid="button-close-event-modal"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-6">
                {selectedEvent.image && (
                  <div className="w-full mb-6 rounded-lg bg-muted flex items-center justify-center">
                    <ProxiedImage
                      src={selectedEvent.image}
                      alt={selectedEvent.title}
                      className="w-full h-auto object-contain max-h-[min(60vh,500px)]"
                    />
                  </div>
                )}

                <div className="mb-4">
                  <Badge variant="secondary">
                    {selectedEvent.classification}
                  </Badge>
                </div>

                <h1 className="text-3xl font-bold text-foreground mb-4">
                  {selectedEvent.title}
                </h1>

                {/* Only show date/time for non-Achievement events */}
                {selectedEvent.classification !== "Achievement" && (
                  <div className="flex flex-col gap-3 text-base mb-6 pb-6 border-b border-border">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className={`flex items-center gap-2 ${
                        getEventStatus(selectedEvent.date, selectedEvent.time) === 'upcoming' 
                          ? 'text-green-600 dark:text-green-500' 
                          : 'text-red-600 dark:text-red-500'
                      }`}>
                        <Calendar className="w-5 h-5" />
                        <span>{selectedEvent.date}</span>
                      </div>
                      {selectedEvent.time && (
                        <div className={`flex items-center gap-2 ${
                          getEventStatus(selectedEvent.date, selectedEvent.time) === 'upcoming' 
                            ? 'text-green-600 dark:text-green-500' 
                            : 'text-red-600 dark:text-red-500'
                        }`}>
                          <Clock className="w-5 h-5" />
                          <span>{selectedEvent.time}</span>
                        </div>
                      )}
                    </div>
                    {selectedEvent.endDate && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground ml-7">
                        → to {selectedEvent.endDate}
                        {selectedEvent.endTime && (
                          <>
                            <span>•</span>
                            <span>{selectedEvent.endTime}</span>
                          </>
                        )}
                      </div>
                    )}
                    {selectedEvent.location && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-5 h-5" />
                        <span>{selectedEvent.location}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Show location separately for achievements if exists */}
                {selectedEvent.classification === "Achievement" && selectedEvent.location && (
                  <div className="flex items-center gap-2 text-muted-foreground mb-6 pb-6 border-b border-border">
                    <MapPin className="w-5 h-5" />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}

                {selectedEvent.description && (
                  <div className="prose prose-slate max-w-none mb-6">
                    <p className="text-lg text-foreground whitespace-pre-wrap">
                      {selectedEvent.description}
                    </p>
                  </div>
                )}

                {selectedEvent.buildingId && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <Button
                      onClick={() => {
                        setDirectionsDestination(selectedEvent.buildingId);
                        setShowDirections(true);
                      }}
                      className="w-full"
                      data-testid="button-get-directions"
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      Get Directions
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

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
          }}
        />
      )}
    </div>
  );
}

// EventCard component to avoid duplication
function EventCard({ event, onSelect }: { event: Event; onSelect: (event: Event) => void }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="h-full"
    >
      <Card
        className="flex flex-col overflow-hidden cursor-pointer hover-elevate active-elevate-2 transition-all h-full hover:shadow-lg"
        onClick={() => onSelect(event)}
        data-testid={`event-card-${event.id}`}
      >
      {event.image ? (
        <div className="w-full aspect-[4/3] bg-muted">
          <ProxiedImage
            src={event.image}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full aspect-[4/3] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <Calendar className="w-16 h-16 text-primary/40" />
        </div>
      )}
      
      <div className="p-6 flex flex-col flex-1">
        <div className="mb-3">
          <Badge variant="secondary" className="mb-2">
            {event.classification}
          </Badge>
        </div>

        {/* Only show date/time for non-Achievement events */}
        {event.classification !== "Achievement" && (
          <div className={`flex flex-col gap-1 text-sm mb-3 ${
            getEventStatus(event.date, event.time) === 'upcoming' 
              ? 'text-green-600 dark:text-green-500' 
              : 'text-red-600 dark:text-red-500'
          }`}>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{event.date}</span>
              {event.time && (
                <>
                  <span>•</span>
                  <Clock className="w-4 h-4" />
                  <span>{event.time}</span>
                </>
              )}
            </div>
            {event.endDate && (
              <div className="flex items-center gap-2 text-xs ml-6">
                → {event.endDate}
                {event.endTime && (
                  <>
                    <span>•</span>
                    <span>{event.endTime}</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <h3 className="text-xl font-semibold text-foreground mb-2 line-clamp-2">
          {event.title}
        </h3>

        {event.description && (
          <p className="text-base text-muted-foreground line-clamp-3 mb-4">
            {event.description}
          </p>
        )}

        {event.location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-auto">
            <MapPin className="w-4 h-4" />
            <span>{event.location}</span>
          </div>
        )}

        <div className="mt-4">
          <span className="text-sm text-primary font-medium">Read More →</span>
        </div>
      </div>
    </Card>
  );
}
