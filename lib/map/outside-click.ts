"use client";

import type { Map as MaplibreMap, MapMouseEvent } from "maplibre-gl";

export interface OutsideClickWatcher {
  /** 이 클릭은 피처 핸들러가 이미 처리했으므로 "바깥 클릭"이 아니라고 표시한다. */
  markHandled: (event: MapMouseEvent) => void;
  dispose: () => void;
}

/**
 * 지도의 빈 곳 클릭을 감지해 열려 있는 오버레이(팝업, spiderfy 펼침)를 닫게 한다.
 *
 * setTimeout(0)으로 한 tick 늦게 판정하는 이유: 피처 클릭을 처리하는 click-router와 이
 * 리스너는 같은 "click" 이벤트에 함께 걸려 있어 등록 순서를 보장할 수 없다. MapLibre의
 * Evented.fire()는 같은 tick의 모든 리스너에 **동일한 이벤트 객체 참조**를 넘기므로,
 * 한 tick 뒤에 참조를 비교하면 순서와 무관하게 "방금 그 클릭이 이미 처리됐는지"를 알 수
 * 있다. 이게 없으면 마커를 눌러 방금 연 팝업이 같은 클릭으로 곧바로 닫힌다.
 */
export function watchOutsideClick(
  map: MaplibreMap,
  onOutsideClick: () => void,
): OutsideClickWatcher {
  let handledEvent: MapMouseEvent | null = null;

  const onAnyClick = (event: MapMouseEvent) => {
    setTimeout(() => {
      if (handledEvent === event) return;
      onOutsideClick();
    }, 0);
  };

  map.on("click", onAnyClick);

  return {
    markHandled: (event) => {
      handledEvent = event;
    },
    dispose: () => {
      map.off("click", onAnyClick);
    },
  };
}
