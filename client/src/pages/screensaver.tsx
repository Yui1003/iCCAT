import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Hand, Clock } from "lucide-react";

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  image: string;
  classification: "Event" | "Announcement" | "Achievement";
}

// Safe date parser - handles both ISO and other formats
function parseEventDate(dateString: string): Date | null {
  if (!dateString) return null;
  
  try {
    // Try ISO format first (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    
    // Fallback to Date constructor for other formats
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  } catch {
    return null;
  }
}

// Parse time string (handles "H:MM AM/PM" and "HH:MM" formats)
function parseEventTime(timeString: string): { hours: number; minutes: number } | null {
  if (!timeString || !timeString.trim()) return null;
  
  try {
    const timeStr = timeString.trim();
    
    // Match "H:MM AM/PM" or "HH:MM AM/PM" format
    const amPmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (amPmMatch) {
      let hours = parseInt(amPmMatch[1], 10);
      const minutes = parseInt(amPmMatch[2], 10);
      const meridiem = amPmMatch[3].toUpperCase();
      
      if (isNaN(hours) || isNaN(minutes)) return null;
      
      // Convert to 24-hour format
      if (meridiem === 'PM' && hours !== 12) {
        hours += 12;
      } else if (meridiem === 'AM' && hours === 12) {
        hours = 0;
      }
      
      return { hours, minutes };
    }
    
    // Match 24-hour format "HH:MM"
    const match24h = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (match24h) {
      const hours = parseInt(match24h[1], 10);
      const minutes = parseInt(match24h[2], 10);
      
      if (isNaN(hours) || isNaN(minutes)) return null;
      
      return { hours, minutes };
    }
    
    return null;
  } catch {
    return null;
  }
}

