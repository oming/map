"use client";

import type { Map as MaplibreMap } from "maplibre-gl";

// removeLayer/removeSource는 style.ts의 _checkLoaded()가 스타일 전환 중(setStyle 등)에
// 'Style is not done loading.'을 throw할 수 있다. removeSource는 존재하지 않는 id에도
// throw한다 — 그래서 레이어 → 소스 → 이미지 순서가 필수이고, 각 단계를 개별 try/catch로
// 감싼다(React StrictMode의 effect 이중 실행 시 이미 제거된 대상을 다시 지우는 경우 포함).

export function safeRemoveLayers(map: MaplibreMap, layerIds: string[]): void {
  for (const id of layerIds) {
    if (!map.getLayer(id)) continue;
    try {
      map.removeLayer(id);
    } catch {
      // ignore — 스타일 전환 중이거나 이미 제거됨
    }
  }
}

export function safeRemoveSources(
  map: MaplibreMap,
  sourceIds: string[],
): void {
  for (const id of sourceIds) {
    if (!map.getSource(id)) continue;
    try {
      map.removeSource(id);
    } catch {
      // ignore
    }
  }
}

export function safeRemoveImages(map: MaplibreMap, imageIds: string[]): void {
  for (const id of imageIds) {
    if (!map.hasImage(id)) continue;
    try {
      map.removeImage(id);
    } catch {
      // ignore
    }
  }
}

/** 순서 고정: 레이어 → 소스 → 이미지. */
export function teardownLayerGroup(
  map: MaplibreMap,
  group: { layerIds: string[]; sourceIds: string[]; imageIds?: string[] },
): void {
  safeRemoveLayers(map, group.layerIds);
  safeRemoveSources(map, group.sourceIds);
  if (group.imageIds) safeRemoveImages(map, group.imageIds);
}
