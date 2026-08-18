// hooks/use-search-map-layers.ts
import { useEffect, useRef, useState } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import type { GeoSearchItem } from "@/app/api/geo-search/route";
import { viewportBBoxWithMinRadius, indexToLabel } from "@/lib/geo-utils";
import {
  registerClickRoutes,
  type ClickRoute,
} from "@/lib/map/click-router";
import { registerPinImage } from "@/lib/map/pin-image";

const RESULTS_SOURCE_ID = "search-results";
const RESULTS_ICON_LAYER_ID = "search-results-icon";
const RESULTS_LABEL_LAYER_ID = "search-results-label";
const RESULTS_CLUSTER_LAYER_ID = "search-results-cluster";
const RESULTS_CLUSTER_COUNT_LAYER_ID = "search-results-cluster-count";
const SELECTED_SOURCE_ID = "search-selected";
const SELECTED_ICON_LAYER_ID = "search-selected-icon";
const SELECTED_LABEL_LAYER_ID = "search-selected-label";

const PIN_COLORS: Record<string, string> = {
  blue: "#3b82f6",
  orange: "#f97316",
  red: "#ef4444",
};
const RESULTS_PIN_WIDTH = 24;
const SELECTED_PIN_WIDTH = 36;

const PIN_LABELS = Array.from({ length: 30 }, (_, i) => indexToLabel(i));

function kindToColorKey(kind: string): "blue" | "orange" {
  return kind === "ADDRESS" ? "orange" : "blue";
}

function pinImageId(colorKey: string, label: string, cssWidth: number) {
  return `pin-${colorKey}-${label}-${cssWidth}`;
}

function registerPinImages(
  map: MaplibreMap,
  colorKey: string,
  cssWidth: number,
) {
  const color = PIN_COLORS[colorKey];
  for (const label of PIN_LABELS) {
    registerPinImage(map, pinImageId(colorKey, label, cssWidth), {
      color,
      label,
      cssWidth,
    });
  }
}

function toResultsFeatureCollection(
  items: GeoSearchItem[],
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: items.map((item, idx) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [item.lon, item.lat] },
      properties: {
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        kind: item.kind,
        colorKey: kindToColorKey(item.kind),
        label: indexToLabel(idx),
      },
    })),
  };
}

