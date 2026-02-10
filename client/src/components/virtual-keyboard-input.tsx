import { useState, useRef, useEffect } from "react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";
import { Search, X } from "lucide-react";
import { Button } from "./ui/button";

interface VirtualKeyboardInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
}

export function VirtualKeyboardInput({ 
  value, 
  onChange, 
  onClear,
  placeholder,
  className = "",
  ...props 
}: VirtualKeyboardInputProps) {
  const [showKeyboard, setShowKeyboard] = useState(false);
  const keyboardRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFocus = () => {
    setShowKeyboard(true);
  };

  const onKeyPress = (button: string) => {
    if (button === "{shift}" || button === "{lock}") handleShift();
    if (button === "{enter}") setShowKeyboard(false);
  };

  const [layout, setLayout] = useState("default");

  const handleShift = () => {
    setLayout(layout === "default" ? "shift" : "default");
  };

  const onKeyboardChange = (input: string) => {
    const event = {
      target: { value: input },
    } as React.ChangeEvent<HTMLInputElement>;
    onChange(event);
  };

  // Close keyboard when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node) && 
          !document.querySelector(".simple-keyboard")?.contains(event.target as Node)) {
        setShowKeyboard(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={`w-full bg-background border border-input rounded-md px-10 py-2 h-12 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
          {...props}
        />
        {onClear && value && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
              if (keyboardRef.current) keyboardRef.current.setInput("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showKeyboard && (
        <div className="fixed bottom-0 left-0 right-0 z-[1000] bg-background border-t p-4 shadow-2xl animate-in slide-in-from-bottom duration-300">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-muted-foreground">On-screen Keyboard</span>
              <Button variant="ghost" size="sm" onClick={() => setShowKeyboard(false)}>Close</Button>
            </div>
            <Keyboard
              keyboardRef={(r) => (keyboardRef.current = r)}
              layoutName={layout}
              onChange={onKeyboardChange}
              onKeyPress={onKeyPress}
              inputName="default"
              input={value}
              theme="hg-theme-default hg-layout-default custom-keyboard"
              layout={{
                default: [
                  "q w e r t y u i o p {bksp}",
                  "a s d f g h j k l",
                  "z x c v b n m , .",
                  "{shift} {space} {enter}"
                ],
                shift: [
                  "Q W E R T Y U I O P {bksp}",
                  "A S D F G H J K L",
                  "Z X C V B N M ! ?",
                  "{shift} {space} {enter}"
                ]
              }}
              display={{
                "{bksp}": "⌫",
                "{enter}": "Enter",
                "{shift}": "⇧",
                "{space}": "Space"
              }}
            />
          </div>
        </div>
      )}
      
      <style>{`
        .custom-keyboard.hg-theme-default {
          background-color: transparent;
          padding: 0;
        }
        .custom-keyboard.hg-theme-default .hg-button {
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          font-weight: 500;
          background: hsl(var(--card));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .custom-keyboard.hg-theme-default .hg-button:active {
          background: hsl(var(--accent));
        }
        .custom-keyboard.hg-theme-default .hg-button.hg-standardBtn {
          width: calc(10% - 4px);
        }
        .custom-keyboard.hg-theme-default .hg-button.hg-functionBtn {
          background: hsl(var(--muted));
        }
      `}</style>
    </div>
  );
}