export default function Screensaver() {
  const [, setLocation] = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [particles, setParticles] = useState<Array<{
    x: number, 
    y: number, 
    opacity: number,
    targetY: number,
    targetOpacity: number,
    duration: number
  }>>([]);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper functions to format date and time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Initialize particles safely on mount with all animation properties precomputed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setParticles(
        Array.from({ length: 50 }, () => ({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          opacity: Math.random() * 0.5 + 0.2,
          targetY: Math.random() * window.innerHeight,
          targetOpacity: Math.random() * 0.5 + 0.2,
          duration: Math.random() * 10 + 10,
        }))
      );
    }
  }, []);

  // Fetch events and achievements
  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  // Filter ongoing, upcoming events and achievements
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const ongoingAndUpcomingEvents = events.filter((event) => {
    // Skip achievements (they're handled separately)
    if (event.classification === "Achievement") return false;
    if (!event.date) return false;
    
    const eventDate = parseEventDate(event.date);
    if (!eventDate) return false;
    
    // If event is in the future, include it
    if (eventDate > today) return true;
    
    // If event is today, check the time
    if (eventDate.getTime() === today.getTime()) {
      // If no time specified, include it (ongoing all day)
      if (!event.time || !event.time.trim()) return true;
      
      const parsedTime = parseEventTime(event.time);
      
      // If time parsing failed, include the event (safer to show)
      if (!parsedTime) return true;
      
      // Create datetime for comparison
      const eventDateTime = new Date();
      eventDateTime.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
      
      // Include if time hasn't passed yet
      return eventDateTime >= now;
    }
    
    // Event is in the past
    return false;
  });

  const achievements = events.filter((event) => event.classification === "Achievement");

  // Combine events and achievements for carousel (2 events + 1 achievement per slide)
  const carouselSlides: Event[][] = [];
  let eventIndex = 0;
  let achievementIndex = 0;

  while (eventIndex < ongoingAndUpcomingEvents.length || achievementIndex < achievements.length) {
    const slide: Event[] = [];
    
    // Add up to 2 events
    if (eventIndex < ongoingAndUpcomingEvents.length) {
      slide.push(ongoingAndUpcomingEvents[eventIndex]);
      eventIndex++;
    }
    if (eventIndex < ongoingAndUpcomingEvents.length) {
      slide.push(ongoingAndUpcomingEvents[eventIndex]);
      eventIndex++;
    }
    
    // Add 1 achievement
    if (achievementIndex < achievements.length) {
      slide.push(achievements[achievementIndex]);
      achievementIndex++;
    }
    
    if (slide.length > 0) {
      carouselSlides.push(slide);
    }
  }

  // Auto-rotate carousel every 10 seconds
  useEffect(() => {
    if (carouselSlides.length === 0) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 10000);

    return () => clearInterval(interval);
  }, [carouselSlides.length]);

  // Exit screensaver on any touch/click
  const handleExit = () => {
    setLocation("/");
  };

  return (
    <div
      className="h-screen w-full overflow-hidden relative cursor-pointer"
      onClick={handleExit}
      onTouchStart={handleExit}
      style={{
        background: "linear-gradient(135deg, hsl(142, 60%, 25%) 0%, hsl(142, 50%, 35%) 50%, hsl(142, 55%, 30%) 100%)",
      }}
    >
      {/* Animated particle background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            initial={{
              x: particle.x,
              y: particle.y,
              opacity: particle.opacity,
            }}
            animate={{
              y: [null, particle.targetY],
              opacity: [null, particle.targetOpacity],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-8 py-12">
        {/* Date and Time */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-white" />
            <div className="text-lg text-white/90">{formatDate(currentTime)}</div>
          </div>
          <div className="text-5xl font-bold text-white" data-testid="text-screensaver-time">
            {formatTime(currentTime)}
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          className="text-4xl md:text-5xl lg:text-6xl font-bold text-white text-center mb-16"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          UNIVERSITY EVENTS & ACHIEVEMENTS
        </motion.h1>

        {/* Carousel */}
        <div className="w-full max-w-7xl flex-1 flex items-center justify-center mb-16">
          <AnimatePresence mode="wait">
            {carouselSlides.length > 0 && (
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.5 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full"
              >
                {carouselSlides[currentSlide].map((item) => (
                  <div
                    key={item.id}
                    className="bg-white/10 backdrop-blur-md rounded-lg overflow-hidden border border-white/20 shadow-2xl"
                  >
                    {/* Image */}
                    {item.image && (
                      <div className="h-48 overflow-hidden bg-black/20">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}

                    {/* Content */}
                    <div className="p-6">
                      {/* Classification badge */}
                      <div className="mb-3">
                        <span
                          className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
                            item.classification === "Achievement"
                              ? "bg-yellow-500/90 text-yellow-950"
                              : "bg-primary/90 text-primary-foreground"
                          }`}
                        >
                          {item.classification}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">
                        {item.title}
                      </h3>

                      {/* Date/Time (only for events, not achievements) */}
                      {item.classification !== "Achievement" && item.date && (() => {
                        const eventDate = parseEventDate(item.date);
                        return eventDate ? (
                          <p className="text-sm text-white/80 mb-2">
                            {format(eventDate, "MMMM d, yyyy")}
                            {item.time && ` • ${item.time}`}
                          </p>
                        ) : null;
                      })()}

                      {/* Description */}
                      <p className="text-sm text-white/70 line-clamp-3 mb-3">
                        {item.description}
                      </p>

                      {/* Location */}
                      {item.location && (
                        <p className="text-xs text-white/60">📍 {item.location}</p>
                      )}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state */}
          {carouselSlides.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center text-white max-w-2xl"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/20 p-12 shadow-2xl">
                <h2 className="text-4xl font-bold mb-4">Welcome to CVSU CCAT</h2>
                <p className="text-xl mb-2 text-white/90">No upcoming events or achievements at this time</p>
                <p className="text-lg text-white/70">Stay tuned for exciting updates from our university community!</p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Touch to begin message */}
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Hand className="w-16 h-16 text-white" />
          </motion.div>
          <p className="text-2xl md:text-3xl font-semibold text-white text-center">
            Touch the screen to begin
          </p>
        </motion.div>

        {/* Slide indicators */}
        {carouselSlides.length > 1 && (
          <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 flex gap-2">
            {carouselSlides.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentSlide ? "bg-white w-8" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
