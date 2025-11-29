import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Map, 
  Calendar, 
  Users, 
  Info, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  MapPin,
  Navigation,
  Search,
  Building,
  Route,
  Filter,
  Clock,
  CalendarDays,
  User,
  Phone,
  Mail,
  HelpCircle,
  Play,
  Home
} from "lucide-react";

interface WalkthroughStep {
  id: number;
  title: string;
  description: string;
  icon: JSX.Element;
  features: {
    icon: JSX.Element;
    title: string;
    description: string;
  }[];
  tip?: string;
}

const walkthroughSteps: WalkthroughStep[] = [
  {
    id: 1,
    title: "Welcome to iCCAT",
    description: "Your Interactive Campus Companion & Assistance Terminal. This guide will help you explore all the features available to navigate the Cavite State University CCAT Campus.",
    icon: <Home className="w-16 h-16 text-primary" />,
    features: [
      {
        icon: <Map className="w-6 h-6 text-primary" />,
        title: "Campus Navigation",
        description: "Find buildings and get directions"
      },
      {
        icon: <Calendar className="w-6 h-6 text-primary" />,
        title: "Events & Announcements",
        description: "Stay updated with campus activities"
      },
      {
        icon: <Users className="w-6 h-6 text-primary" />,
        title: "Staff Finder",
        description: "Locate faculty and staff members"
      },
      {
        icon: <Info className="w-6 h-6 text-primary" />,
        title: "About the Kiosk",
        description: "Learn about this system"
      }
    ],
    tip: "Tap any card on the home screen to access that feature"
  },
  {
    id: 2,
    title: "Campus Navigation",
    description: "Find your way around CVSU CCAT with our interactive map. View all campus buildings, search for locations, and get turn-by-turn directions.",
    icon: <Map className="w-16 h-16 text-primary" />,
    features: [
      {
        icon: <Search className="w-6 h-6 text-primary" />,
        title: "Search Buildings",
        description: "Type to find any building on campus by name or description"
      },
      {
        icon: <Filter className="w-6 h-6 text-primary" />,
        title: "Filter Map Markers",
        description: "Filter by building type: Academic, Administrative, Facilities, etc."
      },
      {
        icon: <MapPin className="w-6 h-6 text-primary" />,
        title: "Starting Point",
        description: "Set your current location or choose a starting point on campus"
      },
      {
        icon: <Navigation className="w-6 h-6 text-primary" />,
        title: "Select Destination",
        description: "Choose where you want to go and get directions"
      }
    ],
    tip: "Tap on any building on the map to see more details and get directions"
  },
  {
    id: 3,
    title: "Getting Directions",
    description: "The navigation system provides multiple travel modes and the ability to add stops along your route.",
    icon: <Route className="w-16 h-16 text-primary" />,
    features: [
      {
        icon: <Navigation className="w-6 h-6 text-primary" />,
        title: "Walking Mode",
        description: "Get pedestrian-friendly routes through campus walkways"
      },
      {
        icon: <Route className="w-6 h-6 text-primary" />,
        title: "Driving Mode",
        description: "Get directions using campus roads for vehicles"
      },
      {
        icon: <MapPin className="w-6 h-6 text-primary" />,
        title: "Add Stops",
        description: "Add multiple waypoints to visit several locations"
      },
      {
        icon: <Building className="w-6 h-6 text-primary" />,
        title: "Room Finder",
        description: "Find specific rooms inside buildings with floor plans"
      }
    ],
    tip: "Use the 'Generate Route' button after selecting your destination"
  },
  {
    id: 4,
    title: "Events & Announcements",
    description: "Stay informed about campus activities, seminars, meetings, and important announcements. View events in a calendar or list format.",
    icon: <Calendar className="w-16 h-16 text-primary" />,
    features: [
      {
        icon: <CalendarDays className="w-6 h-6 text-primary" />,
        title: "Calendar View",
        description: "Browse events by month and see what's happening each day"
      },
      {
        icon: <Clock className="w-6 h-6 text-primary" />,
        title: "Event List",
        description: "View upcoming events in a chronological list format"
      },
      {
        icon: <Filter className="w-6 h-6 text-primary" />,
        title: "Filter Events",
        description: "Filter by event type: Academic, Social, Administrative, etc."
      },
      {
        icon: <MapPin className="w-6 h-6 text-primary" />,
        title: "Event Location",
        description: "See where events are held and get directions"
      }
    ],
    tip: "Tap on any event to see full details including time, location, and description"
  },
  {
    id: 5,
    title: "Staff Directory",
    description: "Find faculty and staff members organized by department. View contact information and office locations.",
    icon: <Users className="w-16 h-16 text-primary" />,
    features: [
      {
        icon: <Search className="w-6 h-6 text-primary" />,
        title: "Search Staff",
        description: "Search by name or department to find staff members quickly"
      },
      {
        icon: <Building className="w-6 h-6 text-primary" />,
        title: "Browse Departments",
        description: "View staff organized by their departments"
      },
      {
        icon: <User className="w-6 h-6 text-primary" />,
        title: "Staff Profiles",
        description: "View detailed information about each staff member"
      },
      {
        icon: <MapPin className="w-6 h-6 text-primary" />,
        title: "Office Location",
        description: "See where staff members are located and get directions"
      }
    ],
    tip: "Tap on a department to see all staff members in that department"
  },
  {
    id: 6,
    title: "You're Ready to Explore!",
    description: "You now know how to use all the features of iCCAT. Start exploring the campus and discovering everything CVSU CCAT has to offer!",
    icon: <Play className="w-16 h-16 text-primary" />,
    features: [
      {
        icon: <HelpCircle className="w-6 h-6 text-primary" />,
        title: "Need Help?",
        description: "Tap the help button in the header to replay this guide anytime"
      },
      {
        icon: <Home className="w-6 h-6 text-primary" />,
        title: "Return Home",
        description: "The back arrow takes you to the home screen from any page"
      },
      {
        icon: <Clock className="w-6 h-6 text-primary" />,
        title: "Auto Reset",
        description: "The kiosk returns to home after a period of inactivity"
      },
      {
        icon: <Info className="w-6 h-6 text-primary" />,
        title: "About Section",
        description: "Visit 'About the Kiosk' for more information about this system"
      }
    ],
    tip: "Thank you for using iCCAT - your campus companion!"
  }
];

