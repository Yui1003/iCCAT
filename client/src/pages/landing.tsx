import { Link } from "wouter";
import { Map, Calendar, Users, Info, ClipboardList, HelpCircle } from "lucide-react";
import { useEffect, useState, useMemo, useRef } from "react";
import { useHomeInactivity } from "@/hooks/use-inactivity";
import logoImage from "@assets/logo.png";

import { Button } from "@/components/ui/button";
import { Walkthrough, useWalkthrough } from "@/components/walkthrough";

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

function getPhaseForTime(timeInMinutes: number) {
  let currentIdx = TIME_PHASES.findIndex(p => timeInMinutes >= p.start && timeInMinutes < p.end);
  if (currentIdx === -1) currentIdx = TIME_PHASES.length - 1;
  const currentPhase = TIME_PHASES[currentIdx];

  let nextIdx = (currentIdx + 1) % TIME_PHASES.length;
  let nextPhase = TIME_PHASES[nextIdx];
  while (nextPhase.img === currentPhase.img && TIME_PHASES.some(p => p.img !== currentPhase.img)) {
    nextIdx = (nextIdx + 1) % TIME_PHASES.length;
    nextPhase = TIME_PHASES[nextIdx];
  }

  const blendStartMinutes = currentPhase.end - 15;
  let opacity = 0;
  if (timeInMinutes >= blendStartMinutes && nextPhase.img !== currentPhase.img) {
    const isMidnightSplit = currentPhase.end === 24 * 60;
    if (!isMidnightSplit) {
      opacity = Math.min(1, Math.max(0, (timeInMinutes - blendStartMinutes) / 15));
    }
  }

  return { currentImg: currentPhase.img, nextImg: nextPhase.img, nextOpacity: opacity };
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

function useBackgroundCrossfade() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [layerASrc, setLayerASrc] = useState('');
  const [layerBSrc, setLayerBSrc] = useState('');
  const [showA, setShowA] = useState(true);
  const [blendSrc, setBlendSrc] = useState('');
  const [blendOpacity, setBlendOpacity] = useState(0);
  const prevPhaseImgRef = useRef('');
  const preloadedRef = useRef<Set<string>>(new Set());
  const transitioningRef = useRef(false);

  useEffect(() => {
    const now = new Date();
    const t = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const phase = getPhaseForTime(t);
    setLayerASrc(phase.currentImg);
    setLayerBSrc(phase.currentImg);
    setBlendSrc(phase.nextImg);
    prevPhaseImgRef.current = phase.currentImg;
    preloadedRef.current.add(phase.currentImg);
    if (phase.nextImg !== phase.currentImg) {
      preloadImage(phase.nextImg).then(() => preloadedRef.current.add(phase.nextImg));
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const t = currentTime.getHours() * 60 + currentTime.getMinutes() + currentTime.getSeconds() / 60;
    const phase = getPhaseForTime(t);

    if (phase.nextImg !== phase.currentImg && !preloadedRef.current.has(phase.nextImg)) {
      preloadImage(phase.nextImg).then(() => preloadedRef.current.add(phase.nextImg));
    }

    if (phase.currentImg !== prevPhaseImgRef.current && !transitioningRef.current) {
      transitioningRef.current = true;
      const doSwap = () => {
        if (showA) {
          setLayerBSrc(phase.currentImg);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setShowA(false);
            });
          });
        } else {
          setLayerASrc(phase.currentImg);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setShowA(true);
            });
          });
        }
        setBlendOpacity(0);
        prevPhaseImgRef.current = phase.currentImg;
        setTimeout(() => { transitioningRef.current = false; }, 2500);
      };

      if (preloadedRef.current.has(phase.currentImg)) {
        doSwap();
      } else {
        preloadImage(phase.currentImg).then(() => {
          preloadedRef.current.add(phase.currentImg);
          doSwap();
        });
      }
    }

    if (phase.currentImg === prevPhaseImgRef.current) {
      setBlendOpacity(phase.nextOpacity);
      setBlendSrc(phase.nextImg);
    }
  }, [currentTime, showA]);

  return { layerASrc, layerBSrc, showA, blendSrc, blendOpacity, currentTime };
}

