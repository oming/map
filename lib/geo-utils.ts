// lib/geo-utils.ts
import type { LngLatBounds } from "maplibre-gl";

export function boundsToBBox(bounds: LngLatBounds): string {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
}

export function indexToLabel(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}
