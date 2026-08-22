"use client";

import type {
  ExpressionSpecification,
  Map as MaplibreMap,
} from "maplibre-gl";
import type { GeoSearchItem } from "@/app/api/geo-search/route";
import { registerPinImage, STANDARD_PIN_WIDTH } from "@/lib/map/pin-image";

export const RESULTS_SOURCE_ID = "search-results";
export const RESULTS_ICON_LAYER_ID = "search-results-icon";
export const RESULTS_LABEL_LAYER_ID = "search-results-label";
export const RESULTS_CLUSTER_LAYER_ID = "search-results-cluster";
export const RESULTS_CLUSTER_COUNT_LAYER_ID = "search-results-cluster-count";
export const SELECTED_SOURCE_ID = "search-selected";
export const SELECTED_ICON_LAYER_ID = "search-selected-icon";
export const SELECTED_LABEL_LAYER_ID = "search-selected-label";

export type PinColorKey = "blue" | "orange" | "red";

const PIN_COLORS: Record<PinColorKey, string> = {
  blue: "#3b82f6",
  orange: "#f97316",
  red: "#ef4444",
};

// 검색/데이터 레이어 마커 크기를 전부 통일한다 — 서로 다른 소스(별도 React 루트 포함)에서
// 만들어지는 핀이라도 시각적으로 같은 크기여야 한다는 요구에 따라 STANDARD_PIN_WIDTH를 공유한다.
const RESULTS_PIN_WIDTH = STANDARD_PIN_WIDTH;
const SELECTED_PIN_WIDTH = STANDARD_PIN_WIDTH;

/** 결과 목록과 지도 핀이 같은 기호를 쓰도록 하는 표시 규칙 — A, B, … Z, 그 뒤로는 27, 28 …. */
export function indexToLabel(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

// 핀 이미지는 라벨마다 하나씩 미리 만들어 등록해둔다. 한 페이지에 30건을 넘게 표시하지
// 않으므로 그만큼만 준비한다.
const PIN_LABELS = Array.from({ length: 30 }, (_, i) => indexToLabel(i));

/** 이 레이어들이 실제로 쓰는 GeoJSON properties. MapLibre가 돌려주는 feature.properties는
 *  타입이 없으므로, 읽는 쪽에서는 이 타입으로 한 번만 단언한다. */
export interface SearchResultProperties {
  id: string;
  title: string;
  subtitle: string;
  kind: GeoSearchItem["kind"];
  colorKey: PinColorKey;
  label: string;
}

export type SearchResultCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  SearchResultProperties
>;

export const EMPTY_RESULT_COLLECTION: SearchResultCollection = {
  type: "FeatureCollection",
  features: [],
};

function kindToColorKey(kind: GeoSearchItem["kind"]): PinColorKey {
  return kind === "ADDRESS" ? "orange" : "blue";
}

function pinImageId(colorKey: PinColorKey, label: string, cssWidth: number) {
  return `pin-${colorKey}-${label}-${cssWidth}`;
}

function registerPinImages(
  map: MaplibreMap,
  colorKey: PinColorKey,
  cssWidth: number,
) {
  for (const label of PIN_LABELS) {
    registerPinImage(map, pinImageId(colorKey, label, cssWidth), {
      color: PIN_COLORS[colorKey],
      label,
      cssWidth,
    });
  }
}

/** icon-image를 feature 속성에서 조립한다 — pinImageId()와 같은 규칙이어야 한다. */
function pinImageExpression(cssWidth: number): ExpressionSpecification {
  return [
    "concat",
    "pin-",
    ["get", "colorKey"],
    "-",
    ["get", "label"],
    "-",
    String(cssWidth),
  ];
}

export function toResultsFeatureCollection(
  items: GeoSearchItem[],
): SearchResultCollection {
  return {
    type: "FeatureCollection",
    features: items.map((item, index) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [item.lon, item.lat] },
      properties: {
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        kind: item.kind,
        colorKey: kindToColorKey(item.kind),
        label: indexToLabel(index),
      },
    })),
  };
}

export function toSelectedFeatureCollection(
  item: GeoSearchItem,
  label: string,
): SearchResultCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [item.lon, item.lat] },
        properties: {
          id: item.id,
          title: item.title,
          subtitle: item.subtitle,
          kind: item.kind,
          colorKey: "red",
          label,
        },
      },
    ],
  };
}

