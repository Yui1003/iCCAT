import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
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
  Clock,
  CalendarDays,
  User,
  HelpCircle,
  Play,
  Home,
  ArrowLeft,
  ClipboardList
} from "lucide-react";

function HomeScreenPreview() {
  return (
    <Card className="bg-gradient-to-br from-primary/20 via-background to-accent/10 p-4" data-testid="preview-home-screen">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
          <Map className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <div className="text-sm font-bold text-foreground">iCCAT</div>
          <div className="text-[10px] text-muted-foreground">Interactive Campus Companion</div>
        </div>
      </div>
      <div className="text-center mb-4">
        <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
          <Clock className="w-3 h-3" /> Saturday, November 29, 2025
        </div>
        <div className="text-xl font-bold text-foreground">05:30:00 PM</div>
        <div className="text-[10px] text-muted-foreground">Welcome to CVSU CCAT Campus</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3 flex flex-col items-center border border-card-border">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Map className="w-5 h-5 text-primary" />
          </div>
          <div className="text-xs font-semibold text-foreground">Campus Navigation</div>
          <div className="text-[9px] text-muted-foreground text-center">Find your way around campus</div>
        </Card>
        <Card className="p-3 flex flex-col items-center border border-card-border">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div className="text-xs font-semibold text-foreground">Events</div>
          <div className="text-[9px] text-muted-foreground text-center">Stay updated with activities</div>
        </Card>
        <Card className="p-3 flex flex-col items-center border border-card-border">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="text-xs font-semibold text-foreground">Staff Finder</div>
          <div className="text-[9px] text-muted-foreground text-center">Locate faculty and staff</div>
        </Card>
        <Card className="p-3 flex flex-col items-center border border-card-border">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Info className="w-5 h-5 text-primary" />
          </div>
          <div className="text-xs font-semibold text-foreground">About</div>
          <div className="text-[9px] text-muted-foreground text-center">Learn about this system</div>
        </Card>
      </div>
      <div className="mt-3 flex justify-center">
        <Button size="sm" className="text-[10px] h-7">
          <ClipboardList className="w-3 h-3 mr-1" /> Provide Feedback
        </Button>
      </div>
    </Card>
  );
}

function NavigationScreenPreview() {
  return (
    <Card className="overflow-hidden" data-testid="preview-navigation-screen">
      <div className="flex items-center gap-2 p-3 border-b border-card-border">
        <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        <div>
          <div className="text-sm font-bold text-foreground">Campus Navigation</div>
          <div className="text-[10px] text-muted-foreground">Find your way around CVSU CCAT</div>
        </div>
        <div className="ml-auto flex gap-1">
          <Button variant="outline" size="sm" className="text-[9px] h-6 px-2">
            <Building className="w-3 h-3 mr-1" /> Room Finder
          </Button>
          <Button size="sm" className="text-[9px] h-6 px-2">
            <Users className="w-3 h-3 mr-1" /> Staff Finder
          </Button>
        </div>
      </div>
      <div className="flex">
        <div className="w-2/5 p-3 border-r border-card-border bg-card space-y-3">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Search className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-foreground">Search Buildings</span>
            </div>
            <Card className="p-1.5 text-[9px] text-muted-foreground">Search by name...</Card>
          </div>
          <div>
            <div className="text-[10px] font-medium text-foreground mb-1">Starting Point</div>
            <Card className="p-1.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-primary" />
              <span className="text-[9px]">Your Location (Kiosk)</span>
            </Card>
          </div>
          <div>
            <div className="text-[10px] font-medium text-foreground mb-1">Destination</div>
            <Card className="p-1.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground">Select destination</span>
            </Card>
          </div>
          <div>
            <div className="text-[10px] font-medium text-foreground mb-1">Travel Mode</div>
            <div className="flex gap-1">
              <Button size="sm" className="flex-1 text-[8px] h-5">Walking</Button>
              <Button variant="outline" size="sm" className="flex-1 text-[8px] h-5">Driving</Button>
              <Button variant="outline" size="sm" className="flex-1 text-[8px] h-5">Accessible</Button>
            </div>
          </div>
          <Button className="w-full text-[10px] h-7">
            <Navigation className="w-3 h-3 mr-1" /> Generate Route
          </Button>
        </div>
        <div className="flex-1 bg-[#e8f4e8] p-2 relative min-h-[140px]">
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <div className="w-5 h-5 bg-card border border-card-border rounded flex items-center justify-center text-[10px]">+</div>
            <div className="w-5 h-5 bg-card border border-card-border rounded flex items-center justify-center text-[10px]">-</div>
          </div>
          <div className="absolute top-8 left-10 w-12 h-8 bg-pink-400/50 rounded-sm border border-pink-500/30"></div>
          <div className="absolute top-12 left-24 w-14 h-10 bg-blue-400/50 rounded-sm border border-blue-500/30"></div>
          <div className="absolute top-20 left-14 w-16 h-8 bg-yellow-400/50 rounded-sm border border-yellow-500/30"></div>
          <div className="absolute bottom-8 right-8 w-10 h-6 bg-green-400/50 rounded-sm border border-green-500/30"></div>
          <div className="absolute bottom-4 left-8 w-8 h-5 bg-orange-400/50 rounded-sm border border-orange-500/30"></div>
          <div className="absolute top-3 right-3 text-[8px] text-muted-foreground bg-white/80 px-1 rounded">Interactive Map</div>
        </div>
      </div>
    </Card>
  );
}

