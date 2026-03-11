import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProxiedImage } from "@/components/proxied-image";
import { cn } from "@/lib/utils";
import type { Event } from "@shared/schema";

interface CalendarViewProps {
  events: Event[];
  onEventSelect: (event: Event) => void;
}

function getClassificationBadgeClass(classification: string | null | undefined) {
  switch (classification) {
    case "Event": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "Announcement": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "Achievement": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    default: return "";
  }
}

function getClassificationDotColor(classification: string | null | undefined) {
  switch (classification) {
    case "Event": return "bg-orange-500";
    case "Announcement": return "bg-blue-500";
    case "Achievement": return "bg-green-500";
    default: return "bg-primary";
  }
}

function formatEventDate(dateStr: string): string {
  if (!dateStr) return dateStr;
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function CalendarView({ events, onEventSelect }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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

  const days = Array.from({ length: daysInMonth(currentDate) }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth(currentDate) }, (_, i) => i);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dateEventsForModal = selectedDate ? getEventsForDate(selectedDate) : [];

  const handleEventSelect = (event: Event) => {
    onEventSelect(event);
    setSelectedDate(null);
  };

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
                className={`aspect-square p-1 rounded-md border transition-all cursor-pointer text-xs flex flex-col items-start justify-start overflow-hidden ${
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
                <div className="font-medium text-foreground text-xs font-semibold">{day}</div>
                {dayEvents.length > 0 && (
                  <div className="flex flex-col gap-0.5 w-full flex-1 justify-start overflow-hidden">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className={cn(
                          "text-xs text-white px-1 rounded truncate whitespace-nowrap pointer-events-none",
                          getClassificationDotColor(event.classification)
                        )}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{dayEvents.length - 2}
                      </div>
                    )}
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
          <Card className="w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl flex flex-col" data-testid="modal-date-events">
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
            <div className="flex-1 overflow-y-auto">
              {dateEventsForModal.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <Calendar className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No events scheduled for this date</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {dateEventsForModal.map((event) => {
                    const eventImages: string[] = (event as any).images?.length
                      ? (event as any).images
                      : (event.image ? [event.image] : []);
                    const primaryImage = eventImages[0] || null;
                    return (
                      <button
                        key={event.id}
                        onClick={() => handleEventSelect(event)}
                        className="w-full flex items-start gap-3 p-4 hover:bg-muted transition-colors text-left"
                        data-testid={`modal-event-card-${event.id}`}
                      >
                        {primaryImage ? (
                          <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden">
                            <ProxiedImage src={primaryImage} alt={event.title} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 flex-shrink-0 rounded-md bg-muted flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <Badge
                            variant="secondary"
                            className={cn("mb-1 text-xs", getClassificationBadgeClass(event.classification))}
                          >
                            {event.classification}
                          </Badge>
                          <p className="font-semibold text-foreground text-sm line-clamp-2 mb-1">
                            {event.title}
                          </p>
                          {event.classification !== "Achievement" && (
                            <p className="text-xs text-muted-foreground">
                              {formatEventDate(event.date)}
                              {event.endDate && event.endDate !== event.date && ` – ${formatEventDate(event.endDate)}`}
                            </p>
                          )}
                          {event.location && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.location}</p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}
