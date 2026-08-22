import type { LayerSpecification } from "maplibre-gl";

/**
 * 데이터 레이어를 결정적인 z-order로 addLayer(spec, SLOT_OVERLAY_LAYER_ID)하기 위한 앵커.
 * 소스 없는 투명 background라 렌더 비용 0이고, 순서 재조정(moveLayer)이 필요 없다.
 * 모든 베이스맵 스타일(app/vworld.json, app/osm.json)이 이 레이어를 반드시 내려줘야
 * lib/map/data-layer-setup.ts의 addLayer가 "slot-overlay" 앵커를 찾지 못해 throw하지 않는다.
 */
export const SLOT_OVERLAY_LAYER_ID = "slot-overlay";

export const SLOT_OVERLAY_LAYER: LayerSpecification = {
  id: SLOT_OVERLAY_LAYER_ID,
  type: "background",
  layout: { visibility: "none" },
};
