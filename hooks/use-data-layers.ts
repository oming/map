"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GeoJSONSource,
  Map as MaplibreMap,
  MapGeoJSONFeature,
} from "maplibre-gl";
import type { DataLayerDef } from "@/lib/map/datasets/types";
import { registerClickRoutes, type ClickRoute } from "@/lib/map/click-router";
import { setPointerCursorOn } from "@/lib/map/cursor";
import { addDataLayer, type DataLayerIds } from "@/lib/map/data-layer-setup";
import {
  watchOutsideClick,
  type OutsideClickWatcher,
} from "@/lib/map/outside-click";
import { getDataLayer } from "@/lib/map/datasets";
import { MAX_SPIDERFY_LEAVES, dedupeFeatures } from "@/lib/map/spiderfy";
import { useSpiderfy } from "@/hooks/use-spiderfy";

// 검색(search-*)이 우선순위 0을 쓰므로 데이터 레이어는 그 아래에서 시작한다.
// 배열 순서(레지스트리 순)를 그대로 우선순위로 쓴다 — 나중에 등록될 레이어일수록 후순위.
const CLICK_PRIORITY_BASE = 10;

export interface SelectedFeature {
  layer: DataLayerDef;
  properties: Record<string, unknown>;
  /** 팝업 앵커링용 — Point가 아닌 지오메트리는 없다(현재 모든 데이터 레이어가 Point). */
  coordinates: [number, number] | null;
}

function pointCoordinates(
  feature: MapGeoJSONFeature,
): [number, number] | null {
  return feature.geometry.type === "Point"
    ? (feature.geometry.coordinates as [number, number])
    : null;
}

/**
 * 활성화된 데이터 레이어의 Source/Layer/클릭 라우트/커서를 style.load 이후에 생성하고,
 * 비활성화되거나 언마운트될 때 안전하게 정리한다. 실제 MapLibre 명령은
 * lib/map/data-layer-setup.ts가 담당하고, 여기서는 선택 상태와 상호작용만 다룬다.
 */
export function useDataLayers(
  map: MaplibreMap | null,
  styleReady: boolean,
  activeLayerIds: string[],
) {
  const [selected, setSelected] = useState<SelectedFeature | null>(null);
  const spiderfy = useSpiderfy(map);
  // 클릭 라우트와 바깥 클릭 감지가 서로 다른 effect에 있어 watcher를 직접 넘길 수 없다
  // — ref로 이어준다.
  const outsideClickRef = useRef<OutsideClickWatcher | null>(null);

  const activeLayers = useMemo(
    () => activeLayerIds.map(getDataLayer).filter((layer) => layer != null),
    [activeLayerIds],
  );

  // 마커/spiderfy leg가 아닌 지도 빈 곳을 클릭하면 팝업을 닫는다.
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
    if (!map || !styleReady) return;

    /** 같은 지점을 다시 누르면 접고, 아니면 그 자리에서 펼친다. */
    const toggleSpiderfy = (
      def: DataLayerDef,
      ids: DataLayerIds,
      anchor: [number, number],
      features: MapGeoJSONFeature[],
    ) => {
      const key = `${ids.point}:${anchor.join(",")}`;
      if (spiderfy.getCurrentKey() === key) {
        spiderfy.close();
        return;
      }
      spiderfy.open({
        key,
        anchor,
        color: def.color,
        icon: def.icon,
        sourceId: ids.source,
        originFeatureIds: features
          .map((feature) => feature.id)
          .filter((id): id is string | number => id != null),
        items: features.map((feature) => ({
          properties: (feature.properties ?? {}) as Record<string, unknown>,
          coordinates: (feature.geometry as GeoJSON.Point).coordinates as [
            number,
            number,
          ],
        })),
        onSelect: (item) =>
          setSelected({
            layer: def,
            properties: item.properties,
            coordinates: item.coordinates,
          }),
      });
    };

    const cleanups = activeLayers.map((def, index) => {
      const { ids, teardown } = addDataLayer(map, def);
      const priority = CLICK_PRIORITY_BASE + index;
      const hasCluster = !!def.source.cluster;

      const onPointClick: ClickRoute["onClick"] = (feature, event) => {
        outsideClickRef.current?.markHandled(event);
        // 같은 픽셀에 여러 feature가 겹쳐 렌더된 경우(icon-allow-overlap:true) —
        // 좌표가 완전히 같은 케이스(건물 단위 좌표, clusterMaxZoom 이상 확대 등)라
        // 정확히 이 지점만 질의하면 전부 잡힌다.
        const overlapping = dedupeFeatures(
          map.queryRenderedFeatures(event.point, { layers: [ids.point] }),
        );

        if (
          overlapping.length > 1 &&
          overlapping.length <= MAX_SPIDERFY_LEAVES
        ) {
          const anchor = pointCoordinates(feature);
          if (!anchor) return;
          toggleSpiderfy(def, ids, anchor, overlapping);
          spiderfy.markEventHandled(event);
          return;
        }

        setSelected({
          layer: def,
          properties: feature.properties as Record<string, unknown>,
          coordinates: pointCoordinates(feature),
        });
      };

      const onClusterClick: ClickRoute["onClick"] = (feature, event) => {
        outsideClickRef.current?.markHandled(event);
        // 클러스터 클릭은 항상 확대(zoom-in)만 한다 — spiderfy는 클러스터가 아니라
        // "최대 줌에서도 완전히 같은 좌표에 겹친 포인트"(onPointClick)에서만 쓴다.
        const center = pointCoordinates(feature);
        const clusterId = feature.properties?.cluster_id;
        const source = map.getSource<GeoJSONSource>(ids.source);
        if (!center || clusterId == null || !source) return;

        source
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => map.easeTo({ center, zoom }))
          .catch(() => {});
      };

      const unregisterPoint = registerClickRoutes(
        [ids.point],
        priority,
        onPointClick,
      );
      const unregisterCluster = hasCluster
        ? registerClickRoutes([ids.cluster], priority, onClusterClick)
        : undefined;
      const resetCursor = setPointerCursorOn(
        map,
        hasCluster ? [ids.point, ids.cluster] : [ids.point],
      );

      return () => {
        unregisterPoint();
        unregisterCluster?.();
        resetCursor();
        teardown();
      };
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      // 레이어 구성이 바뀌는 모든 경우(토글 포함)에 무조건 닫는다 — 소스/레이어가
      // 다시 add되면 spiderfy가 참조하던 좌표/속성이 stale해질 수 있고, Marker는
      // DOM이라 소스/레이어 재생성과 무관하게 안 닫으면 유령 마커로 남는다.
      spiderfy.close();
    };
  }, [map, styleReady, activeLayers, spiderfy]);

  return {
    selected,
    clearSelected: () => {
      setSelected(null);
      spiderfy.clearActive();
    },
  };
}
