import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('kiosk-theme') === 'dark');

  useEffect(() => {
    const handleChange = (e: Event) => {
      setIsDark((e as CustomEvent).detail === 'dark');
    };
    window.addEventListener('kiosk-theme-changed', handleChange as EventListener);
    return () => window.removeEventListener('kiosk-theme-changed', handleChange as EventListener);
  }, []);

  const toggle = () => {
    const newTheme = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('kiosk-theme', newTheme);
    window.dispatchEvent(new CustomEvent('kiosk-theme-changed', { detail: newTheme }));
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      data-testid="button-theme-toggle"
      className={isDark ? "text-yellow-400 hover:text-yellow-300" : "text-muted-foreground hover:text-foreground"}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </Button>
  );
}
