import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Event } from "@shared/schema";

interface CalendarViewProps {
  events: Event[];
  onEventSelect: (event: Event) => void;
}

export function CalendarView({ events, onEventSelect }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

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
      // Match start date
      if (isSameDate(event.date, date)) return true;
      // Check if date falls within range
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

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <Card className="p-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={previousMonth}
              data-testid="button-calendar-prev-month"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={nextMonth}
              data-testid="button-calendar-next-month"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Day Names */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {dayNames.map((day) => (
            <div key={day} className="text-center font-semibold text-sm text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Empty days before month starts */}
          {emptyDays.map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* Days of month */}
          {days.map((day) => {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dayEvents = getEventsForDate(date);
            const isToday =
              date.toDateString() === new Date().toDateString();

            return (
              <div
                key={day}
                className={`aspect-square p-2 rounded-md border transition-all ${
                  isToday
                    ? "border-primary bg-primary/10"
                    : dayEvents.length > 0
                    ? "border-accent bg-accent/5"
                    : "border-border bg-background hover:bg-muted"
                }`}
                data-testid={`calendar-day-${day}`}
              >
                <div className="text-sm font-medium text-foreground mb-1">{day}</div>
                {dayEvents.length > 0 && (
                  <div className="space-y-0.5 max-h-16 overflow-y-auto">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        onClick={() => onEventSelect(event)}
                        className="text-xs bg-primary/80 text-primary-foreground rounded px-1 py-0.5 truncate cursor-pointer hover:bg-primary transition-colors"
                        title={event.title}
                        data-testid={`calendar-event-${event.id}`}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Upcoming Events List */}
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
    </div>
  );
}
