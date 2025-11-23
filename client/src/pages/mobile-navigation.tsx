import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, MapPin, Navigation as NavigationIcon } from "lucide-react";
import { Link } from "wouter";
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
      {/* Header */}
      <header className="bg-card border-b border-card-border p-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-mobile">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-foreground">Navigation</h1>
            <p className="text-xs text-muted-foreground">
              Phase {currentPhaseIndex + 1} of {route.phases.length}
            </p>
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="bg-card border-b border-card-border p-4 flex-shrink-0">
        <div className="flex items-center gap-2">
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

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: phaseColor }}
            />
            <span className="text-sm font-medium text-foreground">
              {currentPhase.startName}
            </span>
          </div>
          <NavigationIcon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {currentPhase.endName}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4 max-w-2xl mx-auto">
          {/* Current Phase Card */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Current Phase
              </h2>
              <Badge
                variant="secondary"
                style={{
                  backgroundColor: `${phaseColor}20`,
                  color: phaseColor,
                  borderColor: phaseColor,
                }}
                data-testid="badge-current-phase"
              >
                Phase {currentPhaseIndex + 1}
              </Badge>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Distance:</span>
                <span className="font-medium text-foreground">{currentPhase.distance}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground capitalize">{currentPhase.mode}</span>
              </div>

              <div className="pt-3 border-t border-border">
                <h3 className="text-sm font-medium text-foreground mb-3">Directions</h3>
                <div className="space-y-3">
                  {currentPhase.steps.map((step: RouteStep, stepIndex: number) => (
                    <div
                      key={stepIndex}
                      className="flex gap-3"
                      data-testid={`mobile-step-${stepIndex}`}
                    >
                      <div className="flex-shrink-0 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center text-xs font-medium text-muted-foreground">
                        {stepIndex + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{step.instruction}</p>
                        <p className="text-xs text-muted-foreground">{step.distance}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* All Phases Overview */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-foreground mb-3">All Phases</h3>
            <div className="space-y-2">
              {route.phases.map((phase: RoutePhase, index: number) => {
                const isCompleted = completedPhases.includes(index);
                const isCurrent = index === currentPhaseIndex;
                const color = PHASE_COLORS[index % PHASE_COLORS.length];

                return (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-2 rounded-md ${
                      isCurrent ? 'bg-accent' : ''
                    }`}
                    data-testid={`phase-overview-${index}`}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: isCompleted ? color : `${color}20`,
                      }}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4 text-white" />
                      ) : (
                        <span
                          className="text-sm font-bold"
                          style={{ color: color }}
                        >
                          {index + 1}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {phase.startName} → {phase.endName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {phase.distance} • {phase.mode}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </main>

      {/* Bottom Action Button */}
      {!allPhasesCompleted && (
        <div className="border-t border-card-border bg-card p-4 flex-shrink-0">
          <Button
            className="w-full"
            size="lg"
            onClick={handleAdvancePhase}
            data-testid="button-advance-phase"
            style={{
              backgroundColor: phaseColor,
              color: 'white',
            }}
          >
            {currentPhaseIndex < route.phases.length - 1
              ? `I've Reached ${currentPhase.endName}`
              : 'Complete Navigation'}
          </Button>
        </div>
      )}

      {allPhasesCompleted && (
        <div className="border-t border-card-border bg-card p-4 flex-shrink-0">
          <div className="text-center mb-4">
            <Check className="w-12 h-12 mx-auto mb-2 text-green-500" />
            <p className="text-lg font-semibold text-foreground">Journey Complete!</p>
            <p className="text-sm text-muted-foreground">You've reached your destination</p>
          </div>
        </div>
      )}

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
