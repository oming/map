"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Marker, type Map as MaplibreMap, type MapMouseEvent } from "maplibre-gl";
import { computeLegLngLats } from "@/lib/map/spiderfy";
import {
  createPinElement,
  SPIDER_DOT_GLYPH_CENTER,
  SPIDER_DOT_PATH,
  SPIDER_DOT_SRC_SIZE,
  SPIDER_DOT_WIDTH,
  type PinIcon,
} from "@/lib/map/pin-image";

// anchor(원래 겹쳐 있던 지점)에서 각 leg 마커로 이어지는 선을 그리는 소스/레이어.
// open()마다 add, close()마다 remove — Marker를 매번 새로 만드는 것과 같은 패턴이다.
const LEGS_SOURCE_ID = "spiderfy-legs";
const LEGS_LAYER_ID = "spiderfy-legs-line";

export interface SpiderfyItem {
  properties: Record<string, unknown>;
  coordinates: [number, number];
}

interface OpenParams {
  /** 같은 클러스터/포인트를 다시 클릭했는지 판별하는 키 — 토글용. */
  key: string;
  anchor: [number, number];
  color: string;
  icon?: PinIcon;
  items: SpiderfyItem[];
  onSelect: (item: SpiderfyItem) => void;
}

/**
 * 지도 전체에 하나만 열릴 수 있는 spiderfy 오버레이. 레이어별이 아니라 useDataLayers
 * 안에서 딱 한 번 호출한다 — open()이 항상 이전 Marker를 정리하고 새로 만들므로
 * "다른 레이어 클릭 시 이전 spiderfy 닫힘"이 자동으로 보장된다.
 */
export function useSpiderfy(map: MaplibreMap | null) {
  const markersRef = useRef<Marker[]>([]);
  const keyRef = useRef<string | null>(null);
  // click-router.ts와 별개로 지도 자체의 "click"을 구독해 바깥 클릭 시 닫는다. 등록
  // 순서에 의존하지 않기 위해, spiderfy를 열거나 토글닫기 한 클릭은 이 ref로 표시해두고
  // setTimeout(0)으로 한 tick 늦게 확인한다(detail-popup.tsx의 root.unmount 지연과 같은
  // 관용구) — MapLibre의 Evented.fire()는 같은 tick의 모든 리스너에 동일한 이벤트 객체
  // 참조를 넘기므로 이 비교는 리스너 등록 순서와 무관하게 항상 정확하다.
  const handledEventRef = useRef<MapMouseEvent | null>(null);

  const close = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    keyRef.current = null;
    if (map?.getLayer(LEGS_LAYER_ID)) map.removeLayer(LEGS_LAYER_ID);
    if (map?.getSource(LEGS_SOURCE_ID)) map.removeSource(LEGS_SOURCE_ID);
  }, [map]);

  const open = useCallback(
    (params: OpenParams) => {
      if (!map) return;
      close();
      const positions = computeLegLngLats(map, params.anchor, params.items.length);

      const legFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = positions.map(
        (pos) => ({
          type: "Feature",
          geometry: { type: "LineString", coordinates: [params.anchor, pos] },
          properties: {},
        }),
      );
      map.addSource(LEGS_SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: legFeatures },
      });
      map.addLayer(
        {
          id: LEGS_LAYER_ID,
          type: "line",
          source: LEGS_SOURCE_ID,
          paint: {
            "line-color": params.color,
            "line-width": 1.5,
            "line-opacity": 0.6,
          },
        },
        "slot-overlay",
      );

      markersRef.current = params.items.map((item, i) => {
        const el = createPinElement({
          path: SPIDER_DOT_PATH,
          srcWidth: SPIDER_DOT_SRC_SIZE,
          srcHeight: SPIDER_DOT_SRC_SIZE,
          glyphCenter: SPIDER_DOT_GLYPH_CENTER,
          color: params.color,
          icon: params.icon,
          cssWidth: SPIDER_DOT_WIDTH,
        });
        el.addEventListener("click", (domEvent) => {
          // Marker 엘리먼트는 캔버스와 별도 DOM 서브트리라 지도 "click"으로 버블링되지
          // 않지만, stopPropagation은 방어적으로 유지 — 상위에 다른 클릭 리스너가 생겨도
          // 안전하다. close()는 여기서 호출하지 않는다 — 팝업을 여는 것과 fan을 닫는 것은
          // 별개 동작이라, 형제 leg를 이어서 클릭할 수 있도록 열린 채로 둔다.
          domEvent.stopPropagation();
          params.onSelect(item);
        });
        return new Marker({ element: el, anchor: "center" })
          .setLngLat(positions[i])
          .addTo(map);
      });
      keyRef.current = params.key;
    },
    [map, close],
  );

  const markEventHandled = useCallback((event: MapMouseEvent) => {
    handledEventRef.current = event;
  }, []);

  const getCurrentKey = useCallback(() => keyRef.current, []);

  useEffect(() => {
    if (!map) return;
    const onAnyClick = (e: MapMouseEvent) => {
      setTimeout(() => {
        if (handledEventRef.current === e) return;
        close();
      }, 0);
    };
    const onMoveStart = () => close();
    map.on("click", onAnyClick);
    map.on("movestart", onMoveStart);
    return () => {
      map.off("click", onAnyClick);
      map.off("movestart", onMoveStart);
      close();
    };
  }, [map, close]);

  // useDataLayers의 메인 useEffect가 이 반환값을 의존성 배열에 넣으므로(레이어
  // 활성화 목록이 바뀔 때만 재실행되어야 함), 매 렌더 새 객체를 리턴하면 안 된다.
  return useMemo(
    () => ({ open, close, markEventHandled, getCurrentKey }),
    [open, close, markEventHandled, getCurrentKey],
  );
}
