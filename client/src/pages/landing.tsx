import { Link } from "wouter";
import { Map, Calendar, Users, Info, ClipboardList, HelpCircle } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useHomeInactivity } from "@/hooks/use-inactivity";
import logoImage from "@assets/logo.png";

import { Button } from "@/components/ui/button";
import { Walkthrough, useWalkthrough } from "@/components/walkthrough";

// Time phases configuration
const TIME_PHASES = [
  { start: 5 * 60, end: 6 * 60, img: "/assets/Homepage Engine/5AM - 6AM.png" },
  { start: 6 * 60, end: 7 * 60, img: "/assets/Homepage Engine/6AM - 7AM.png" },
  { start: 7 * 60, end: 12 * 60, img: "/assets/Homepage Engine/7AM - 12NN.png" },
  { start: 12 * 60, end: 13 * 60, img: "/assets/Homepage Engine/12NN-1PM.png" },
  { start: 13 * 60, end: 17 * 60 + 30, img: "/assets/Homepage Engine/1PM - 530PM.png" },
  { start: 17 * 60 + 30, end: 18 * 60, img: "/assets/Homepage Engine/530PM - 6PM.png" },
  { start: 18 * 60, end: 21 * 60, img: "/assets/Homepage Engine/6PM-9PM.png" },
  { start: 21 * 60, end: 24 * 60, img: "/assets/Homepage Engine/9PM - 5AM.png" },
  { start: 0, end: 5 * 60, img: "/assets/Homepage Engine/9PM - 5AM.png" },
].sort((a, b) => a.start - b.start);

export default function Landing() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { isOpen, openWalkthrough, closeWalkthrough } = useWalkthrough();
  
  // Calculate blending states
  const blendData = useMemo(() => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const seconds = currentTime.getSeconds();
    const timeInMinutes = hours * 60 + minutes + seconds / 60;

    // Find current phase
    let currentIdx = TIME_PHASES.findIndex(p => timeInMinutes >= p.start && timeInMinutes < p.end);
    if (currentIdx === -1) currentIdx = TIME_PHASES.length - 1;

    const currentPhase = TIME_PHASES[currentIdx];
    const nextIdx = (currentIdx + 1) % TIME_PHASES.length;
    const nextPhase = TIME_PHASES[nextIdx];

    // Calculate how far we are into the current phase for blending
    // We start blending into the next phase in the last 15 minutes of the current phase
    const blendStartMinutes = currentPhase.end - 15;
    let opacity = 0;

    if (timeInMinutes >= blendStartMinutes) {
      opacity = (timeInMinutes - blendStartMinutes) / 15;
    }

    return {
      currentImg: currentPhase.img,
      nextImg: nextPhase.img,
      nextOpacity: opacity
    };
  }, [currentTime]);

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
    <div className="h-screen bg-background flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-0">
        {/* Base Layer: Current Phase */}
        <img
          src={blendData.currentImg}
          alt=""
          className="absolute inset-0 w-full h-full object-fill"
        />
        {/* Blend Layer: Next Phase */}
        <img
          src={blendData.nextImg}
          alt=""
          className="absolute inset-0 w-full h-full object-fill transition-opacity duration-1000 ease-linear"
          style={{ opacity: blendData.nextOpacity }}
        />
      </div>
      
      {/* Walkthrough component needs to be high z-index */}
      <Walkthrough isOpen={isOpen} onClose={closeWalkthrough} />

      <header className="px-6 pt-4 pb-2 relative z-50">
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
                <h1 className="text-3xl font-bold text-black [text-shadow:_-1px_-1px_0_#fff,_1px_-1px_0_#fff,_-1px_1px_0_#fff,_1px_1px_0_#fff]">iCCAT</h1>
                <p className="text-sm text-black font-bold [text-shadow:_-0.5px_-0.5px_0_#fff,_0.5px_-0.5px_0_#fff,_-0.5px_0.5px_0_#fff,_0.5px_0.5px_0_#fff]">Interactive Campus Companion & Assistance Terminal</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openWalkthrough();
                }}
                className="relative flex items-center gap-2 bg-white/10 backdrop-blur-md border-white/20 text-white font-bold pointer-events-auto shadow-xl hover:bg-white/20 cursor-pointer z-[100]"
                data-testid="button-help-guide"
              >
                <HelpCircle className="w-5 h-5" />
                <span className="hidden sm:inline">How to Use</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-28 relative z-10 -mt-24">
        <div className="max-w-5xl w-full">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center mb-4">
              <div className="text-lg text-black font-bold [text-shadow:_-0.5px_-0.5px_0_#fff,_0.5px_-0.5px_0_#fff,_-0.5px_0.5px_0_#fff,_0.5px_0.5px_0_#fff]">{formatDate(currentTime)}</div>
            </div>
            <div className="text-5xl font-bold text-black mb-2 [text-shadow:_-1px_-1px_0_#fff,_1px_-1px_0_#fff,_-1px_1px_0_#fff,_1px_1px_0_#fff]" data-testid="text-time">
              {formatTime(currentTime)}
            </div>
            <p className="text-xl text-black font-semibold [text-shadow:_-1px_-1px_0_#fff,_1px_-1px_0_#fff,_-1px_1px_0_#fff,_1px_1px_0_#fff]">
              Welcome to Cavite State University CCAT Campus
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 max-w-4xl mx-auto">
            <Link href="/navigation">
              <button
                data-testid="button-navigation"
                className="group w-full bg-white/10 border border-white/20 rounded-lg p-6 hover-elevate active-elevate-2 transition-all backdrop-blur-md shadow-xl"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                    <Map className="w-10 h-10 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-1">Campus Navigation</h2>
                    <p className="text-white font-medium">Find your way around campus with turn-by-turn directions</p>
                  </div>
                </div>
              </button>
            </Link>

            <Link href="/events">
              <button
                data-testid="button-events"
                className="group w-full bg-white/10 border border-white/20 rounded-lg p-6 hover-elevate active-elevate-2 transition-all backdrop-blur-md shadow-xl"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                    <Calendar className="w-10 h-10 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-1">Events & Announcements</h2>
                    <p className="text-white font-medium">Stay updated with campus activities and important notices</p>
                  </div>
                </div>
              </button>
            </Link>

            <Link href="/staff">
              <button
                data-testid="button-staff"
                className="group w-full bg-white/10 border border-white/20 rounded-lg p-6 hover-elevate active-elevate-2 transition-all backdrop-blur-md shadow-xl"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                    <Users className="w-10 h-10 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-1">Staff Finder</h2>
                    <p className="text-white font-medium">Locate faculty and staff members across campus</p>
                  </div>
                </div>
              </button>
            </Link>

            <Link href="/about">
              <button
                data-testid="button-about"
                className="group w-full bg-white/10 border border-white/20 rounded-lg p-6 hover-elevate active-elevate-2 transition-all backdrop-blur-md shadow-xl"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                    <Info className="w-10 h-10 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-1">About the Kiosk</h2>
                    <p className="text-white font-medium">Learn more about this information system</p>
                  </div>
                </div>
              </button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="p-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <Link href="/feedback">
                <button
                  data-testid="button-feedback"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover-elevate active-elevate-2 transition-all shadow-lg"
                >
                  <ClipboardList className="w-5 h-5" />
                  <span className="font-medium">Provide Feedback</span>
                </button>
              </Link>
            </div>
            <div className="text-xs text-foreground/70" data-testid="text-version">
              version:2.7.9
            </div>
          </div>
        </div>
      </footer>

      <Walkthrough isOpen={isOpen} onClose={closeWalkthrough} />
    </div>
  );
}
