// components/map/search/index.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useGeoSearch } from "@/hooks/use-geo-search";
import { boundsToBBox } from "@/lib/geo-utils";
import type {
  GeoSearchItem,
  GeoSearchResponseError,
} from "@/app/api/geo-search/route";
import type { Map as MaplibreMap, MapGeoJSONFeature } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";

import { SearchInput } from "./search-input";
import { ResultList } from "./result-list";
import { SearchPager } from "./search-pager";
import { SearchError } from "./search-error";

const RESULTS_SOURCE_ID = "search-results";
const RESULTS_ICON_LAYER_ID = "search-results-icon";
const RESULTS_LABEL_LAYER_ID = "search-results-label";
const SELECTED_SOURCE_ID = "search-selected";
const SELECTED_ICON_LAYER_ID = "search-selected-icon";
const SELECTED_LABEL_LAYER_ID = "search-selected-label";

// 기본 마커(Font Awesome map-marker-alt)와 동일한 물방울 핀 모양 path.
// viewBox 0 0 384 512, 하단 뾰족한 끝(tip)이 좌표 앵커.
const PIN_PATH =
  "M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.774-39.464 0z";
const PIN_SRC_W = 384;
const PIN_SRC_H = 512;
const PIN_HEAD_CENTER = { x: 192, y: 192 }; // 머리(원형) 중심 - path 좌표계 기준

const PIN_COLORS: Record<string, string> = {
  blue: "#3b82f6",
  orange: "#f97316",
  red: "#ef4444",
};
const RESULTS_PIN_WIDTH = 24; // 검색 결과 핀 크기(css px)
const SELECTED_PIN_WIDTH = 36; // 선택된 핀은 더 크게

// 페이지당 최대 표시 가능 라벨 수만큼 미리 생성 (A~Z + 여유분)
const PIN_LABELS = Array.from({ length: 30 }, (_, i) => indexToLabel(i));

