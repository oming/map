"use client";

import { useEffect, useMemo, useState } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import type { DataLayerDef } from "@/lib/map/datasets/types";
import { registerClickRoutes, type ClickRoute } from "@/lib/map/click-router";
import { registerPinImage, STANDARD_PIN_WIDTH } from "@/lib/map/pin-image";
import { teardownLayerGroup } from "@/lib/map/layer-lifecycle";
import { getDataLayer } from "@/lib/map/datasets";

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
          },
          "slot-overlay",
        );
      }

      const onPointClick: ClickRoute["onClick"] = (feature) => {
        setSelected({
          layer: def,
          properties: feature.properties as Record<string, unknown>,
        });
      };
      const onClusterClick: ClickRoute["onClick"] = (feature) => {
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
    };
  }, [map, styleReady, activeLayers]);

  return { selected, clearSelected: () => setSelected(null) };
}
