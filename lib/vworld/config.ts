const VWORLD_API_BASE = "https://api.vworld.kr";

export const VWORLD_API_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY ?? "";

/** 이 앱이 배포된 공개 베이스 URL (예: https://map.qwer.dev). 로컬에서는 보통 http://localhost:3000. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

/** V-World 서비스 등록 도메인 — SITE_URL의 호스트명으로 자동 유도(별도 env 불필요) */
export const VWORLD_DOMAIN = SITE_URL ? new URL(SITE_URL).hostname : "";

export const VWORLD_VECTOR_LAYERS = {
  poi: "poi",
  traffic: "traffic",
} as const;
export type VWorldVectorLayer = keyof typeof VWORLD_VECTOR_LAYERS;

export const VWORLD_VECTOR_MIN_ZOOM = 6;
export const VWORLD_VECTOR_MAX_ZOOM = 19;

const VWORLD_TILE_PATH = `${VWORLD_API_BASE}/req/wmts/vector/getTile/`;

/** 벡터타일(.pbf) — {z}/{x}/{y} 순서, 직접 호출 (CORS 문제 없음 확인됨) */
export function getVWorldVectorTileUrl(layer: VWorldVectorLayer): string {
  return `${VWORLD_TILE_PATH}${VWORLD_API_KEY}/${VWORLD_VECTOR_LAYERS[layer]}/{z}/{x}/{y}.pbf`;
}

/** 벡터타일과 격자가 맞는 전용 배경지도(.png) — 직접 호출 */
export function getVWorldVectorBackgroundUrl(layer: "Base" = "Base"): string {
  return `${VWORLD_API_BASE}/req/wmts/vector/${VWORLD_API_KEY}/${layer}/{z}/{x}/{y}.png`;
}

/** setTransformRequest에서 getTile 요청을 reverse:// 프로토콜로 우회시킬 때 쓰는 URL 판별 */
export function isVWorldVectorTileUrl(url: string): boolean {
  return url.startsWith(VWORLD_TILE_PATH);
}

/** V-World 주소/장소 검색(search) API 엔드포인트 */
export function getVWorldSearchUrl(): string {
  return `${VWORLD_API_BASE}/req/search`;
}