export default function Landing() {
  const { layerASrc, layerBSrc, showA, blendSrc, blendOpacity, currentTime } = useBackgroundCrossfade();
  const { isOpen, openWalkthrough, closeWalkthrough } = useWalkthrough();

  const isDaytime = useMemo(() => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    // Daytime is 5:00 AM to 5:47 PM (17 * 60 + 47 = 1067 minutes)
    return timeInMinutes >= 5 * 60 && timeInMinutes < (17 * 60 + 47);
  }, [currentTime]);

  const textColorClass = isDaytime ? "text-black" : "text-white";
  const textShadowClass = isDaytime 
    ? "" 
    : "[text-shadow:_-1px_-1px_0_#000,_1px_-1px_0_#000,_-1px_1px_0_#000,_1px_1px_0_#000]";
  
  const secondaryTextShadowClass = isDaytime
    ? ""
    : "[text-shadow:_-0.5px_-0.5px_0_#000,_0.5px_-0.5px_0_#000,_-0.5px_0.5px_0_#000,_0.5px_0.5px_0_#000]";

  useHomeInactivity();

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
    <div className="h-screen bg-black flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-0">
        <img
          src={layerASrc}
          alt=""
          className="absolute inset-0 w-full h-full object-fill"
          style={{ opacity: showA ? 1 : 0, transition: 'opacity 2s ease-in-out' }}
        />
        <img
          src={layerBSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-fill"
          style={{ opacity: showA ? 0 : 1, transition: 'opacity 2s ease-in-out' }}
        />
        <img
          src={blendSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-fill"
          style={{ opacity: blendOpacity, transition: 'opacity 1s linear' }}
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
                <h1 className={`text-3xl font-bold ${textColorClass} ${textShadowClass}`}>iCCAT</h1>
                <p className={`text-sm ${textColorClass} font-bold ${secondaryTextShadowClass}`}>Interactive Campus Companion & Assistance Terminal</p>
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
                className={`relative flex items-center gap-2 bg-white/10 backdrop-blur-md border-white/20 ${isDaytime ? 'text-black shadow-black/10' : 'text-white shadow-white/10'} font-bold pointer-events-auto shadow-xl hover:bg-white/20 cursor-pointer z-[100]`}
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
              <div className={`text-lg ${textColorClass} font-bold ${secondaryTextShadowClass}`}>{formatDate(currentTime)}</div>
            </div>
            <div className={`text-5xl font-bold ${textColorClass} mb-2 ${textShadowClass}`} data-testid="text-time">
              {formatTime(currentTime)}
            </div>
            <p className={`text-xl ${textColorClass} font-semibold ${textShadowClass}`}>
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
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center group-hover:bg-primary/30 transition-colors border border-black/20">
                    <Map className={`w-10 h-10 text-primary ${isDaytime ? 'drop-shadow-[0_0_1px_rgba(255,255,255,1)]' : 'drop-shadow-[0_0_1px_rgba(0,0,0,1)]'}`} />
                  </div>
                  <div>
                    <h2 className={`text-xl font-semibold ${textColorClass} mb-1 ${textShadowClass}`}>Campus Navigation</h2>
                    <p className={`${textColorClass} font-medium ${textShadowClass}`}>Find your way around campus with turn-by-turn directions</p>
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
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center group-hover:bg-primary/30 transition-colors border border-black/20">
                    <Calendar className={`w-10 h-10 text-primary ${isDaytime ? 'drop-shadow-[0_0_1px_rgba(255,255,255,1)]' : 'drop-shadow-[0_0_1px_rgba(0,0,0,1)]'}`} />
                  </div>
                  <div>
                    <h2 className={`text-xl font-semibold ${textColorClass} mb-1 ${textShadowClass}`}>Events & Announcements</h2>
                    <p className={`${textColorClass} font-medium ${textShadowClass}`}>Stay updated with campus activities and important notices</p>
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
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center group-hover:bg-primary/30 transition-colors border border-black/20">
                    <Users className={`w-10 h-10 text-primary ${isDaytime ? 'drop-shadow-[0_0_1px_rgba(255,255,255,1)]' : 'drop-shadow-[0_0_1px_rgba(0,0,0,1)]'}`} />
                  </div>
                  <div>
                    <h2 className={`text-xl font-semibold ${textColorClass} mb-1 ${textShadowClass}`}>Staff Finder</h2>
                    <p className={`${textColorClass} font-medium ${textShadowClass}`}>Locate faculty and staff members across campus</p>
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
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center group-hover:bg-primary/30 transition-colors border border-black/20">
                    <Info className={`w-10 h-10 text-primary ${isDaytime ? 'drop-shadow-[0_0_1px_rgba(255,255,255,1)]' : 'drop-shadow-[0_0_1px_rgba(0,0,0,1)]'}`} />
                  </div>
                  <div>
                    <h2 className={`text-xl font-semibold ${textColorClass} mb-1 ${textShadowClass}`}>About the Kiosk</h2>
                    <p className={`${textColorClass} font-medium ${textShadowClass}`}>Learn more about this information system</p>
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
            <div className={`text-xs ${isDaytime ? 'text-black/70' : 'text-white/70'}`} data-testid="text-version">
              version:2.9.6
            </div>
          </div>
        </div>
      </footer>

      <Walkthrough isOpen={isOpen} onClose={closeWalkthrough} />
    </div>
  );
}