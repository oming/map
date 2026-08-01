export const VWORLD_API_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY ?? "";

export const VWORLD_VECTOR_LAYERS = {
  poi: "poi",
  traffic: "traffic",
} as const;
export type VWorldVectorLayer = keyof typeof VWORLD_VECTOR_LAYERS;

export const VWORLD_VECTOR_MIN_ZOOM = 6;
export const VWORLD_VECTOR_MAX_ZOOM = 19;

/** 벡터타일(.pbf) — {z}/{x}/{y} 순서, 직접 호출 (CORS 문제 없음 확인됨) */
export function getVWorldVectorTileUrl(layer: VWorldVectorLayer): string {
  return `https://api.vworld.kr/req/wmts/vector/getTile/${VWORLD_API_KEY}/${VWORLD_VECTOR_LAYERS[layer]}/{z}/{x}/{y}.pbf`;
}

/** 벡터타일과 격자가 맞는 전용 배경지도(.png) — 직접 호출 */
export function getVWorldVectorBackgroundUrl(layer: "Base" = "Base"): string {
  return `https://api.vworld.kr/req/wmts/vector/${VWORLD_API_KEY}/${layer}/{z}/{x}/{y}.png`;
}
