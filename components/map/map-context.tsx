"use client";

import { createContext, useContext } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";

interface MapContextValue {
  map: MaplibreMap | null;
}

const MapContext = createContext<MapContextValue>({ map: null });

interface UseMapOptions {
  optional?: boolean;
}

export function useMap(options?: UseMapOptions): MaplibreMap | null {
  const context = useContext(MapContext);
  if (options?.optional) {
    return context.map;
  }
  if (!context.map) {
    throw new Error(
      "useMap() must be used within a MapProvider. " +
        "Ensure the component is rendered inside <VWorldMap>.",
    );
  }
  return context.map;
}

export { MapContext };