function EventsScreenPreview() {
  return (
    <Card className="overflow-hidden" data-testid="preview-events-screen">
      <div className="flex items-center gap-2 p-3 border-b border-card-border">
        <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        <div>
          <div className="text-sm font-bold text-foreground">Events & Announcements</div>
          <div className="text-[10px] text-muted-foreground">Stay updated with campus activities</div>
        </div>
      </div>
      <div className="p-3">
        <div className="flex gap-2 mb-3">
          <Button size="sm" className="flex-1 text-[10px] h-7">Calendar</Button>
          <Button variant="outline" size="sm" className="flex-1 text-[10px] h-7">Event List</Button>
        </div>
        <Card className="p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            <div className="text-xs font-medium text-foreground">November 2025</div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="text-[8px] text-muted-foreground font-medium py-1">{d}</div>
            ))}
            {[...Array(30)].map((_, i) => (
              <div 
                key={i} 
                className={`text-[8px] p-1 rounded ${i === 28 ? 'bg-primary text-primary-foreground font-bold' : i === 14 || i === 20 ? 'bg-primary/20 text-primary font-medium' : 'text-foreground'}`}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-2 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <div className="text-[10px] font-medium text-foreground">Thesis Defense Presentation</div>
              <div className="text-[8px] text-muted-foreground flex items-center gap-2">
                <span className="flex items-center gap-0.5"><Clock className="w-2 h-2" /> 10:00 AM</span>
                <span className="flex items-center gap-0.5"><MapPin className="w-2 h-2" /> Room 201</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Card>
  );
}

function StaffScreenPreview() {
  return (
    <Card className="overflow-hidden" data-testid="preview-staff-screen">
      <div className="flex items-center gap-2 p-3 border-b border-card-border">
        <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        <div>
          <div className="text-sm font-bold text-foreground">Staff Directory</div>
          <div className="text-[10px] text-muted-foreground">Find staff by department</div>
        </div>
      </div>
      <div className="p-3">
        <Card className="flex items-center gap-2 p-2 mb-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <div className="text-[10px] text-muted-foreground">Search departments or staff names...</div>
        </Card>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Card className="p-3 flex flex-col items-center border border-card-border">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mb-2">
              <span className="text-sm font-bold text-primary">5</span>
            </div>
            <div className="text-[10px] font-medium text-foreground text-center">Engineering</div>
            <div className="text-[8px] text-muted-foreground">5 staff members</div>
            <ChevronRight className="w-3 h-3 text-muted-foreground mt-1" />
          </Card>
          <Card className="p-3 flex flex-col items-center border border-card-border">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mb-2">
              <span className="text-sm font-bold text-primary">1</span>
            </div>
            <div className="text-[10px] font-medium text-foreground text-center">Student Affairs</div>
            <div className="text-[8px] text-muted-foreground">1 staff member</div>
            <ChevronRight className="w-3 h-3 text-muted-foreground mt-1" />
          </Card>
        </div>
        <Card className="p-2 bg-accent/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-medium text-foreground">Dr. Juan Dela Cruz</div>
              <div className="text-[8px] text-muted-foreground">Engineering Department</div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MapPin className="w-3 h-3 text-primary" />
            </Button>
          </div>
        </Card>
      </div>
    </Card>
  );
}

function CompletionPreview() {
  return (
    <Card className="bg-gradient-to-br from-primary/20 via-background to-accent/10 p-6 text-center" data-testid="preview-completion-screen">
      <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
        <Play className="w-12 h-12 text-primary" />
      </div>
      <div className="text-xl font-bold text-foreground mb-2">Ready to Explore!</div>
      <div className="text-sm text-muted-foreground mb-6">
        You now know how to use all features of iCCAT
      </div>
      <div className="grid grid-cols-2 gap-3 text-left">
        <Card className="p-3 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-primary flex-shrink-0" />
          <span className="text-[10px] text-foreground">Tap "How to Use" to replay this guide</span>
        </Card>
        <Card className="p-3 flex items-center gap-2">
          <ArrowLeft className="w-5 h-5 text-primary flex-shrink-0" />
          <span className="text-[10px] text-foreground">Back arrow returns to home</span>
        </Card>
        <Card className="p-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary flex-shrink-0" />
          <span className="text-[10px] text-foreground">Auto-reset after inactivity</span>
        </Card>
        <Card className="p-3 flex items-center gap-2">
          <Info className="w-5 h-5 text-primary flex-shrink-0" />
          <span className="text-[10px] text-foreground">Visit "About" for more info</span>
        </Card>
      </div>
    </Card>
  );
}

interface WalkthroughStep {
  id: number;
  title: string;
  description: string;
  preview: JSX.Element;
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
    preview: <HomeScreenPreview />,
    features: [
      {
        icon: <Map className="w-5 h-5 text-primary" />,
        title: "Campus Navigation",
        description: "Find buildings and get directions"
      },
      {
        icon: <Calendar className="w-5 h-5 text-primary" />,
        title: "Events & Announcements",
        description: "Stay updated with campus activities"
      },
      {
        icon: <Users className="w-5 h-5 text-primary" />,
        title: "Staff Finder",
        description: "Locate faculty and staff members"
      },
      {
        icon: <Info className="w-5 h-5 text-primary" />,
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
    preview: <NavigationScreenPreview />,
    features: [
      {
        icon: <Search className="w-5 h-5 text-primary" />,
        title: "Search Buildings",
        description: "Type to find any building by name"
      },
      {
        icon: <MapPin className="w-5 h-5 text-primary" />,
        title: "Set Locations",
        description: "Choose start and destination points"
      },
      {
        icon: <Route className="w-5 h-5 text-primary" />,
        title: "Travel Modes",
        description: "Walking, Driving, or Accessible routes"
      },
      {
        icon: <Building className="w-5 h-5 text-primary" />,
        title: "Room Finder",
        description: "Find rooms inside buildings"
      }
    ],
    tip: "Tap on any building on the map to see details and get directions"
  },
  {
    id: 3,
    title: "Events & Announcements",
    description: "Stay informed about campus activities, seminars, meetings, and important announcements. View events in a calendar or list format.",
    preview: <EventsScreenPreview />,
    features: [
      {
        icon: <CalendarDays className="w-5 h-5 text-primary" />,
        title: "Calendar View",
        description: "Browse events by month and day"
      },
      {
        icon: <Clock className="w-5 h-5 text-primary" />,
        title: "Event List",
        description: "View upcoming events chronologically"
      },
      {
        icon: <MapPin className="w-5 h-5 text-primary" />,
        title: "Event Locations",
        description: "See where events are held"
      },
      {
        icon: <Navigation className="w-5 h-5 text-primary" />,
        title: "Get Directions",
        description: "Navigate to event venues"
      }
    ],
    tip: "Tap on any event to see full details including time and location"
  },
  {
    id: 4,
    title: "Staff Directory",
    description: "Find faculty and staff members organized by department. View contact information and office locations.",
    preview: <StaffScreenPreview />,
    features: [
      {
        icon: <Search className="w-5 h-5 text-primary" />,
        title: "Search Staff",
        description: "Search by name or department"
      },
      {
        icon: <Building className="w-5 h-5 text-primary" />,
        title: "Browse Departments",
        description: "View staff by department"
      },
      {
        icon: <User className="w-5 h-5 text-primary" />,
        title: "Staff Profiles",
        description: "View contact info and position"
      },
      {
        icon: <MapPin className="w-5 h-5 text-primary" />,
        title: "Office Locations",
        description: "Get directions to offices"
      }
    ],
    tip: "Tap on a department card to see all staff members"
  },
  {
    id: 5,
    title: "You're Ready to Explore!",
    description: "You now know how to use all the features of iCCAT. Start exploring the campus and discovering everything CVSU CCAT has to offer!",
    preview: <CompletionPreview />,
    features: [],
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
        className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0"
        data-testid="dialog-walkthrough"
      >
        <DialogTitle className="sr-only">iCCAT Walkthrough Guide</DialogTitle>
        <DialogDescription className="sr-only">
          A step-by-step guide to help you learn how to use all features of the iCCAT kiosk system.
        </DialogDescription>
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
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="text-walkthrough-title">
              {step.title}
            </h2>
            <p className="text-muted-foreground text-sm" data-testid="text-walkthrough-description">
              {step.description}
            </p>
          </div>

          <div className="mb-6" data-testid="walkthrough-preview-container">
            {step.preview}
          </div>

          {step.features.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {step.features.map((feature, index) => (
                <Card 
                  key={index}
                  className="flex flex-col items-center text-center p-3 bg-accent/30 border-accent/50"
                  data-testid={`card-walkthrough-feature-${index}`}
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                    {feature.icon}
                  </div>
                  <h3 className="font-medium text-foreground text-xs">{feature.title}</h3>
                  <p className="text-[10px] text-muted-foreground">{feature.description}</p>
                </Card>
              ))}
            </div>
          )}

          {step.tip && (
            <Card className="bg-primary/5 border-primary/20 p-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-primary flex-shrink-0" />
                <div>
                  <span className="text-sm font-medium text-primary">Tip: </span>
                  <span className="text-sm text-muted-foreground">{step.tip}</span>
                </div>
              </div>
            </Card>
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
