import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, MapPin, Navigation as NavigationIcon, Menu, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { SavedRoute, Building, RoutePhase, RouteStep } from "@shared/schema";
import { getPhaseColor } from "@shared/phase-colors";

declare global {
  interface Window {
    L: any;
  }
}

// Calculate ETA based on distance and travel mode
function calculateETA(distance: string, mode: 'walking' | 'driving'): string {
  const parseDistance = (distStr: string): number => {
    const match = distStr.match(/(\d+(?:\.\d+)?)\s*km/);
    if (match) return parseFloat(match[1]) * 1000;
    const meterMatch = distStr.match(/(\d+(?:\.\d+)?)\s*m/);
    return meterMatch ? parseFloat(meterMatch[1]) : 0;
  };

  const distanceMeters = parseDistance(distance);
  const speed = mode === 'walking' ? 1.4 : 10; // m/s
  const seconds = distanceMeters / speed;
  const minutes = Math.ceil(seconds / 60);
  return minutes > 0 ? `${minutes} min` : '< 1 min';
}

export default function MobileNavigation() {
  const [, params] = useRoute("/navigate/:routeId");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [showNavPanel, setShowNavPanel] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const polylineLayersRef = useRef<any[]>([]);
  const markerLayersRef = useRef<any[]>([]);

  const { data: route, isLoading, error } = useQuery<SavedRoute>({
    queryKey: ['/api/routes', params?.routeId],
    enabled: !!params?.routeId,
  });

  // Check if all phases are completed
  const allPhasesCompleted = route && completedPhases.length === route.phases.length;

  const handleAdvancePhase = () => {
    if (!route) return;

    const nextPhaseIndex = currentPhaseIndex + 1;
    
    // Mark current phase as completed
    if (!completedPhases.includes(currentPhaseIndex)) {
      setCompletedPhases([...completedPhases, currentPhaseIndex]);
    }

    if (nextPhaseIndex < route.phases.length) {
      setCurrentPhaseIndex(nextPhaseIndex);
      toast({
        title: "Next Phase",
        description: `Navigating to ${route.phases[nextPhaseIndex].endName}`,
      });
    } else {
      // All phases completed - show feedback dialog
      setShowFeedbackDialog(true);
      toast({
        title: "Destination Reached!",
        description: "You have completed your journey.",
      });
    }
  };

  const handleFeedbackDecision = (giveFeedback: boolean) => {
    setShowFeedbackDialog(false);
    if (giveFeedback) {
      navigate('/feedback?source=mobile');
    } else {
      navigate('/thank-you');
    }
  };

  // Initialize Leaflet map on mount (not dependent on route)
  useEffect(() => {
    const initMap = () => {
      // Check if ref is ready
      if (!mapRef.current) {
        console.warn("Map ref not ready, retrying in 100ms...");
        setTimeout(initMap, 100);
        return;
      }

      const L = window.L;
      if (!L) {
        console.warn("Leaflet not loaded, retrying in 200ms...");
        setTimeout(initMap, 200);
        return;
      }

      if (mapInstanceRef.current) {
        console.log("Map already initialized");
        return;
      }

      try {
        // Ensure map container has computed dimensions
        const rect = mapRef.current.getBoundingClientRect();
        console.log("Map container dimensions:", { width: rect.width, height: rect.height });

        if (rect.width === 0 || rect.height === 0) {
          console.warn("Map container has zero dimensions, retrying in 100ms...");
          setTimeout(initMap, 100);
          return;
        }

        console.log("Initializing Leaflet map with container:", mapRef.current);
        
        // Mobile-specific options to prevent zoom destruction
        const map = L.map(mapRef.current, {
          center: [14.4035451, 120.8659794],
          zoom: 17,
          zoomControl: false, // Disable default zoom on mobile
          touchZoom: true,
          dragging: true,
          tap: true,
          scrollWheelZoom: 'center',
          doubleClickZoom: false, // Prevent double-click zoom issues on mobile
          boxZoom: false, // Disable box zoom on mobile
          inertia: true,
          inertiaDeceleration: 3000,
          renderer: L.SVG(), // Use SVG renderer for better mobile performance
          worldCopyJump: false,
          preferCanvas: false,
          attributionControl: false
        });

        // Add zoom controls with custom positioning
        L.control.zoom({
          position: 'topright'
        }).addTo(map);

        // Add tile layer with mobile-friendly options
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
          minZoom: 16,
          crossOrigin: true,
          detectRetina: true,
          className: 'map-tiles'
        }).addTo(map);

        mapInstanceRef.current = map;
        console.log("Map initialized successfully");

        // Fix map size and prevent white/black background issues
        map.invalidateSize(true);
        
        // Add throttled resize handler for mobile orientation changes
        const handleResize = () => {
          if (mapInstanceRef.current) {
            setTimeout(() => {
              mapInstanceRef.current.invalidateSize(true);
            }, 100);
          }
        };
        
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);

        // Store handlers for cleanup
        (mapInstanceRef as any).current._resizeHandler = handleResize;

      } catch (error) {
        console.error("Error initializing map:", error);
      }
    };

    // Start initialization with a small delay to ensure DOM is ready
    const timer = setTimeout(initMap, 100);
    return () => {
      clearTimeout(timer);
      if ((mapInstanceRef as any).current?._resizeHandler) {
        window.removeEventListener('resize', (mapInstanceRef as any).current._resizeHandler);
        window.removeEventListener('orientationchange', (mapInstanceRef as any).current._resizeHandler);
      }
    };
  }, []);

  // Draw route on map when it updates
  useEffect(() => {
    const drawRoute = () => {
      console.log("Route drawing effect triggered", { mapReady: !!mapInstanceRef.current, routeExists: !!route, leafletExists: !!window.L });
      
      if (!mapInstanceRef.current || !route || !window.L) {
        console.warn("Map not ready yet, retrying in 100ms...");
        setTimeout(drawRoute, 100);
        return;
      }

      const L = window.L;
      const map = mapInstanceRef.current;

      // Clear existing layers properly - remove only polylines and markers
      polylineLayersRef.current.forEach(layer => {
        try {
          map.removeLayer(layer);
        } catch (e) {
          console.warn("Error removing polyline layer:", e);
        }
      });
      polylineLayersRef.current = [];

      markerLayersRef.current.forEach(layer => {
        try {
          map.removeLayer(layer);
        } catch (e) {
          console.warn("Error removing marker layer:", e);
        }
      });
      markerLayersRef.current = [];

      console.log("Drawing route with", route.phases.length, "phases");

      // Collect all coordinates to calculate bounds
      let allCoordinates: Array<{ lat: number; lng: number }> = [];
      let phasesWithPolylines = 0;

      // Draw each phase
      route.phases.forEach((phase: RoutePhase, index: number) => {
        const color = phase.color || getPhaseColor(index);
        const isCompleted = completedPhases.includes(index);
        const isCurrent = index === currentPhaseIndex;

        console.log(`Phase ${index} check:`, { hasPolyline: !!phase.polyline, isArray: Array.isArray(phase.polyline), length: phase.polyline?.length || 0, color, isCompleted, isCurrent });

        if (phase.polyline && Array.isArray(phase.polyline) && phase.polyline.length > 0) {
          phasesWithPolylines++;
          allCoordinates.push(...phase.polyline);

          // Create polyline with explicit RGB conversion to ensure colors render properly
          const coordinates = phase.polyline.map((coord: any) => [coord.lat, coord.lng]);
          
          // Convert hex to ensure proper color rendering
          let renderedColor = color;
          if (color.startsWith('#')) {
            renderedColor = color; // Keep hex as is for SVG rendering
          }

          const polylineOptions = {
            color: renderedColor,
            weight: isCurrent ? 6 : 4,
            opacity: isCompleted ? 0.6 : 1,
            dashArray: isCompleted ? '5, 5' : null,
            lineCap: 'round' as const,
            lineJoin: 'round' as const,
            stroke: true,
            fill: false,
            renderer: L.SVG(), // Explicitly use SVG renderer for mobile
            interactive: false, // Prevent event handlers from affecting performance
            bubblingMouseEvents: false,
          };

          const polyline = L.polyline(coordinates, polylineOptions).addTo(map);
          polylineLayersRef.current.push(polyline);

          console.log(`Phase ${index}: ${phase.polyline.length} coordinates, color: ${renderedColor}, opacity: ${polylineOptions.opacity}`);
        } else {
          console.warn(`Phase ${index} has no polyline data!`);
        }
      });

      console.log(`Total phases with polylines: ${phasesWithPolylines}/${route.phases.length}`);

      // Add markers for start and end
      if (allCoordinates.length > 0) {
        const startMarker = L.circleMarker([allCoordinates[0].lat, allCoordinates[0].lng], {
          radius: 10,
          fillColor: '#22c55e',
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
          interactive: false,
          bubblingMouseEvents: false,
        }).addTo(map).bindPopup('Start');
        markerLayersRef.current.push(startMarker);

        const endMarker = L.circleMarker(
          [allCoordinates[allCoordinates.length - 1].lat, allCoordinates[allCoordinates.length - 1].lng],
          {
            radius: 10,
            fillColor: '#ef4444',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
            interactive: false,
            bubblingMouseEvents: false,
          }
        ).addTo(map).bindPopup('End');
        markerLayersRef.current.push(endMarker);

        // Fit map to all coordinates with padding
        const bounds = L.latLngBounds(allCoordinates.map(c => [c.lat, c.lng]));
        map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 0.5 });
        console.log("Map fitted to route bounds");
      } else {
        console.error("No coordinates found in any phase!");
      }
    };

    // Start drawing with a small delay to ensure map is ready
    const timer = setTimeout(drawRoute, 100);
    return () => clearTimeout(timer);
  }, [route, currentPhaseIndex, completedPhases]);

  // Handle loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading route...</p>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error || !route) {
    return (
      <div className="h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-6 max-w-md w-full text-center">
          <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Route Not Found</h2>
          <p className="text-muted-foreground mb-4">
            This route may have expired or doesn't exist.
          </p>
          <Button 
            className="w-full"
            onClick={() => navigate('/')}
          >
            Return to Kiosk
          </Button>
        </Card>
      </div>
    );
  }

  const currentPhase = route.phases[currentPhaseIndex];
  const phaseColor = currentPhase?.color || getPhaseColor(currentPhaseIndex);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header with Map Toggle */}
      <header className="bg-card border-b border-card-border p-4 flex-shrink-0 flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/thank-you')}
          data-testid="button-back-mobile"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">Navigation</h1>
          <p className="text-xs text-muted-foreground">
            Phase {currentPhaseIndex + 1} of {route.phases.length}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowNavPanel(!showNavPanel)}
          data-testid="button-toggle-panel"
        >
          {showNavPanel ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </header>

      {/* Main Layout: Map + Navigation Panel */}
      <main className="flex-1 flex w-full h-full overflow-hidden relative">
        {/* Map Area - Leaflet Interactive Map */}
        <div
          ref={mapRef}
          id="map"
          className="flex-1 z-0"
          data-testid="map-container"
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            willChange: 'transform',
          }}
        />

        {/* Navigation Panel - Slides in/out */}
        <div
          className={`flex flex-col border-l border-card-border bg-card transition-all duration-300 flex-shrink-0 z-10 overflow-hidden ${
            showNavPanel ? 'w-80' : 'w-0'
          }`}
        >
          {/* Progress Indicator */}
          <div className="p-4 border-b border-card-border flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              {route.phases.map((phase: RoutePhase, index: number) => {
                const isCompleted = completedPhases.includes(index);
                const isCurrent = index === currentPhaseIndex;
                const phaseColor = phase.color || getPhaseColor(index);

                return (
                  <div
                    key={index}
                    className="flex items-center gap-2 flex-1"
                  >
                    <div
                      className={`flex-1 h-2 rounded-full transition-all ${
                        isCompleted
                          ? 'opacity-100'
                          : isCurrent
                          ? 'opacity-75'
                          : 'opacity-25'
                      }`}
                      style={{
                        backgroundColor: phaseColor,
                      }}
                    />
                    {index < route.phases.length - 1 && (
                      <div className="w-1 h-1 rounded-full bg-border" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: phaseColor }}
                />
                <span className="text-xs font-medium text-foreground truncate">
                  {currentPhase.startName}
                </span>
              </div>
              <NavigationIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-medium text-foreground truncate">
                {currentPhase.endName}
              </span>
            </div>
          </div>

          {/* Navigation Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Current Phase Info */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Current Phase
                </h2>
                <Badge
                  variant="secondary"
                  style={{
                    backgroundColor: `${phaseColor}20`,
                    color: phaseColor,
                    borderColor: phaseColor,
                  }}
                  className="text-xs"
                  data-testid="badge-current-phase"
                >
                  Phase {currentPhaseIndex + 1}
                </Badge>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Distance:</span>
                  <span className="font-medium text-foreground">{currentPhase.distance}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">ETA:</span>
                  <span className="font-medium text-foreground" data-testid="text-current-eta">
                    {calculateETA(currentPhase.distance, currentPhase.mode)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Mode:</span>
                  <span className="font-medium text-foreground capitalize">{currentPhase.mode}</span>
                </div>
              </div>
            </div>

            {/* Directions */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Directions</h3>
              <div className="space-y-2">
                {currentPhase.steps.map((step: RouteStep, stepIndex: number) => (
                  <div
                    key={stepIndex}
                    className="flex gap-2 text-xs"
                    data-testid={`mobile-step-${stepIndex}`}
                  >
                    <div className="flex-shrink-0 w-5 h-5 bg-card border border-border rounded-full flex items-center justify-center text-xs font-medium text-muted-foreground">
                      {stepIndex + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{step.instruction}</p>
                      <p className="text-muted-foreground text-xs">{step.distance}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* All Phases */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">All Phases</h3>
              <div className="space-y-1">
                {route.phases.map((phase: RoutePhase, index: number) => {
                  const isCompleted = completedPhases.includes(index);
                  const isCurrent = index === currentPhaseIndex;
                  const color = phase.color || getPhaseColor(index);
                  const eta = calculateETA(phase.distance, phase.mode);

                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-2 p-1.5 rounded-sm text-xs ${
                        isCurrent ? 'bg-accent' : ''
                      }`}
                      data-testid={`phase-overview-${index}`}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs"
                        style={{
                          backgroundColor: isCompleted ? color : `${color}20`,
                        }}
                      >
                        {isCompleted ? (
                          <Check className="w-3 h-3 text-white" />
                        ) : (
                          <span style={{ color: color }} className="font-bold">
                            {index + 1}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {phase.startName}
                        </p>
                        <p className="text-muted-foreground text-xs flex gap-2">
                          <span>{phase.distance}</span>
                          <span>•</span>
                          <span data-testid={`text-phase-eta-${index}`}>{eta}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-card-border p-4 flex-shrink-0 space-y-3">
            {!allPhasesCompleted && (
              <Button
                className="w-full text-sm"
                size="sm"
                onClick={handleAdvancePhase}
                data-testid="button-advance-phase"
                style={{
                  backgroundColor: phaseColor,
                  color: 'white',
                }}
              >
                {currentPhaseIndex < route.phases.length - 1
                  ? `Reached ${currentPhase.endName}`
                  : 'Complete'}
              </Button>
            )}

            {allPhasesCompleted && (
              <div className="text-center py-2">
                <Check className="w-8 h-8 mx-auto mb-1 text-green-500" />
                <p className="text-sm font-semibold text-foreground">Journey Complete!</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-mobile-feedback">
          <DialogHeader>
            <DialogTitle>Give Feedback</DialogTitle>
            <DialogDescription>
              Would you like to help us improve by giving feedback about your navigation experience?
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => handleFeedbackDecision(false)}
              className="flex-1"
              data-testid="button-skip-feedback-mobile"
            >
              No, Skip
            </Button>
            <Button
              onClick={() => handleFeedbackDecision(true)}
              className="flex-1"
              data-testid="button-go-to-feedback-mobile"
            >
              Yes, Give Feedback
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
