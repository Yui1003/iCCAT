import { useState, useEffect } from "react";
import { MapPin, Search } from "lucide-react";
import { VirtualKeyboardInput } from "./virtual-keyboard-input";
import { Button } from "./ui/button";
import type { Building } from "@shared/schema";

interface SearchableDestinationSelectProps {
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  buildings: Building[];
  excludeBuildingId?: string;
  testId?: string;
}

export default function SearchableDestinationSelect({
  selectedId,
  onSelect,
  buildings,
  excludeBuildingId,
  testId = "select-destination"
}: SearchableDestinationSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Handle Escape key to close dropdown
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const locations = buildings
    .filter(b => b.id !== excludeBuildingId)
    .map(b => ({ id: b.id, name: b.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredLocations = locations.filter(loc =>
    loc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedLocation = locations.find(l => l.id === selectedId);

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
        <MapPin className="w-4 h-4 mr-2 text-primary flex-shrink-0" />
        <span className="flex-1">
          {selectedLocation ? selectedLocation.name : "Select destination"}
        </span>
        <div className="ml-2 h-4 w-4 opacity-50 flex-shrink-0">
          <Search className="w-4 h-4" />
        </div>
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-input rounded-md shadow-lg z-[1002]">
          <div className="p-2 border-b border-input">
            <VirtualKeyboardInput
              placeholder="Search destinations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              autoFocus
              data-testid={`${testId}-search`}
              className="w-full"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredLocations.length > 0 ? (
              filteredLocations.map(loc => (
                <button
                  key={loc.id}
                  onClick={() => handleSelect(loc.id)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-muted border-b last:border-b-0 transition-colors ${
                    selectedId === loc.id ? "bg-primary/15 font-medium" : ""
                  }`}
                  data-testid={`${testId}-option-${loc.id}`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm">{loc.name}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No destinations found
              </div>
            )}
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-[1001]"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
