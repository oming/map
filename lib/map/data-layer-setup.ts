"use client";

import type { Map as MaplibreMap } from "maplibre-gl";
import type { DataLayerDef } from "@/lib/map/datasets/types";
import { teardownLayerGroup } from "@/lib/map/layer-lifecycle";
import { registerPinImage, STANDARD_PIN_WIDTH } from "@/lib/map/pin-image";

export interface DataLayerIds {
  source: string;
  point: string;
  cluster: string;
  clusterCount: string;
  image: string;
}

export function dataLayerIds(def: DataLayerDef): DataLayerIds {
  return {
    source: `dl-${def.id}`,
    point: `dl-${def.id}-point`,
    cluster: `dl-${def.id}-cluster`,
    clusterCount: `dl-${def.id}-cluster-count`,
    image: `dl-pin-${def.id}`,
  };
}

/**
 * 데이터셋 정의를 MapLibre 소스/핀 이미지/레이어로 만든다. 스타일이 준비된 뒤
 * (style.load 이후)에만 호출해야 한다.
 *
 * 반환된 teardown()은 레이어 → 소스 → 이미지 순서를 지켜 정리한다 — 순서를 바꾸면
 * 스타일 전환 중에 throw할 수 있다(lib/map/layer-lifecycle.ts).
 */
export function addDataLayer(
  map: MaplibreMap,
  def: DataLayerDef,
): { ids: DataLayerIds; teardown: () => void } {
  const ids = dataLayerIds(def);
  const cluster = def.source.cluster;

  if (!map.getSource(ids.source)) {
    map.addSource(ids.source, {
      type: "geojson",
      data: def.source.url,
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
          "circle-radius": ["step", ["get", "point_count"], 14, 5, 18, 15, 22],
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
          // spiderfy로 펼쳐진 동안 원본 핀을 숨긴다 — hooks/use-spiderfy.ts의
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

  return {
    ids,
    teardown: () =>
      teardownLayerGroup(map, {
        layerIds: [ids.point, ids.cluster, ids.clusterCount],
        sourceIds: [ids.source],
        imageIds: [ids.image],
      }),
  };
}
