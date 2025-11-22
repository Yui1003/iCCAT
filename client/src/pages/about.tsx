import { ArrowLeft, Map, Navigation as NavigationIcon, Users, Calendar, Smartphone, Wifi } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useGlobalInactivity } from "@/hooks/use-inactivity";

export default function About() {
  // Return to home after 3 minutes of inactivity
  useGlobalInactivity();
  const features = [
    {
      icon: Map,
      title: "Interactive Campus Map",
      description: "Explore the CVSU CCAT campus with our detailed interactive map showing all buildings and facilities"
    },
    {
      icon: NavigationIcon,
      title: "Turn-by-Turn Navigation",
      description: "Get walking or driving directions to any location on campus with step-by-step guidance"
    },
    {
      icon: Users,
      title: "Staff Directory",
      description: "Quickly find faculty and staff members with our comprehensive searchable directory"
    },
    {
      icon: Calendar,
      title: "Events & Announcements",
      description: "Stay informed about upcoming events, activities, and important campus announcements"
    },
    {
      icon: Smartphone,
      title: "Touch-Optimized Interface",
      description: "Large, easy-to-use buttons and controls designed specifically for kiosk interaction"
    },
    {
      icon: Wifi,
      title: "Offline Capability",
      description: "Access essential information even when internet connectivity is limited"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-card-border p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">About iCCAT</h1>
            <p className="text-sm text-muted-foreground">Learn about this kiosk system</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-lg mb-4">
            <Map className="w-12 h-12 text-primary-foreground" />
          </div>
          <h2 className="text-4xl font-bold text-foreground mb-4">
            iCCAT
          </h2>
          <p className="text-xl text-muted-foreground mb-2">
            Interactive Campus Companion & Assistance Terminal
          </p>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your smart wayfinding and information system for Cavite State University CCAT Campus
          </p>
        </div>

        <div className="mb-12">
          <Card className="p-8">
            <h3 className="text-2xl font-semibold text-foreground mb-4">Welcome to CVSU CCAT</h3>
            <p className="text-lg text-muted-foreground mb-4">
              The Interactive Campus Companion and Assistance Terminal (iCCAT) is designed to help students, 
              faculty, staff, and visitors navigate the Cavite State University CCAT Campus with ease.
            </p>
            <p className="text-lg text-muted-foreground">
              Whether you're looking for a specific building, trying to find a faculty member, checking out 
              upcoming events, or simply exploring the campus, iCCAT provides all the information you need in 
              one convenient, user-friendly interface.
            </p>
          </Card>
        </div>

        <div className="mb-12">
          <h3 className="text-2xl font-semibold text-foreground mb-6">Key Features</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="p-6" data-testid={`feature-card-${index}`}>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h4>
                    <p className="text-base text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <Card className="p-8 bg-primary/5 border-primary/20">
            <h3 className="text-2xl font-semibold text-foreground mb-4">Need Help?</h3>
            <p className="text-lg text-muted-foreground mb-4">
              If you have any questions or need assistance using this kiosk, please don't hesitate to ask 
              any nearby campus personnel. They'll be happy to help you find what you're looking for.
            </p>
            <div className="flex gap-4">
              <Link href="/">
                <Button data-testid="button-home">
                  Return to Home
                </Button>
              </Link>
              <Link href="/navigation">
                <Button variant="outline" data-testid="button-start-navigation">
                  Start Navigation
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
