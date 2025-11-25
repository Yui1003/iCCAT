import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import useEmblaCarousel from "embla-carousel-react";
import type { Event } from "@shared/schema";

interface CalendarViewProps {
  events: Event[];
  onEventSelect: (event: Event) => void;
}

export function CalendarView({ events, onEventSelect }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'center',
    containScroll: 'trimSnaps',
    skipSnaps: false,
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const firstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isSameDate = (date1: string, date2: Date) => {
    const d1 = new Date(date1);
    return (
      d1.getFullYear() === date2.getFullYear() &&
      d1.getMonth() === date2.getMonth() &&
      d1.getDate() === date2.getDate()
    );
  };

  const isDateInRange = (eventDate: string, eventEndDate: string | undefined | null, calendarDate: Date) => {
    const start = new Date(eventDate);
    const end = eventEndDate ? new Date(eventEndDate) : start;
    const target = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate());

    return target >= start && target <= end;
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      if (isSameDate(event.date, date)) return true;
      if (event.endDate && isDateInRange(event.date, event.endDate, date)) return true;
      return false;
    });
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const onSelect = () => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  };

  emblaApi?.on('select', onSelect);

  const days = Array.from({ length: daysInMonth(currentDate) }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth(currentDate) }, (_, i) => i);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dateEventsForModal = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <Card className="p-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={previousMonth}
              data-testid="button-calendar-prev-month"
              className="h-8 w-8"
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={nextMonth}
              data-testid="button-calendar-next-month"
              className="h-8 w-8"
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Day Names */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayNames.map((day) => (
            <div key={day} className="text-center font-semibold text-xs text-muted-foreground py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty days before month starts */}
          {emptyDays.map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* Days of month */}
          {days.map((day) => {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dayEvents = getEventsForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();
            const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(date)}
                className={`aspect-square p-1 rounded-md border transition-all cursor-pointer text-xs flex flex-col items-center justify-start ${
                  isSelected
                    ? "border-primary bg-primary/20 ring-2 ring-primary"
                    : isToday
                    ? "border-primary bg-primary/10"
                    : dayEvents.length > 0
                    ? "border-accent bg-accent/5 hover:bg-accent/10"
                    : "border-border bg-background hover:bg-muted"
                }`}
                data-testid={`calendar-day-${day}`}
              >
                <div className="font-medium text-foreground text-xs">{day}</div>
                {dayEvents.length > 0 && (
                  <div className="text-xs text-primary font-semibold mt-0.5">
                    {dayEvents.length > 1 ? `${dayEvents.length}` : "●"}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Modal for Selected Date Events */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col" data-testid="modal-date-events">
            {/* Modal Header */}
            <div className="sticky top-0 bg-card border-b border-card-border p-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-semibold text-foreground">
                {selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedDate(null)}
                data-testid="button-close-date-modal"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden">
              {dateEventsForModal.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <Calendar className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No events scheduled for this date</p>
                </div>
              ) : (
                <>
                  {/* Embla Carousel for Event Cards */}
                  <div className="overflow-hidden" ref={emblaRef}>
                    <div className="flex h-full">
                      {dateEventsForModal.map((event) => (
                        <div key={event.id} className="flex-shrink-0 w-full h-full flex items-center justify-center p-8">
                          <button
                            onClick={() => {
                              onEventSelect(event);
                              setSelectedDate(null);
                            }}
                            className="w-full h-full"
                            data-testid={`modal-event-card-${event.id}`}
                          >
                            <Card className="w-full h-full flex flex-col overflow-hidden cursor-pointer hover-elevate active-elevate-2 transition-all">
                              {event.image ? (
                                <div className="w-full h-48 bg-muted overflow-hidden">
                                  <img
                                    src={event.image}
                                    alt={event.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-full h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                  <Calendar className="w-16 h-16 text-primary/40" />
                                </div>
                              )}
                              <div className="p-6 flex flex-col flex-1">
                                <div className="mb-3">
                                  <Badge variant="secondary" className="text-sm">
                                    {event.classification}
                                  </Badge>
                                </div>

                                <h3 className="text-2xl font-semibold text-foreground mb-3 line-clamp-3">
                                  {event.title}
                                </h3>

                                {event.classification !== "Achievement" && (
                                  <div className="flex flex-col gap-2 text-sm mb-4 pb-4 border-b border-border">
                                    {event.time && (
                                      <p className="text-muted-foreground">
                                        <span className="font-medium">Time:</span> {event.time}
                                        {event.endTime && ` - ${event.endTime}`}
                                      </p>
                                    )}
                                    {event.location && (
                                      <p className="text-muted-foreground">
                                        <span className="font-medium">Location:</span> {event.location}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {event.description && (
                                  <p className="text-base text-muted-foreground line-clamp-4 flex-1">
                                    {event.description}
                                  </p>
                                )}

                                <p className="text-xs text-muted-foreground mt-4">
                                  Click to see full details
                                </p>
                              </div>
                            </Card>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Carousel Navigation */}
                  {dateEventsForModal.length > 1 && (
                    <div className="border-t border-card-border bg-card p-4 flex items-center justify-between gap-4">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => emblaApi?.scrollPrev()}
                        disabled={!canScrollPrev}
                        data-testid="carousel-prev-date-events"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Swipe left/right to browse
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => emblaApi?.scrollNext()}
                        disabled={!canScrollNext}
                        data-testid="carousel-next-date-events"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Upcoming Events List (when no date is selected) */}
      {!selectedDate && (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">Upcoming Events</h3>
          {events.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              No events scheduled
            </Card>
          ) : (
            <div className="space-y-2">
              {events
                .filter(event => {
                  const eventDate = new Date(event.date);
                  return eventDate >= new Date();
                })
                .slice(0, 5)
                .map((event) => (
                  <Card
                    key={event.id}
                    className="p-4 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => onEventSelect(event)}
                    data-testid={`upcoming-event-${event.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {event.date}
                          {event.time && ` at ${event.time}`}
                          {event.endDate && ` - ${event.endDate}${event.endTime ? ` at ${event.endTime}` : ""}`}
                        </p>
                      </div>
                      <Badge variant="secondary">{event.classification}</Badge>
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
