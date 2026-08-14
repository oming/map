// hooks/use-search-map-layers.ts
import { useEffect, useRef, useState } from "react";
import type { Map as MaplibreMap, MapGeoJSONFeature } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import type { GeoSearchItem } from "@/app/api/geo-search/route";
import { viewportBBoxWithMinRadius, indexToLabel } from "@/lib/geo-utils";

const RESULTS_SOURCE_ID = "search-results";
const RESULTS_ICON_LAYER_ID = "search-results-icon";
const RESULTS_LABEL_LAYER_ID = "search-results-label";
const RESULTS_CLUSTER_LAYER_ID = "search-results-cluster";
const RESULTS_CLUSTER_COUNT_LAYER_ID = "search-results-cluster-count";
const SELECTED_SOURCE_ID = "search-selected";
const SELECTED_ICON_LAYER_ID = "search-selected-icon";
const SELECTED_LABEL_LAYER_ID = "search-selected-label";

const PIN_PATH =
  "M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.774-39.464 0z";
const PIN_SRC_W = 384;
const PIN_SRC_H = 512;
const PIN_HEAD_CENTER = { x: 192, y: 192 };

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

function createPinImage(color: string, label: string, cssWidth: number) {
  const pixelRatio = 3;
  const cssHeight = cssWidth * (PIN_SRC_H / PIN_SRC_W);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cssWidth * pixelRatio);
  canvas.height = Math.round(cssHeight * pixelRatio);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(pixelRatio, pixelRatio);

  const scale = cssWidth / PIN_SRC_W;
  const path = new Path2D(PIN_PATH);

  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.fill(path);
  ctx.lineWidth = 2 / scale;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke(path);
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${Math.round(cssWidth * 0.55)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, PIN_HEAD_CENTER.x * scale, PIN_HEAD_CENTER.y * scale);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    width: canvas.width,
    height: canvas.height,
    data: imageData.data,
    pixelRatio,
  };
}

function registerPinImages(
  map: MaplibreMap,
  colorKey: string,
  cssWidth: number,
) {
  const color = PIN_COLORS[colorKey];
  for (const label of PIN_LABELS) {
    const id = pinImageId(colorKey, label, cssWidth);
    if (map.hasImage(id)) continue;
    const img = createPinImage(color, label, cssWidth);
    map.addImage(id, img, { pixelRatio: img.pixelRatio });
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

  // 레이어 설정: 스타일 로드 시점/이후 보장
  useEffect(() => {
    if (!map) return;
    const setup = () => ensureLayers(map);
    if (map.isStyleLoaded()) setup();
    else map.once("load", setup);
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

  // 팝업 클릭 핸들러
  useEffect(() => {
    if (!map) return;
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: true,
      offset: 18,
    });

    const onClick = (
      e: maplibregl.MapMouseEvent & { features?: MapGeoJSONFeature[] },
    ) => {
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
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

    const onClusterClick = (
      e: maplibregl.MapMouseEvent & { features?: MapGeoJSONFeature[] },
    ) => {
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
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

    for (const id of [RESULTS_ICON_LAYER_ID, SELECTED_ICON_LAYER_ID]) {
      map.on("click", id, onClick);
      map.on("mouseenter", id, onEnter);
      map.on("mouseleave", id, onLeave);
    }
    map.on("click", RESULTS_CLUSTER_LAYER_ID, onClusterClick);
    map.on("mouseenter", RESULTS_CLUSTER_LAYER_ID, onEnter);
    map.on("mouseleave", RESULTS_CLUSTER_LAYER_ID, onLeave);

    return () => {
      for (const id of [RESULTS_ICON_LAYER_ID, SELECTED_ICON_LAYER_ID]) {
        map.off("click", id, onClick);
        map.off("mouseenter", id, onEnter);
        map.off("mouseleave", id, onLeave);
      }
      map.off("click", RESULTS_CLUSTER_LAYER_ID, onClusterClick);
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
