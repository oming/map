"use client";

import { createContext, useContext } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";

interface MapContextValue {
  map: MaplibreMap | null;
  /** style.load 발화 여부 — 최초 로드와 이후 모든 setStyle에서 재발화한다.
   *  레이어/소스를 추가하는 effect는 반드시 이 값을 게이트로 써야 한다(styledata 아님). */
  styleReady: boolean;
}

const MapContext = createContext<MapContextValue>({
  map: null,
  styleReady: false,
});

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

/** map이 존재하고 style.load까지 발화했는지. 레이어/소스 추가 effect의 게이트로 쓴다. */
export function useStyleReady(): boolean {
  return useContext(MapContext).styleReady;
}

export { MapContext };