function toSelectedFeatureCollection(
  item: GeoSearchItem,
  label: string,
): GeoJSON.FeatureCollection {
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

function ensureLayers(map: MaplibreMap) {
  if (!map.getSource(RESULTS_SOURCE_ID)) {
    map.addSource(RESULTS_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
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
        "circle-radius": [
          "step",
          ["get", "point_count"],
          16,
          5,
          20,
          15,
          24,
        ],
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
        "icon-image": [
          "concat",
          "pin-",
          ["get", "colorKey"],
          "-",
          ["get", "label"],
          "-",
          String(RESULTS_PIN_WIDTH),
        ],
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
      data: { type: "FeatureCollection", features: [] },
    });

    registerPinImages(map, "red", SELECTED_PIN_WIDTH);

    map.addLayer({
      id: SELECTED_ICON_LAYER_ID,
      type: "symbol",
      source: SELECTED_SOURCE_ID,
      layout: {
        "icon-image": [
          "concat",
          "pin-",
          ["get", "colorKey"],
          "-",
          ["get", "label"],
          "-",
          String(SELECTED_PIN_WIDTH),
        ],
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

function buildPopupContent(title: string, subtitle: string, kind: string) {
  const root = document.createElement("div");
  root.style.fontSize = "13px";
  root.style.lineHeight = "1.4";

  const titleEl = document.createElement("div");
  titleEl.style.fontWeight = "600";
  titleEl.textContent = title;
  root.appendChild(titleEl);

  const subtitleEl = document.createElement("div");
  subtitleEl.style.color = "#6b7280";
  subtitleEl.textContent = subtitle ?? "";
  root.appendChild(subtitleEl);

  const kindEl = document.createElement("div");
  kindEl.style.color = "#9ca3af";
  kindEl.style.fontSize = "11px";
  kindEl.style.marginTop = "2px";
  kindEl.textContent = kind === "PLACE" ? "장소" : "주소";
  root.appendChild(kindEl);

  return root;
}

export interface UseSearchMapLayersOptions {
  map: MaplibreMap | null;
  activeTab: "place" | "address";
  placesItems: GeoSearchItem[];
  addressesItems: GeoSearchItem[];
  searchQuery: string;
  onBBoxChange: (bbox: string | undefined) => void;
}

export function useSearchMapLayers(options: UseSearchMapLayersOptions) {
  const {
    map,
    activeTab,
    placesItems,
    addressesItems,
    searchQuery,
    onBBoxChange,
  } = options;

  const isProgrammaticMoveRef = useRef(false);
  const [showSearchThisArea, setShowSearchThisArea] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(
    undefined,
  );

  // 검색어가 바뀌면(새 검색 제출/초기화) "이 위치에서 검색" 버튼을 숨긴다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowSearchThisArea(false);
  }, [searchQuery]);

  // 레이어 설정: 스타일 로드 시점/이후 보장.
  // 'style.load'는 최초 로드뿐 아니라 향후 setStyle(베이스맵 전환)에도 재발화하므로
  // once('load') 대신 on을 쓴다 — isStyleLoaded()+once('load') 조합은 이 effect가
  // load 발화 '이후'에 재실행되면(예: StrictMode 이중 마운트 타이밍) once('load')가
  // 다시 오지 않을 이미 지나간 이벤트를 기다리며 레이어가 조용히 생성되지 않는 버그가 있다.
  useEffect(() => {
    if (!map) return;
    const setup = () => ensureLayers(map);
    if (map.isStyleLoaded()) setup();
    map.on("style.load", setup);
    return () => {
      map.off("style.load", setup);
    };
  }, [map]);

  // 결과 렌더링 (지도 이동/줌은 하지 않음 — 검색 자체가 이미 현재 뷰 기준이므로)
  useEffect(() => {
    if (!map) return;
    const activeItems = activeTab === "place" ? placesItems : addressesItems;

    const source = map.getSource(RESULTS_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    source?.setData(toResultsFeatureCollection(activeItems));
  }, [map, activeTab, placesItems, addressesItems]);

  // 선택 항목 핀 + flyTo
  const handleSelect = (item: GeoSearchItem, label: string) => {
    setSelectedItemId(item.id);
    const source = map?.getSource(SELECTED_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    source?.setData(toSelectedFeatureCollection(item, label));

    isProgrammaticMoveRef.current = true;
    map?.flyTo({ center: [item.lon, item.lat], zoom: 19 });
  };

  const clearSelection = () => {
    setSelectedItemId(undefined);
    const source = map?.getSource(SELECTED_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    source?.setData({ type: "FeatureCollection", features: [] });
  };

  // 팝업 클릭 핸들러 — 클릭은 맵 레벨 단일 라우터(lib/map/click-router)로 등록한다.
  // 검색 결과는 우선순위 최상(0)이라 향후 추가될 데이터 레이어보다 항상 먼저 반응한다.
  // 커서 변경(mouseenter/mouseleave)은 우선순위 의미가 없으므로 위임 핸들러를 그대로 쓴다.
  useEffect(() => {
    if (!map) return;
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: true,
      offset: 18,
    });

    const onPointClick: ClickRoute["onClick"] = (feature) => {
      if (feature.geometry.type !== "Point") return;
      const [lon, lat] = feature.geometry.coordinates as [number, number];
      const { title, subtitle, kind } = feature.properties as {
        title: string;
        subtitle: string;
        kind: string;
      };

      popup
        .setLngLat([lon, lat])
        .setDOMContent(buildPopupContent(title, subtitle, kind))
        .addTo(map);
    };
    const onEnter = () => (map.getCanvas().style.cursor = "pointer");
    const onLeave = () => (map.getCanvas().style.cursor = "");

    const onClusterClick: ClickRoute["onClick"] = (feature) => {
      if (feature.geometry.type !== "Point") return;
      const center = feature.geometry.coordinates as [number, number];
      const clusterId = feature.properties?.cluster_id;
      const source = map.getSource(RESULTS_SOURCE_ID) as
        | maplibregl.GeoJSONSource
        | undefined;
      if (clusterId == null || !source) return;

      source
        .getClusterExpansionZoom(clusterId)
        .then((zoom) => {
          isProgrammaticMoveRef.current = true;
          map.easeTo({ center, zoom });
        })
        .catch(() => {});
    };

    const unregisterPointClick = registerClickRoutes(
      [RESULTS_ICON_LAYER_ID, SELECTED_ICON_LAYER_ID],
      0,
      onPointClick,
    );
    const unregisterClusterClick = registerClickRoutes(
      [RESULTS_CLUSTER_LAYER_ID],
      0,
      onClusterClick,
    );

    for (const id of [RESULTS_ICON_LAYER_ID, SELECTED_ICON_LAYER_ID]) {
      map.on("mouseenter", id, onEnter);
      map.on("mouseleave", id, onLeave);
    }
    map.on("mouseenter", RESULTS_CLUSTER_LAYER_ID, onEnter);
    map.on("mouseleave", RESULTS_CLUSTER_LAYER_ID, onLeave);

    return () => {
      unregisterPointClick();
      unregisterClusterClick();
      for (const id of [RESULTS_ICON_LAYER_ID, SELECTED_ICON_LAYER_ID]) {
        map.off("mouseenter", id, onEnter);
        map.off("mouseleave", id, onLeave);
      }
      map.off("mouseenter", RESULTS_CLUSTER_LAYER_ID, onEnter);
      map.off("mouseleave", RESULTS_CLUSTER_LAYER_ID, onLeave);
      popup.remove();
    };
  }, [map]);

  // moveend/zoomend → "이 위치에서 검색" 버튼 표시
  // (결과가 0건이어도 새 영역에서 다시 검색할 수 있어야 하므로 totalCount는 조건에 넣지 않는다.
  // zoomend는 이동 없이 줌만 바뀐 경우를 놓치지 않기 위한 보강 리스너 — ref는 moveend에서만
  // 리셋해 flyTo(줌+이동 동반) 도중 프로그램적 이동을 정상적으로 무시한다.)
  useEffect(() => {
    if (!map) return;
    const onZoomEnd = () => {
      if (isProgrammaticMoveRef.current) return;
      if (!searchQuery) return;
      setShowSearchThisArea(true);
    };
    const onMoveEnd = () => {
      if (isProgrammaticMoveRef.current) {
        isProgrammaticMoveRef.current = false;
        return;
      }
      if (!searchQuery) return;
      setShowSearchThisArea(true);
    };
    map.on("zoomend", onZoomEnd);
    map.on("moveend", onMoveEnd);
    return () => {
      map.off("zoomend", onZoomEnd);
      map.off("moveend", onMoveEnd);
    };
  }, [map, searchQuery]);

  // 이 위치에서 검색 실행
  const handleSearchThisArea = () => {
    if (!map || !searchQuery) return;
    onBBoxChange(viewportBBoxWithMinRadius(map.getBounds()));
    setShowSearchThisArea(false);
  };

  return {
    selectedItemId,
    handleSelect,
    clearSelection,
    handleSearchThisArea,
    showSearchThisArea,
  };
}