/**
 * 검색 결과/선택 항목 소스와 레이어를 만든다. 이미 있으면 아무것도 하지 않으므로
 * style.load마다 반복 호출해도 안전하다.
 *
 * 데이터 레이어와 달리 "slot-overlay" 앵커를 쓰지 않는다 — 검색 핀은 사용자가 방금 요청한
 * 결과라 항상 최상단에 보여야 하고, beforeId 없이 추가하면 그 순서가 보장된다.
 */
export function ensureSearchLayers(map: MaplibreMap) {
  if (!map.getSource(RESULTS_SOURCE_ID)) {
    map.addSource(RESULTS_SOURCE_ID, {
      type: "geojson",
      data: EMPTY_RESULT_COLLECTION,
      cluster: true,
      clusterMaxZoom: 17,
      clusterRadius: 50,
      clusterProperties: {
        // 클러스터 안 포인트는 항상 같은 탭(장소/주소) 소속이라 colorKey가
        // 동일함 — 대표값 하나만 끌어와 클러스터 원 색상에 사용한다.
        colorKey: [
          ["coalesce", ["accumulated"], ["get", "colorKey"]],
          ["get", "colorKey"],
        ],
      },
    });

    registerPinImages(map, "blue", RESULTS_PIN_WIDTH);
    registerPinImages(map, "orange", RESULTS_PIN_WIDTH);

    map.addLayer({
      id: RESULTS_CLUSTER_LAYER_ID,
      type: "circle",
      source: RESULTS_SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "match",
          ["get", "colorKey"],
          "orange",
          PIN_COLORS.orange,
          PIN_COLORS.blue,
        ],
        "circle-radius": ["step", ["get", "point_count"], 16, 5, 20, 15, 24],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });

    map.addLayer({
      id: RESULTS_CLUSTER_COUNT_LAYER_ID,
      type: "symbol",
      source: RESULTS_SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["NanumGothic Bold"],
        "text-size": 12,
      },
      paint: {
        "text-color": "#ffffff",
      },
    });

    map.addLayer({
      id: RESULTS_ICON_LAYER_ID,
      type: "symbol",
      source: RESULTS_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": pinImageExpression(RESULTS_PIN_WIDTH),
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });

    map.addLayer({
      id: RESULTS_LABEL_LAYER_ID,
      type: "symbol",
      source: RESULTS_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "text-field": ["get", "title"],
        "text-size": 12,
        "text-offset": [0, 0.5],
        "text-anchor": "top",
        "text-font": ["NanumGothic Bold"],
        "text-allow-overlap": false,
        "text-optional": true,
      },
      paint: {
        "text-color": "#111827",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.5,
      },
    });
  }

  if (!map.getSource(SELECTED_SOURCE_ID)) {
    map.addSource(SELECTED_SOURCE_ID, {
      type: "geojson",
      data: EMPTY_RESULT_COLLECTION,
    });

    registerPinImages(map, "red", SELECTED_PIN_WIDTH);

    map.addLayer({
      id: SELECTED_ICON_LAYER_ID,
      type: "symbol",
      source: SELECTED_SOURCE_ID,
      layout: {
        "icon-image": pinImageExpression(SELECTED_PIN_WIDTH),
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });

    map.addLayer({
      id: SELECTED_LABEL_LAYER_ID,
      type: "symbol",
      source: SELECTED_SOURCE_ID,
      layout: {
        "text-field": ["get", "title"],
        "text-size": 13,
        "text-offset": [0, 0.6],
        "text-anchor": "top",
        "text-font": ["NanumGothic ExtraBold"],
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#111827",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.5,
      },
    });
  }
}

/** 검색 결과 핀 팝업 내용. DetailPopup(데이터 레이어)과 달리 React를 거치지 않는다 —
 *  이 팝업은 텍스트 세 줄이 전부라 별도 React 루트를 띄울 이유가 없다. */
export function buildResultPopupContent(
  properties: SearchResultProperties,
): HTMLElement {
  const root = document.createElement("div");
  root.style.fontSize = "13px";
  root.style.lineHeight = "1.4";

  const titleEl = document.createElement("div");
  titleEl.style.fontWeight = "600";
  titleEl.textContent = properties.title;
  root.appendChild(titleEl);

  const subtitleEl = document.createElement("div");
  subtitleEl.style.color = "#6b7280";
  subtitleEl.textContent = properties.subtitle ?? "";
  root.appendChild(subtitleEl);

  const kindEl = document.createElement("div");
  kindEl.style.color = "#9ca3af";
  kindEl.style.fontSize = "11px";
  kindEl.style.marginTop = "2px";
  kindEl.textContent = properties.kind === "PLACE" ? "장소" : "주소";
  root.appendChild(kindEl);

  return root;
}
