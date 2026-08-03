"use client";

import * as React from "react";
import type { Map as MaplibreMap } from "maplibre-gl";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SearchIcon } from "lucide-react";

interface SearchProps {
  map?: MaplibreMap;
}

export function Search({ map }: SearchProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelectLocation = (lngLat: [number, number]) => {
    if (!map) return;
    map.flyTo({
      center: lngLat,
      zoom: 15,
      duration: 2000,
    });
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <Button
        onClick={() => {
          console.log("Search button clicked");
          setOpen(true);
        }}
        variant="outline"
        className="w-fit"
      >
        <SearchIcon />
        Search
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              <CommandItem
                onSelect={() => handleSelectLocation([126.978, 37.5665])}
              >
                Seoul City Hall
              </CommandItem>
              <CommandItem>Search Emoji</CommandItem>
              <CommandItem>Calculator</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </div>
  );
}
