// lib/geo-utils.ts
import type { LngLatBounds } from "maplibre-gl";

export function boundsToBBox(bounds: LngLatBounds): string {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
}
