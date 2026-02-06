import { Link } from "wouter";
import { Map, Calendar, Users, Info, Clock, ClipboardList, HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useHomeInactivity } from "@/hooks/use-inactivity";
import logoImage from "@assets/logo.png";
import { Button } from "@/components/ui/button";
import { Walkthrough, useWalkthrough } from "@/components/walkthrough";

export default function Landing() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { isOpen, openWalkthrough, closeWalkthrough } = useWalkthrough();
  
  // Activate screensaver after 30 seconds of inactivity
  useHomeInactivity();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-accent/10 flex flex-col">
      <header className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img 
                src={logoImage} 
                alt="iCCAT Logo" 
                className="w-16 h-16 rounded-lg"
                data-testid="img-logo"
              />
              <div>
                <h1 className="text-3xl font-bold text-foreground">iCCAT</h1>
                <p className="text-sm text-muted-foreground">Interactive Campus Companion & Assistance Terminal</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={openWalkthrough}
              className="flex items-center gap-2"
              data-testid="button-help-guide"
            >
              <HelpCircle className="w-5 h-5" />
              <span className="hidden sm:inline">How to Use</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="max-w-5xl w-full">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-primary" />
              <div className="text-lg text-muted-foreground">{formatDate(currentTime)}</div>
            </div>
            <div className="text-5xl font-bold text-foreground mb-2" data-testid="text-time">
              {formatTime(currentTime)}
            </div>
            <p className="text-xl text-muted-foreground">
              Welcome to Cavite State University CCAT Campus
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Link href="/navigation">
              <button
                data-testid="button-navigation"
                className="group w-full min-h-48 bg-card border border-card-border rounded-lg p-8 hover-elevate active-elevate-2 transition-all"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Map className="w-12 h-12 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-foreground mb-2">Campus Navigation</h2>
                    <p className="text-base text-muted-foreground">Find your way around campus with turn-by-turn directions</p>
                  </div>
                </div>
              </button>
            </Link>

            <Link href="/events">
              <button
                data-testid="button-events"
                className="group w-full min-h-48 bg-card border border-card-border rounded-lg p-8 hover-elevate active-elevate-2 transition-all"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Calendar className="w-12 h-12 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-foreground mb-2">Events & Announcements</h2>
                    <p className="text-base text-muted-foreground">Stay updated with campus activities and important notices</p>
                  </div>
                </div>
              </button>
            </Link>

            <Link href="/staff">
              <button
                data-testid="button-staff"
                className="group w-full min-h-48 bg-card border border-card-border rounded-lg p-8 hover-elevate active-elevate-2 transition-all"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Users className="w-12 h-12 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-foreground mb-2">Staff Finder</h2>
                    <p className="text-base text-muted-foreground">Locate faculty and staff members across campus</p>
                  </div>
                </div>
              </button>
            </Link>

            <Link href="/about">
              <button
                data-testid="button-about"
                className="group w-full min-h-48 bg-card border border-card-border rounded-lg p-8 hover-elevate active-elevate-2 transition-all"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Info className="w-12 h-12 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-foreground mb-2">About the Kiosk</h2>
                    <p className="text-base text-muted-foreground">Learn more about this information system</p>
                  </div>
                </div>
              </button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <Link href="/feedback">
                <button
                  data-testid="button-feedback"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover-elevate active-elevate-2 transition-all"
                >
                  <ClipboardList className="w-5 h-5" />
                  <span className="font-medium">Provide Feedback</span>
                </button>
              </Link>
            </div>
            <div className="text-xs text-muted-foreground" data-testid="text-version">
              version:2.2.6.2
            </div>
          </div>
        </div>
      </footer>

      <Walkthrough isOpen={isOpen} onClose={closeWalkthrough} />
    </div>
  );
}