function indexToLabel(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

function kindToColorKey(kind: string): "blue" | "orange" {
  return kind === "ADDRESS" ? "orange" : "blue";
}

function pinImageId(colorKey: string, label: string, cssWidth: number) {
  return `pin-${colorKey}-${label}-${cssWidth}`;
}

// 캔버스에 핀 모양 + 라벨 텍스트를 그려 ImageData로 반환
function createPinImage(color: string, label: string, cssWidth: number) {
  const pixelRatio = 3; // 2 -> 3, 작은 텍스트일수록 레티나에서 더 또렷함
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
  ctx.font = `800 ${Math.round(cssWidth * 0.55)}px sans-serif`; // 0.42 -> 0.55
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

function computeBoundsFromPoints(
  points: { lon: number; lat: number }[],
): maplibregl.LngLatBounds | null {
  if (points.length === 0) return null;
  const bounds = new maplibregl.LngLatBounds(
    [points[0].lon, points[0].lat],
    [points[0].lon, points[0].lat],
  );
  for (const p of points.slice(1)) bounds.extend([p.lon, p.lat]);
  return bounds;
}

function ensureLayers(map: MaplibreMap) {
  if (!map.getSource(RESULTS_SOURCE_ID)) {
    map.addSource(RESULTS_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    registerPinImages(map, "blue", RESULTS_PIN_WIDTH);
    registerPinImages(map, "orange", RESULTS_PIN_WIDTH);

    map.addLayer({
      id: RESULTS_ICON_LAYER_ID,
      type: "symbol",
      source: RESULTS_SOURCE_ID,
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

export function Search({ map }: { map?: MaplibreMap }) {
  const [open, setOpen] = React.useState(false);
  const [draftQuery, setDraftQuery] = React.useState("");

  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchBbox, setSearchBbox] = React.useState<string | undefined>(
    undefined,
  );

  const [activeTab, setActiveTab] = React.useState<"place" | "address">(
    "place",
  );
  const [placePage, setPlacePage] = React.useState(1);
  const [addressPage, setAddressPage] = React.useState(1);
  const [selectedItemId, setSelectedItemId] = React.useState<
    string | undefined
  >(undefined);

  const [showSearchThisArea, setShowSearchThisArea] = React.useState(false);

  const isProgrammaticMoveRef = React.useRef(false);

  const places = useGeoSearch({
    query: searchQuery,
    type: "place",
    page: placePage,
    bbox: searchBbox,
  });
  const addresses = useGeoSearch({
    query: searchQuery,
    type: "address",
    page: addressPage,
    bbox: searchBbox,
  });

  const totalCount = places.totalCount + addresses.totalCount;
  const hasResults = places.items.length > 0 || addresses.items.length > 0;
  const isSearching = places.isLoading || addresses.isLoading;

  // API ERROR 상태 추출 (활성 탭의 에러 우선)
  const activeData = activeTab === "place" ? places : addresses;
  const apiError: GeoSearchResponseError | undefined = activeData.responseError;

  React.useEffect(() => {
    if (!map) return;
    const setup = () => ensureLayers(map);
    if (map.isStyleLoaded()) setup();
    else map.once("load", setup);
  }, [map]);

  React.useEffect(() => {
    if (!map) return;
    const onMoveEnd = () => {
      if (isProgrammaticMoveRef.current) {
        isProgrammaticMoveRef.current = false;
        return;
      }
      if (!searchQuery || totalCount === 0) return;
      setShowSearchThisArea(true);
    };
    map.on("moveend", onMoveEnd);
    return () => {
      map.off("moveend", onMoveEnd);
      return;
    };
  }, [map, searchQuery, totalCount]);

  React.useEffect(() => {
    setPlacePage(1);
    setAddressPage(1);
  }, [searchQuery, searchBbox]);

  const clearSelection = React.useCallback(() => {
    setSelectedItemId(undefined);
    const source = map?.getSource(SELECTED_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    source?.setData({ type: "FeatureCollection", features: [] });
  }, [map]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = draftQuery.trim();
    setSearchQuery(q);
    setSearchBbox(undefined);
    setShowSearchThisArea(false);
    setOpen(true);
    clearSelection();
  };

  const handleClear = () => {
    setDraftQuery("");
    setSearchQuery("");
    setSearchBbox(undefined);
    setShowSearchThisArea(false);
    setOpen(false);
    clearSelection();
  };

  const handleSearchThisArea = () => {
    if (!map || !searchQuery) return;
    setSearchBbox(boundsToBBox(map.getBounds()));
    setShowSearchThisArea(false);
  };

  React.useEffect(() => {
    if (!map) return;
    const activeItems = activeTab === "place" ? places.items : addresses.items;

    const source = map.getSource(RESULTS_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    source?.setData(toResultsFeatureCollection(activeItems));

    if (activeItems.length === 0) return;

    const bounds = computeBoundsFromPoints(activeItems);
    if (!bounds) return;

    isProgrammaticMoveRef.current = true;
    map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 500 });
  }, [map, activeTab, places.items, addresses.items]);

  const handleSelect = (item: GeoSearchItem, label: string) => {
    setSelectedItemId(item.id);
    const source = map?.getSource(SELECTED_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    source?.setData(toSelectedFeatureCollection(item, label));

    isProgrammaticMoveRef.current = true;
    map?.flyTo({ center: [item.lon, item.lat], zoom: 19 });
  };

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
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
        .setHTML(
          `<div style="font-size:13px;line-height:1.4">
             <div style="font-weight:600">${title}</div>
             <div style="color:#6b7280">${subtitle ?? ""}</div>
             <div style="color:#9ca3af;font-size:11px;margin-top:2px">${kind === "PLACE" ? "장소" : "주소"}</div>
           </div>`,
        )
        .addTo(map);
    };
    const onEnter = () => (map.getCanvas().style.cursor = "pointer");
    const onLeave = () => (map.getCanvas().style.cursor = "");

    for (const id of [RESULTS_ICON_LAYER_ID, SELECTED_ICON_LAYER_ID]) {
      map.on("click", id, onClick);
      map.on("mouseenter", id, onEnter);
      map.on("mouseleave", id, onLeave);
    }
    return () => {
      for (const id of [RESULTS_ICON_LAYER_ID, SELECTED_ICON_LAYER_ID]) {
        map.off("click", id, onClick);
        map.off("mouseenter", id, onEnter);
        map.off("mouseleave", id, onLeave);
      }
      popup.remove();
    };
  }, [map]);

  const activeItems = activeTab === "place" ? places.items : addresses.items;

  // network error 포함: activeData.error는 API 응답 에러 + SWR 네트워크 에러 모두 포함
  const error: Error | undefined = activeData.error ?? undefined;

  return (
    <>
      <SearchInput
        draftQuery={draftQuery}
        onDraftChange={setDraftQuery}
        onSubmit={handleSubmit}
        onClear={handleClear}
      />

      {searchQuery && (
        <div className="mt-2 overflow-hidden rounded-lg bg-background text-foreground shadow-lg">
          <SearchError
            activeTabLoading={activeData.isLoading}
            hasResults={hasResults}
            error={error}
          />

          {hasResults && (
            <>
              <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                <div className="min-w-0 truncate text-sm">
                  <span className="font-medium">{searchQuery}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    검색 결과: 총 {totalCount}건
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setOpen((v) => !v)}
                >
                  {open ? "접기" : "펼치기"}
                </Button>
              </div>

              <Collapsible open={open}>
                <CollapsibleContent>
                  <Tabs
                    value={activeTab}
                    onValueChange={(v) =>
                      setActiveTab(v as "place" | "address")
                    }
                    className="flex max-h-[60vh] flex-col p-2"
                  >
                    <TabsList variant="default" className="w-full">
                      <TabsTrigger value="place" className="flex-1">
                        장소 ({places.totalCount}건)
                      </TabsTrigger>
                      <TabsTrigger value="address" className="flex-1">
                        주소 ({addresses.totalCount}건)
                      </TabsTrigger>
                    </TabsList>

                    <div className="min-h-0 flex-1 overflow-y-auto p-2">
                      <TabsContent value="place" className="m-0">
                        <ResultList
                          items={places.items}
                          isLoading={places.isLoading}
                          emptyLabel="장소 검색 결과가 없습니다."
                          color="blue"
                          selectedItemId={selectedItemId ?? null}
                          onItemSelect={handleSelect}
                          indexToLabel={indexToLabel}
                        />
                      </TabsContent>
                      <TabsContent value="address" className="m-0">
                        <ResultList
                          items={addresses.items}
                          isLoading={addresses.isLoading}
                          emptyLabel="주소 검색 결과가 없습니다."
                          color="orange"
                          selectedItemId={selectedItemId ?? null}
                          onItemSelect={handleSelect}
                          indexToLabel={indexToLabel}
                        />
                      </TabsContent>
                    </div>

                    {activeTab === "place" && (
                      <SearchPager
                        page={placePage}
                        totalPages={places.totalPages}
                        onPageChange={setPlacePage}
                        isLoading={places.isLoading}
                      />
                    )}
                    {activeTab === "address" && (
                      <SearchPager
                        page={addressPage}
                        totalPages={addresses.totalPages}
                        onPageChange={setAddressPage}
                        isLoading={addresses.isLoading}
                      />
                    )}
                  </Tabs>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </div>
      )}

      {map &&
        showSearchThisArea &&
        createPortal(
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
            <Button
              type="button"
              size="lg"
              className="pointer-events-auto gap-1.5 rounded-full shadow-lg"
              onClick={handleSearchThisArea}
            >
              <LocateFixed className="size-4" />이 위치에서 검색
            </Button>
          </div>,
          map.getContainer(),
        )}
    </>
  );
}
