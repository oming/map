"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MaplibreMap, MapMouseEvent } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import type { DataLayerDef } from "@/lib/map/datasets/types";
import { registerClickRoutes, type ClickRoute } from "@/lib/map/click-router";
import { registerPinImage, STANDARD_PIN_WIDTH } from "@/lib/map/pin-image";
import { teardownLayerGroup } from "@/lib/map/layer-lifecycle";
import { getDataLayer } from "@/lib/map/datasets";
import { MAX_SPIDERFY_LEAVES, dedupeFeatures } from "@/lib/map/spiderfy";
import { useSpiderfy } from "@/hooks/use-spiderfy";

// 검색(search-*)이 우선순위 0을 쓰므로 데이터 레이어는 그 아래에서 시작한다.
// 배열 순서(레지스트리 순)를 그대로 우선순위로 쓴다 — 나중에 등록될 레이어일수록 후순위.
const CLICK_PRIORITY_BASE = 10;

function layerIds(def: DataLayerDef) {
  return {
    source: `dl-${def.id}`,
    point: `dl-${def.id}-point`,
    cluster: `dl-${def.id}-cluster`,
    clusterCount: `dl-${def.id}-cluster-count`,
    image: `dl-pin-${def.id}`,
  };
}

export interface SelectedFeature {
  layer: DataLayerDef;
  properties: Record<string, unknown>;
  /** 팝업 앵커링용 — Point가 아닌 지오메트리는 없다(현재 모든 데이터 레이어가 Point). */
  coordinates: [number, number] | null;
}

/**
 * 활성화된 데이터 레이어의 Source/Layer/클릭 라우트/커서를 style.load 이후에 생성하고,
 * 비활성화되거나 언마운트될 때 레이어 → 소스 → 이미지 순서로 안전하게 정리한다.
 * geojson 소스만 구현되어 있다 — pmtiles/api는 SourceSpec 타입에 슬롯만 있고 아직 미구현.
 */
