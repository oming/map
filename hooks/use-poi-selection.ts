"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";
import { registerClickRoutes } from "@/lib/map/click-router";
import {
  watchOutsideClick,
  type OutsideClickWatcher,
} from "@/lib/map/outside-click";
import { POI_LAYER_IDS } from "@/lib/vworld/poi-layers";

export interface SelectedPoi {
  properties: Record<string, unknown>;
  coordinates: [number, number];
}

// 검색 결과/데이터 레이어(우선순위 0~10대)가 항상 먼저 반응하도록 최하위로 둔다.
const CLICK_PRIORITY = 1000;

/** V-World 네이티브 POI 클릭 선택 상태. `useDataLayers`(hooks/use-data-layers.ts)와
 *  같은 방식으로 click-router에 등록하고, 지도 빈 곳 클릭 시 선택을 해제한다. */
export function usePoiSelection(map: MaplibreMap | null) {
  const [selected, setSelected] = useState<SelectedPoi | null>(null);
  // 클릭 라우트 등록과 바깥 클릭 감지가 서로 다른 effect에 있어 watcher를 직접
  // 클로저로 넘길 수 없다 — ref로 이어준다(hooks/use-data-layers.ts와 동일 이유).
  const outsideClickRef = useRef<OutsideClickWatcher | null>(null);

  useEffect(() => {
    if (!map) return;
    const watcher = watchOutsideClick(map, () => setSelected(null));
    outsideClickRef.current = watcher;
    return () => {
      watcher.dispose();
      outsideClickRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    return registerClickRoutes(
      POI_LAYER_IDS,
      CLICK_PRIORITY,
      (feature, event) => {
        outsideClickRef.current?.markHandled(event);
        setSelected({
          properties: feature.properties as Record<string, unknown>,
          coordinates: [event.lngLat.lng, event.lngLat.lat],
        });
      },
    );
  }, []);

  return { selected, clearSelected: () => setSelected(null) };
}
