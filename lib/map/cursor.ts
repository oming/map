"use client";

import type { Map as MaplibreMap } from "maplibre-gl";

/**
 * 지정한 레이어들 위에 커서를 올리면 pointer로 바꾼다. 반환값을 호출하면 해제된다
 * (effect cleanup에서 사용).
 */
export function setPointerCursorOn(
  map: MaplibreMap,
  layerIds: string[],
): () => void {
  const showPointer = () => (map.getCanvas().style.cursor = "pointer");
  const resetCursor = () => (map.getCanvas().style.cursor = "");

  for (const layerId of layerIds) {
    map.on("mouseenter", layerId, showPointer);
    map.on("mouseleave", layerId, resetCursor);
  }

  return () => {
    for (const layerId of layerIds) {
      map.off("mouseenter", layerId, showPointer);
      map.off("mouseleave", layerId, resetCursor);
    }
  };
}
