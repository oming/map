"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import { Popup } from "maplibre-gl";
import type { GeoSearchItem } from "@/app/api/geo-search/route";
import { viewportBBoxWithMinRadius } from "@/lib/geo-utils";
import { registerClickRoutes, type ClickRoute } from "@/lib/map/click-router";
import { setPointerCursorOn } from "@/lib/map/cursor";
import {
  buildResultPopupContent,
  ensureSearchLayers,
  EMPTY_RESULT_COLLECTION,
  RESULTS_CLUSTER_LAYER_ID,
  RESULTS_ICON_LAYER_ID,
  RESULTS_SOURCE_ID,
  SELECTED_ICON_LAYER_ID,
  SELECTED_SOURCE_ID,
  toResultsFeatureCollection,
  toSelectedFeatureCollection,
  type SearchResultCollection,
  type SearchResultProperties,
} from "@/lib/map/search-layers";

export interface UseSearchMapLayersOptions {
  map: MaplibreMap;
  activeTab: "place" | "address";
  placesItems: GeoSearchItem[];
  addressesItems: GeoSearchItem[];
  searchQuery: string;
  onBBoxChange: (bbox: string | undefined) => void;
}

export function useSearchMapLayers({
  map,
  activeTab,
  placesItems,
  addressesItems,
  searchQuery,
  onBBoxChange,
}: UseSearchMapLayersOptions) {
  const isProgrammaticMoveRef = useRef(false);
  const [showSearchThisArea, setShowSearchThisArea] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(
    undefined,
  );
  // 베이스맵 전환(setStyle) 후 결과/선택 소스는 되살아나지만 비어 있다 — 결과 핀은
  // styleEpoch로 아래 데이터 주입 effect를 다시 돌려 재수화하고, 선택 핀은 콜백에서만
  // setData를 호출하므로 마지막 값을 ref에 담아뒀다가 style.load 시점에 되돌려 준다.
  const [styleEpoch, setStyleEpoch] = useState(0);
  const selectedDataRef = useRef<SearchResultCollection>(
    EMPTY_RESULT_COLLECTION,
  );

  // 검색어가 바뀌면(새 검색 제출/초기화) "이 위치에서 검색" 버튼을 숨긴다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowSearchThisArea(false);
  }, [searchQuery]);

  // 레이어 설정: 스타일 로드 시점/이후 보장.
  // MapContext의 styleReady를 쓰지 않고 직접 구독하는 이유 — Search는 ReactControl이 만든
  // 별도 React 루트에서 렌더되므로 MapContext에 접근할 수 없다(components/map/react-control.tsx).
  // 'style.load'는 최초 로드뿐 아니라 향후 setStyle(베이스맵 전환)에도 재발화하므로
  // once('load') 대신 on을 쓴다 — isStyleLoaded()+once('load') 조합은 이 effect가
  // load 발화 '이후'에 재실행되면(예: StrictMode 이중 마운트 타이밍) once('load')가
  // 다시 오지 않을 이미 지나간 이벤트를 기다리며 레이어가 조용히 생성되지 않는 버그가 있다.
  useEffect(() => {
    const setup = () => {
      ensureSearchLayers(map);
      // 소스는 되살아나지만 비어 있다 — 선택 핀은 ref에 담아둔 마지막 값을 즉시
      // 되돌리고, 결과 핀은 epoch를 올려 아래 데이터 주입 effect를 다시 돌린다.
      map
        .getSource<GeoJSONSource>(SELECTED_SOURCE_ID)
        ?.setData(selectedDataRef.current);
      setStyleEpoch((n) => n + 1);
    };
    if (map.isStyleLoaded()) setup();
    map.on("style.load", setup);
    return () => {
      map.off("style.load", setup);
    };
  }, [map]);

  // 결과 렌더링 (지도 이동/줌은 하지 않음 — 검색 자체가 이미 현재 뷰 기준이므로)
  // styleEpoch는 베이스맵 전환으로 비워진 소스를 같은 데이터로 다시 채우기 위한 트리거다.
  useEffect(() => {
    const activeItems = activeTab === "place" ? placesItems : addressesItems;
    const source = map.getSource<GeoJSONSource>(RESULTS_SOURCE_ID);
    source?.setData(toResultsFeatureCollection(activeItems));
  }, [map, activeTab, placesItems, addressesItems, styleEpoch]);

  // 팝업/커서 — 클릭은 맵 레벨 단일 라우터(lib/map/click-router)로 등록한다.
  // 검색 결과는 우선순위 최상(0)이라 향후 추가될 데이터 레이어보다 항상 먼저 반응한다.
  useEffect(() => {
    const popup = new Popup({
      closeButton: false,
      closeOnClick: true,
      offset: 18,
    });

    const onPointClick: ClickRoute["onClick"] = (feature) => {
      if (feature.geometry.type !== "Point") return;
      const [lon, lat] = feature.geometry.coordinates as [number, number];
      const properties = feature.properties as SearchResultProperties;

      popup
        .setLngLat([lon, lat])
        .setDOMContent(buildResultPopupContent(properties))
        .addTo(map);
    };

    const onClusterClick: ClickRoute["onClick"] = (feature) => {
      if (feature.geometry.type !== "Point") return;
      const center = feature.geometry.coordinates as [number, number];
      const clusterId = feature.properties?.cluster_id;
      const source = map.getSource<GeoJSONSource>(RESULTS_SOURCE_ID);
      if (clusterId == null || !source) return;

      source
        .getClusterExpansionZoom(clusterId)
        .then((zoom) => {
          isProgrammaticMoveRef.current = true;
          map.easeTo({ center, zoom });
        })
        .catch(() => {});
    };

    const pinLayerIds = [RESULTS_ICON_LAYER_ID, SELECTED_ICON_LAYER_ID];
    const unregisterPointClick = registerClickRoutes(
      pinLayerIds,
      0,
      onPointClick,
    );
    const unregisterClusterClick = registerClickRoutes(
      [RESULTS_CLUSTER_LAYER_ID],
      0,
      onClusterClick,
    );
    const resetCursor = setPointerCursorOn(map, [
      ...pinLayerIds,
      RESULTS_CLUSTER_LAYER_ID,
    ]);

    return () => {
      unregisterPointClick();
      unregisterClusterClick();
      resetCursor();
      popup.remove();
    };
  }, [map]);

  // moveend/zoomend → "이 위치에서 검색" 버튼 표시
  // (결과가 0건이어도 새 영역에서 다시 검색할 수 있어야 하므로 totalCount는 조건에 넣지 않는다.
  // zoomend는 이동 없이 줌만 바뀐 경우를 놓치지 않기 위한 보강 리스너 — ref는 moveend에서만
  // 리셋해 flyTo(줌+이동 동반) 도중 프로그램적 이동을 정상적으로 무시한다.)
  useEffect(() => {
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

  const handleSelect = (item: GeoSearchItem, label: string) => {
    setSelectedItemId(item.id);
    const data = toSelectedFeatureCollection(item, label);
    selectedDataRef.current = data;
    map.getSource<GeoJSONSource>(SELECTED_SOURCE_ID)?.setData(data);

    isProgrammaticMoveRef.current = true;
    map.flyTo({ center: [item.lon, item.lat], zoom: 19 });
  };

  const clearSelection = () => {
    setSelectedItemId(undefined);
    selectedDataRef.current = EMPTY_RESULT_COLLECTION;
    map
      .getSource<GeoJSONSource>(SELECTED_SOURCE_ID)
      ?.setData(EMPTY_RESULT_COLLECTION);
  };

  const handleSearchThisArea = () => {
    if (!searchQuery) return;
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
