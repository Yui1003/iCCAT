import React, { useState, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";
import { VirtualKeyboardInput } from "./virtual-keyboard-input";
import { Button } from "./ui/button";

interface SearchableSelectProps {
  options: Array<{ id: string; name: string }>;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  placeholder?: string;
  testId?: string;
  icon?: React.ReactNode;
}

export default function SearchableSelect({
  options,
  selectedId,
  onSelect,
  placeholder = "Select an option",
  testId = "searchable-select",
  icon
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const filteredOptions = options.filter(opt =>
    opt.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedOption = options.find(o => o.id === selectedId);

  const handleSelect = (id: string) => {
    onSelect(id);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="relative w-full">
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        data-testid={testId}
        className="w-full justify-start text-left font-normal hover:bg-accent"
      >
        {icon && <span className="mr-2 flex-shrink-0">{icon}</span>}
        <span className="flex-1 truncate">
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 opacity-50 flex-shrink-0" />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-input rounded-md shadow-lg z-[1010]">
          <div className="p-2 border-b border-input sticky top-0 bg-background">
            <VirtualKeyboardInput
              placeholder={`Search ${placeholder.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              autoFocus
              data-testid={`${testId}-search`}
              className="w-full"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => handleSelect(opt.id)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-muted border-b last:border-b-0 transition-colors ${
                    selectedId === opt.id ? "bg-primary/15 font-medium" : ""
                  }`}
                  data-testid={`${testId}-option-${opt.id}`}
                >
                  <span className="text-sm">{opt.name}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
