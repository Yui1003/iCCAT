import { useState, useEffect } from "react";
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

export default function MobileNavigation() {
  const [, params] = useRoute("/navigate/:routeId");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [showNavPanel, setShowNavPanel] = useState(true);
  const [mapImageUrl, setMapImageUrl] = useState<string | null>(null);

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

  // Generate static map image URL from route
  useEffect(() => {
    if (!route || route.phases.length === 0) return;

    try {
      // Collect all polyline coordinates from all phases
      const allCoordinates: Array<{ lat: number; lng: number }> = [];
      route.phases.forEach((phase: RoutePhase) => {
        if (phase.polyline && Array.isArray(phase.polyline)) {
          allCoordinates.push(...phase.polyline);
        }
      });

      if (allCoordinates.length === 0) {
        console.warn("No polyline coordinates found in route phases");
        return;
      }

      console.log("Found", allCoordinates.length, "coordinates in route");

      // Calculate bounds
      const lats = allCoordinates.map(c => c.lat);
      const lngs = allCoordinates.map(c => c.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      // Center coordinates
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;

      console.log("Map bounds:", { minLat, maxLat, minLng, maxLng, centerLat, centerLng });

      // Build marker points (start and end)
      const markers = [
        { lat: allCoordinates[0].lat, lng: allCoordinates[0].lng, label: "A" }, // Start
        { lat: allCoordinates[allCoordinates.length - 1].lat, lng: allCoordinates[allCoordinates.length - 1].lng, label: "B" }, // End
      ];

      // Build static map URL using OpenStreetMap service
      const mapWidth = 512;
      const mapHeight = 384;
      const zoom = 17;

      // Create markers parameter
      const markerStrings = markers.map(
        (m, idx) => `${m.lat},${m.lng},${idx === 0 ? "lightgreen" : "lightred"}`
      ).join("|");

      // Simplified OpenStreetMap static map URL (uses open API)
      const url = `https://staticmap.openstreetmap.de/staticmap.php?center=${centerLat},${centerLng}&zoom=${zoom}&size=${mapWidth}x${mapHeight}&markers=${markerStrings}`;

      console.log("Generated map URL:", url);
      setMapImageUrl(url);
    } catch (error) {
      console.error("Error generating static map:", error);
      setMapImageUrl(null);
    }
  }, [route]);

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
          <Link href="/">
            <Button className="w-full">
              Return to Kiosk
            </Button>
          </Link>
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
      <main className="flex-1 flex overflow-hidden w-full">
        {/* Map Area - Static Image */}
        <div className="flex-1 bg-muted z-0 flex items-center justify-center overflow-hidden">
          {mapImageUrl ? (
            <img
              src={mapImageUrl}
              alt="Route Map"
              className="w-full h-full object-cover"
              data-testid="map-image"
              onError={() => {
                console.error("Failed to load map image");
                setMapImageUrl(null);
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground p-4">
              <MapPin className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">Loading route map...</p>
            </div>
          )}
        </div>

        {/* Navigation Panel - Slides in/out */}
        <div
          className={`flex flex-col border-l border-card-border bg-card transition-all duration-300 flex-shrink-0 z-10 ${
            showNavPanel ? 'w-80' : 'w-0 overflow-hidden'
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
