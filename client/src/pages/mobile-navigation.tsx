import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, MapPin, Navigation as NavigationIcon, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { SavedRoute, Building, RoutePhase, RouteStep } from "@shared/schema";
import { PHASE_COLORS } from "@shared/phase-colors";

declare global {
  interface Window {
    L: any;
  }
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
        const map = L.map(mapRef.current, {
          center: [14.4035451, 120.8659794],
          zoom: 17,
          zoomControl: true,
          touchZoom: true,
          dragging: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
        console.log("Map initialized successfully");

        // Invalidate map size after a short delay to ensure proper rendering
        setTimeout(() => {
          map.invalidateSize();
          console.log("Map size invalidated");
        }, 100);
      } catch (error) {
        console.error("Error initializing map:", error);
      }
    };

    // Start initialization with a small delay to ensure DOM is ready
    const timer = setTimeout(initMap, 100);
    return () => clearTimeout(timer);
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

      // Clear existing polylines and markers (keep tile layer)
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Polyline || layer instanceof L.Marker || layer instanceof L.CircleMarker) {
          map.removeLayer(layer);
        }
      });

      console.log("Drawing route with", route.phases.length, "phases");
      console.log("Full route data:", JSON.stringify(route, null, 2).substring(0, 500));

      // Collect all coordinates to calculate bounds
      let allCoordinates: Array<{ lat: number; lng: number }> = [];
      let phasesWithPolylines = 0;

      // Draw each phase
      route.phases.forEach((phase: RoutePhase, index: number) => {
        const color = PHASE_COLORS[index % PHASE_COLORS.length];
        const isCompleted = completedPhases.includes(index);
        const isCurrent = index === currentPhaseIndex;

        console.log(`Phase ${index} check:`, { hasPolyline: !!phase.polyline, isArray: Array.isArray(phase.polyline), length: phase.polyline?.length || 0 });

        if (phase.polyline && Array.isArray(phase.polyline) && phase.polyline.length > 0) {
          phasesWithPolylines++;
          allCoordinates.push(...phase.polyline);

          // Draw polyline for this phase
          const polyline = L.polyline(
            phase.polyline.map((coord: any) => [coord.lat, coord.lng]),
            {
              color: color,
              weight: isCurrent ? 5 : 3,
              opacity: isCompleted ? 0.5 : 1,
              dashArray: isCompleted ? '5, 5' : 'none',
              lineCap: 'round',
              lineJoin: 'round',
            }
          ).addTo(map);

          console.log(`Phase ${index}: ${phase.polyline.length} coordinates, color: ${color}, current: ${isCurrent}`);
        } else {
          console.warn(`Phase ${index} has no polyline data!`);
        }
      });

      console.log(`Total phases with polylines: ${phasesWithPolylines}/${route.phases.length}`);

      // Add markers for start and end
      if (allCoordinates.length > 0) {
        L.circleMarker([allCoordinates[0].lat, allCoordinates[0].lng], {
          radius: 10,
          fillColor: '#22c55e',
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        }).addTo(map).bindPopup('Start');

        L.circleMarker(
          [allCoordinates[allCoordinates.length - 1].lat, allCoordinates[allCoordinates.length - 1].lng],
          {
            radius: 10,
            fillColor: '#ef4444',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
          }
        ).addTo(map).bindPopup('End');

        // Fit map to all coordinates with padding
        const bounds = L.latLngBounds(allCoordinates.map(c => [c.lat, c.lng]));
        map.fitBounds(bounds, { padding: [50, 50], animate: true });
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
  const phaseColor = PHASE_COLORS[currentPhaseIndex % PHASE_COLORS.length];

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
      <main className="flex-1 flex w-full h-full">
        {/* Map Area - Leaflet Interactive Map */}
        <div
          ref={mapRef}
          id="map"
          className="flex-1 z-0 relative"
          data-testid="map-container"
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
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
                const phaseColor = PHASE_COLORS[index % PHASE_COLORS.length];

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
                  const color = PHASE_COLORS[index % PHASE_COLORS.length];

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
                        <p className="text-muted-foreground text-xs">
                          {phase.distance}
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
