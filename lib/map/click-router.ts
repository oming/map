"use client";

import type {
  Map as MaplibreMap,
  MapGeoJSONFeature,
  MapMouseEvent,
} from "maplibre-gl";

/**
 * 맵 레벨 단일 클릭 라우터.
 *
 * queryRenderedFeatures는 layers 배열에 없는 레이어 id가 하나라도 있으면 전체가 []를
 * 반환하므로(MapLibre style.ts), 매 클릭마다 map.getLayer()로 존재하는 레이어만 걸러낸
 * 뒤 단 한 번만 질의한다. 검색 결과 / 데이터 레이어 / 디버그 POI처럼 서로 다른 소유자의
 * 레이어가 같은 지점에서 겹칠 때, 레이어별 위임 핸들러로는 표현할 수 없는 "누가 먼저
 * 반응하는가"를 priority로 결정한다.
 */
export interface ClickRoute {
  layerId: string;
  /** 낮을수록 우선. search=0대, 데이터 레이어=10~, 디버그=1000 권장 */
  priority: number;
  onClick: (feature: MapGeoJSONFeature, event: MapMouseEvent) => void;
}

const routes = new Map<string, ClickRoute>();

/** 라우트 등록. 반환값을 호출하면 해제된다(effect cleanup에서 사용). */
function registerClickRoute(route: ClickRoute): () => void {
  routes.set(route.layerId, route);
  return () => {
    if (routes.get(route.layerId) === route) {
      routes.delete(route.layerId);
    }
  };
}

/** 여러 레이어 id가 같은 클릭 동작을 공유할 때(예: 클러스터+포인트 레이어 세트) 쓰는 헬퍼. */
export function registerClickRoutes(
  layerIds: string[],
  priority: number,
  onClick: ClickRoute["onClick"],
): () => void {
  const unregisters = layerIds.map((layerId) =>
    registerClickRoute({ layerId, priority, onClick }),
  );
  return () => unregisters.forEach((u) => u());
}

/** 앱 전체에서 한 번만 호출한다 (VWorldMap 마운트 시). 반환값은 map.remove() 전 해제용. */
export function attachClickRouter(map: MaplibreMap): () => void {
  const onClick = (e: MapMouseEvent) => {
    const queryableLayerIds = Array.from(routes.keys()).filter((id) =>
      map.getLayer(id),
    );
    if (!queryableLayerIds.length) return;

    const features = map.queryRenderedFeatures(e.point, {
      layers: queryableLayerIds,
    });
    if (!features.length) return;

    let winner: { feature: MapGeoJSONFeature; route: ClickRoute } | null = null;
    for (const feature of features) {
      const route = routes.get(feature.layer.id);
      if (!route) continue;
      if (!winner || route.priority < winner.route.priority) {
        winner = { feature, route };
      }
    }
    if (!winner) return;
    winner.route.onClick(winner.feature, e);
  };

  map.on("click", onClick);
  return () => map.off("click", onClick);
}