interface WalkthroughProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Walkthrough({ isOpen, onClose }: WalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  
  const step = walkthroughSteps[currentStep];
  const progress = ((currentStep + 1) / walkthroughSteps.length) * 100;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === walkthroughSteps.length - 1;

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0"
        data-testid="dialog-walkthrough"
      >
        <div className="sticky top-0 z-10 bg-card border-b border-card-border">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">iCCAT Guide</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {walkthroughSteps.length}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleSkip}
                data-testid="button-walkthrough-close"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <Progress value={progress} className="h-1 rounded-none" />
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
              {step.icon}
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="text-walkthrough-title">
              {step.title}
            </h2>
            <p className="text-muted-foreground" data-testid="text-walkthrough-description">
              {step.description}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {step.features.map((feature, index) => (
              <div 
                key={index}
                className="flex items-start gap-3 p-4 bg-accent/30 rounded-lg border border-accent/50"
                data-testid={`card-walkthrough-feature-${index}`}
              >
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-medium text-foreground text-sm">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {step.tip && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Info className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <span className="text-sm font-medium text-primary">Tip:</span>
                  <p className="text-sm text-muted-foreground">{step.tip}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-card border-t border-card-border p-4">
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={handleSkip}
              className="flex-shrink-0"
              data-testid="button-walkthrough-skip"
            >
              Skip Guide
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevious}
                disabled={isFirstStep}
                data-testid="button-walkthrough-previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleNext}
                className="min-w-[100px]"
                data-testid="button-walkthrough-next"
              >
                {isLastStep ? "Get Started" : "Next"}
                {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useWalkthrough() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasSeenWalkthrough, setHasSeenWalkthrough] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('iccat-walkthrough-seen') === 'true';
    }
    return false;
  });

  const openWalkthrough = () => setIsOpen(true);
  
  const closeWalkthrough = () => {
    setIsOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('iccat-walkthrough-seen', 'true');
      setHasSeenWalkthrough(true);
    }
  };

  useEffect(() => {
    if (!hasSeenWalkthrough && typeof window !== 'undefined') {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [hasSeenWalkthrough]);

  return {
    isOpen,
    hasSeenWalkthrough,
    openWalkthrough,
    closeWalkthrough
  };
}