export function useDataLayers(
  map: MaplibreMap | null,
  styleReady: boolean,
  activeLayerIds: string[],
) {
  const [selected, setSelected] = useState<SelectedFeature | null>(null);
  const spiderfy = useSpiderfy(map);
  // use-spiderfy.ts의 바깥 클릭 감지와 같은 관용구 — 포인트/클러스터 클릭이 이
  // ref에 이벤트를 표시해두면, 같은 tick 뒤에 도는 바깥 클릭 리스너가 "이미 처리된
  // 클릭"임을 알고 방금 연 팝업을 바로 닫아버리지 않는다.
  const selectedHandledEventRef = useRef<MapMouseEvent | null>(null);

  const activeLayers = useMemo(
    () => activeLayerIds.map(getDataLayer).filter((l) => l != null),
    [activeLayerIds],
  );

  useEffect(() => {
    if (!map || !styleReady) return;

    const cleanups: (() => void)[] = [];

    activeLayers.forEach((def, index) => {
      if (def.source.kind !== "geojson") {
        console.warn(
          `[data-layers] "${def.source.kind}" 소스는 아직 지원하지 않습니다: ${def.id}`,
        );
        return;
      }
      const source = def.source;
      const ids = layerIds(def);
      const cluster = source.cluster;

      if (!map.getSource(ids.source)) {
        map.addSource(ids.source, {
          type: "geojson",
          data: source.url,
          cluster: !!cluster,
          clusterRadius: cluster?.radius ?? 50,
          clusterMaxZoom: cluster?.maxZoom ?? 17,
          // spiderfy가 펼쳐진 동안 원본 핀을 feature-state로 숨기려면 안정적인
          // 숫자 id가 필요하다(GeoJSON feature 자체엔 id가 없다).
          generateId: true,
        });
      }

      registerPinImage(map, ids.image, {
        color: def.color,
        cssWidth: STANDARD_PIN_WIDTH,
        icon: def.icon,
      });

      if (cluster && !map.getLayer(ids.cluster)) {
        map.addLayer(
          {
            id: ids.cluster,
            type: "circle",
            source: ids.source,
            filter: ["has", "point_count"],
            paint: {
              "circle-color": def.color,
              "circle-radius": [
                "step",
                ["get", "point_count"],
                14,
                5,
                18,
                15,
                22,
              ],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          },
          "slot-overlay",
        );
        map.addLayer(
          {
            id: ids.clusterCount,
            type: "symbol",
            source: ids.source,
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-font": ["NanumGothic Bold"],
              "text-size": 11,
            },
            paint: { "text-color": "#ffffff" },
          },
          "slot-overlay",
        );
      }

      if (!map.getLayer(ids.point)) {
        map.addLayer(
          {
            id: ids.point,
            type: "symbol",
            source: ids.source,
            minzoom: def.minzoom,
            filter: cluster ? ["!", ["has", "point_count"]] : undefined,
            layout: {
              "icon-image": ids.image,
              "icon-anchor": "bottom",
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
            },
            paint: {
              // spiderfy로 펼쳐진 동안 원본 핀을 숨긴다 — use-spiderfy.ts의
              // open()/close()가 feature-state를 설정/해제한다.
              "icon-opacity": [
                "case",
                ["boolean", ["feature-state", "spiderfied"], false],
                0,
                1,
              ],
            },
          },
          "slot-overlay",
        );
      }

      const onPointClick: ClickRoute["onClick"] = (feature, event) => {
        selectedHandledEventRef.current = event;
        // 같은 픽셀에 여러 feature가 겹쳐 렌더된 경우(icon-allow-overlap:true) —
        // 좌표가 완전히 같은 케이스(건물 단위 좌표, clusterMaxZoom 이상 확대 등)라
        // 정확히 이 지점만 질의하면 전부 잡힌다.
        const stacked = map.queryRenderedFeatures(event.point, {
          layers: [ids.point],
        });
        const distinct = dedupeFeatures(stacked);

        if (distinct.length > 1 && distinct.length <= MAX_SPIDERFY_LEAVES) {
          const anchor =
            feature.geometry.type === "Point"
              ? (feature.geometry.coordinates as [number, number])
              : null;
          if (!anchor) return;
          const key = `${ids.point}:${anchor.join(",")}`;
          if (spiderfy.getCurrentKey() === key) {
            spiderfy.close();
          } else {
            spiderfy.open({
              key,
              anchor,
              color: def.color,
              icon: def.icon,
              sourceId: ids.source,
              originFeatureIds: distinct
                .map((f) => f.id)
                .filter((id): id is string | number => id != null),
              items: distinct.map((f) => ({
                properties: (f.properties ?? {}) as Record<string, unknown>,
                coordinates: (f.geometry as GeoJSON.Point)
                  .coordinates as [number, number],
              })),
              onSelect: (item) =>
                setSelected({
                  layer: def,
                  properties: item.properties,
                  coordinates: item.coordinates,
                }),
            });
          }
          spiderfy.markEventHandled(event);
          return;
        }

        setSelected({
          layer: def,
          properties: feature.properties as Record<string, unknown>,
          coordinates:
            feature.geometry.type === "Point"
              ? (feature.geometry.coordinates as [number, number])
              : null,
        });
      };
      const onClusterClick: ClickRoute["onClick"] = (feature, event) => {
        selectedHandledEventRef.current = event;
        // 클러스터 클릭은 항상 확대(zoom-in)만 한다 — spiderfy는 클러스터가 아니라
        // "최대 줌에서도 완전히 같은 좌표에 겹친 포인트"(onPointClick)에서만 쓴다.
        if (feature.geometry.type !== "Point") return;
        const center = feature.geometry.coordinates as [number, number];
        const clusterId = feature.properties?.cluster_id;
        const geojsonSource = map.getSource(ids.source) as
          | maplibregl.GeoJSONSource
          | undefined;
        if (clusterId == null || !geojsonSource) return;

        geojsonSource
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => map.easeTo({ center, zoom }))
          .catch(() => {});
      };
      const onEnter = () => (map.getCanvas().style.cursor = "pointer");
      const onLeave = () => (map.getCanvas().style.cursor = "");

      const unregisterPoint = registerClickRoutes(
        [ids.point],
        CLICK_PRIORITY_BASE + index,
        onPointClick,
      );
      const unregisterCluster = cluster
        ? registerClickRoutes(
            [ids.cluster],
            CLICK_PRIORITY_BASE + index,
            onClusterClick,
          )
        : undefined;

      map.on("mouseenter", ids.point, onEnter);
      map.on("mouseleave", ids.point, onLeave);
      if (cluster) {
        map.on("mouseenter", ids.cluster, onEnter);
        map.on("mouseleave", ids.cluster, onLeave);
      }

      cleanups.push(() => {
        unregisterPoint();
        unregisterCluster?.();
        map.off("mouseenter", ids.point, onEnter);
        map.off("mouseleave", ids.point, onLeave);
        if (cluster) {
          map.off("mouseenter", ids.cluster, onEnter);
          map.off("mouseleave", ids.cluster, onLeave);
        }
        teardownLayerGroup(map, {
          layerIds: [ids.point, ids.cluster, ids.clusterCount],
          sourceIds: [ids.source],
          imageIds: [ids.image],
        });
      });
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      // 레이어 구성이 바뀌는 모든 경우(토글 포함)에 무조건 닫는다 — 소스/레이어가
      // 다시 add되면 spiderfy가 참조하던 좌표/속성이 stale해질 수 있고, Marker는
      // DOM이라 소스/레이어 재생성과 무관하게 안 닫으면 유령 마커로 남는다.
      spiderfy.close();
    };
  }, [map, styleReady, activeLayers, spiderfy]);

  // 마커/spiderfy leg가 아닌 지도 빈 곳을 클릭하면 팝업을 닫는다. use-spiderfy.ts의
  // 바깥 클릭 감지와 동일한 관용구(setTimeout(0) + 같은 tick 이벤트 객체 참조 비교) —
  // click-router.ts가 onPointClick/onClusterClick을 같은 tick에 먼저 실행해
  // selectedHandledEventRef를 채워두므로, 방금 그 클릭으로 새로 연 팝업은 안 닫힌다.
  useEffect(() => {
    if (!map) return;
    const onAnyClick = (e: MapMouseEvent) => {
      setTimeout(() => {
        if (selectedHandledEventRef.current === e) return;
        setSelected(null);
      }, 0);
    };
    map.on("click", onAnyClick);
    return () => {
      map.off("click", onAnyClick);
    };
  }, [map]);

  return {
    selected,
    clearSelected: () => {
      setSelected(null);
      spiderfy.clearActive();
    },
  };
}
