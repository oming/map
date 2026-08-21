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

const LEG_LINE_OPACITY = 0.55;
const LEG_LINE_OPACITY_DIM = 0.3;
const LEG_LINE_WIDTH = 1.5;
const LEG_LINE_WIDTH_ACTIVE = 2.5;

// 클릭/포커스 상태 전환(강조 켜짐·꺼짐)에 쓰는 transition. 펼침 자체의 등장
// 애니메이션은 Tailwind의 animate-in 유틸(아래 ENTRANCE_CLASSES)이 담당한다 —
// 이 transition과는 서로 다른 메커니즘이라 함께 둬도 충돌하지 않는다.
const ACTIVE_TRANSITION = "transform 200ms ease, opacity 200ms ease, filter 200ms ease";
const ENTRANCE_CLASSES = ["animate-in", "zoom-in-50", "fade-in", "duration-300"];
const ENTRANCE_STAGGER_MS = 30;

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
  /** 펼쳐진 동안 원본 핀을 숨기기 위한 feature-state 대상. */
  sourceId: string;
  originFeatureIds: (string | number)[];
}

/**
 * 지도 전체에 하나만 열릴 수 있는 spiderfy 오버레이. 레이어별이 아니라 useDataLayers
 * 안에서 딱 한 번 호출한다 — open()이 항상 이전 Marker를 정리하고 새로 만들므로
 * "다른 레이어 클릭 시 이전 spiderfy 닫힘"이 자동으로 보장된다.
 */
