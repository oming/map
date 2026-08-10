// lib/geo-utils.ts
import type { Map as MaplibreMap, LngLatBounds } from "maplibre-gl";

export function boundsToBBox(bounds: LngLatBounds): string {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
}

// 지도 화면 중 왼쪽 leftPaddingPx 만큼(검색 패널에 가려진 영역)을 제외한
// "실제로 보이는" 영역만으로 bbox를 계산
export function visibleBBox(map: MaplibreMap, leftPaddingPx = 0): string {
  const canvas = map.getCanvas();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const sw = map.unproject([leftPaddingPx, height]);
  const ne = map.unproject([width, 0]);
  return `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
}
