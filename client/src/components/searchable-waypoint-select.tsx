import React, { useState, useEffect } from "react";
import { MapPin, Search, X } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import type { Building } from "@shared/schema";

interface SearchableWaypointSelectProps {
  selectedId: string;
  onSelect: (id: string) => void;
  buildings: Building[];
  excludeIds: string[]; // IDs to exclude (start, end, other waypoints)
  onRemove: () => void;
  testId?: string;
  index?: number;
}

export default function SearchableWaypointSelect({
  selectedId,
  onSelect,
  buildings,
  excludeIds,
  onRemove,
  testId = "select-waypoint",
  index
}: SearchableWaypointSelectProps) {
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

  const availableBuildings = buildings
    .filter(b => !excludeIds.includes(b.id) || b.id === selectedId)
    .map(b => ({ id: b.id, name: b.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredBuildings = availableBuildings.filter(building =>
    building.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedBuilding = availableBuildings.find(b => b.id === selectedId);

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
        data-testid={`${testId}-${index}`}
        className="w-full justify-start text-left font-normal hover:bg-accent text-sm"
      >
        <MapPin className="w-4 h-4 mr-2 text-primary flex-shrink-0" />
        <span className="flex-1 truncate">
          {selectedBuilding ? selectedBuilding.name : "Select a building"}
        </span>
        <div className="ml-2 h-4 w-4 opacity-50 flex-shrink-0">
          <Search className="w-4 h-4" />
        </div>
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-input rounded-md shadow-lg z-[1002]">
          <div className="p-2 border-b border-input">
            <Input
              type="text"
              placeholder="Search buildings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              data-testid={`${testId}-search-${index}`}
              className="w-full text-sm"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredBuildings.length > 0 ? (
              filteredBuildings.map(building => (
                <button
                  key={building.id}
                  onClick={() => handleSelect(building.id)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-muted border-b last:border-b-0 transition-colors text-sm ${
                    selectedId === building.id ? "bg-primary/15 font-medium" : ""
                  }`}
                  data-testid={`${testId}-option-${building.id}`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>{building.name}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No buildings available
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