export function useSpiderfy(map: MaplibreMap | null) {
  const markersRef = useRef<Marker[]>([]);
  // leg의 실제 강조/애니메이션 대상 — Marker의 위치 이동용 wrapper와 분리된 내부
  // 엘리먼트(자세한 이유는 open() 안 주석 참고).
  const legDotsRef = useRef<HTMLElement[]>([]);
  const originMarkerRef = useRef<Marker | null>(null);
  const keyRef = useRef<string | null>(null);
  const activeIndexRef = useRef<number | null>(null);
  const originStateRef = useRef<{ sourceId: string; ids: (string | number)[] } | null>(
    null,
  );
  // click-router.ts와 별개로 지도 자체의 "click"을 구독해 바깥 클릭 시 닫는다. 등록
  // 순서에 의존하지 않기 위해, spiderfy를 열거나 토글닫기 한 클릭은 이 ref로 표시해두고
  // setTimeout(0)으로 한 tick 늦게 확인한다(detail-popup.tsx의 root.unmount 지연과 같은
  // 관용구) — MapLibre의 Evented.fire()는 같은 tick의 모든 리스너에 동일한 이벤트 객체
  // 참조를 넘기므로 이 비교는 리스너 등록 순서와 무관하게 항상 정확하다.
  const handledEventRef = useRef<MapMouseEvent | null>(null);

  // 클릭한 leg만 확대·그림자로 강조하고 나머지는 옅게, 연결선도 클릭한 leg만
  // 굵고 진하게 바꾼다. index가 null이면 전부 기본 상태로 되돌린다.
  const setActive = useCallback(
    (index: number | null) => {
      activeIndexRef.current = index;
      legDotsRef.current.forEach((el, i) => {
        if (index == null) {
          el.style.transform = "";
          el.style.opacity = "";
          el.style.filter = "";
        } else if (i === index) {
          el.style.transform = "scale(1.3)";
          el.style.opacity = "1";
          el.style.filter = "drop-shadow(0 3px 6px rgb(0 0 0 / 0.45))";
        } else {
          el.style.transform = "";
          el.style.opacity = "0.55";
          el.style.filter = "";
        }
      });
      if (map?.getLayer(LEGS_LAYER_ID)) {
        map.setPaintProperty(
          LEGS_LAYER_ID,
          "line-opacity",
          index == null
            ? LEG_LINE_OPACITY
            : ["case", ["==", ["get", "index"], index], 1, LEG_LINE_OPACITY_DIM],
        );
        map.setPaintProperty(
          LEGS_LAYER_ID,
          "line-width",
          index == null
            ? LEG_LINE_WIDTH
            : [
                "case",
                ["==", ["get", "index"], index],
                LEG_LINE_WIDTH_ACTIVE,
                LEG_LINE_WIDTH,
              ],
        );
      }
    },
    [map],
  );

  const clearActive = useCallback(() => setActive(null), [setActive]);

  const close = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    legDotsRef.current = [];
    originMarkerRef.current?.remove();
    originMarkerRef.current = null;
    keyRef.current = null;
    activeIndexRef.current = null;
    if (map?.getLayer(LEGS_LAYER_ID)) map.removeLayer(LEGS_LAYER_ID);
    if (map?.getSource(LEGS_SOURCE_ID)) map.removeSource(LEGS_SOURCE_ID);

    const origin = originStateRef.current;
    originStateRef.current = null;
    if (map && origin && map.getSource(origin.sourceId)) {
      origin.ids.forEach((id) => {
        map.setFeatureState({ source: origin.sourceId, id }, { spiderfied: false });
      });
    }
  }, [map]);

  const open = useCallback(
    (params: OpenParams) => {
      if (!map) return;
      close();
      const positions = computeLegLngLats(map, params.anchor, params.items.length);

      params.originFeatureIds.forEach((id) => {
        map.setFeatureState({ source: params.sourceId, id }, { spiderfied: true });
      });
      originStateRef.current = {
        sourceId: params.sourceId,
        ids: params.originFeatureIds,
      };

      const legFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = positions.map(
        (pos, i) => ({
          type: "Feature",
          geometry: { type: "LineString", coordinates: [params.anchor, pos] },
          properties: { index: i },
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
            "line-width": LEG_LINE_WIDTH,
            "line-opacity": LEG_LINE_OPACITY,
          },
        },
        "slot-overlay",
      );

      // 원본 핀이 숨겨지는 동안 anchor 자리를 비워두지 않도록 pulse 표시를 하나
      // 띄운다. pointer-events: none — 같은 지점 재클릭 시 그 클릭이 (숨겨졌지만
      // 여전히 존재하는) 원본 point 레이어로 그대로 라우팅돼 토글-닫기가 동작해야
      // 하므로, 이 표시가 클릭을 가로채면 안 된다.
      const hub = document.createElement("div");
      hub.style.pointerEvents = "none";
      hub.style.width = "14px";
      hub.style.height = "14px";
      hub.className = "relative flex items-center justify-center";
      const ring = document.createElement("span");
      ring.className = "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60";
      ring.style.backgroundColor = params.color;
      const dot = document.createElement("span");
      dot.className = "relative inline-flex rounded-full";
      dot.style.width = "8px";
      dot.style.height = "8px";
      dot.style.backgroundColor = params.color;
      dot.style.border = "2px solid white";
      hub.append(ring, dot);
      originMarkerRef.current = new Marker({ element: hub, anchor: "center" })
        .setLngLat(params.anchor)
        .addTo(map);

      legDotsRef.current = [];
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
        el.classList.add(...ENTRANCE_CLASSES);
        el.style.animationDelay = `${i * ENTRANCE_STAGGER_MS}ms`;
        el.style.animationFillMode = "both";
        el.style.transition = ACTIVE_TRANSITION;
        el.addEventListener("click", (domEvent) => {
          // Marker 엘리먼트는 캔버스와 별도 DOM 서브트리라 지도 "click"으로 버블링되지
          // 않지만, stopPropagation은 방어적으로 유지 — 상위에 다른 클릭 리스너가 생겨도
          // 안전하다. close()는 여기서 호출하지 않는다 — 팝업을 여는 것과 fan을 닫는 것은
          // 별개 동작이라, 형제 leg를 이어서 클릭할 수 있도록 열린 채로 둔다.
          domEvent.stopPropagation();
          setActive(i);
          // item.coordinates는 실제 지리좌표라 겹쳐 있던 항목들끼리 전부 동일하다 —
          // 그대로 넘기면 어떤 leg를 클릭해도 팝업이 anchor 한 점에만 뜬다("팝업이
          // 중앙에만 뜬다"는 문제의 원인). 펼쳐진 leg 자기 위치(positions[i])를
          // 대신 넘겨 팝업이 클릭한 leg를 따라가게 한다.
          params.onSelect({ ...item, coordinates: positions[i] });
        });
        legDotsRef.current.push(el);
        // MapLibre Marker는 위치 이동을 element.style.transform으로 직접 구현한다
        // (translate(-50%,-50%) translate(x,y) ...). setActive()가 강조 효과로
        // transform을 건드리면 그 위치 transform을 덮어써 마커가 사라지므로, Marker에는
        // 빈 wrapper를 주고 실제 스타일(확대/그림자/애니메이션)은 안쪽 el에만 적용한다.
        const wrapper = document.createElement("div");
        wrapper.appendChild(el);
        return new Marker({ element: wrapper, anchor: "center" })
          .setLngLat(positions[i])
          .addTo(map);
      });
      keyRef.current = params.key;
    },
    [map, close, setActive],
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
    () => ({ open, close, markEventHandled, getCurrentKey, clearActive }),
    [open, close, markEventHandled, getCurrentKey, clearActive],
  );
}
