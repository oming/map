import { SITE_URL } from "@/lib/site";

const VWORLD_API_BASE = "https://api.vworld.kr";

export const VWORLD_API_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY ?? "";

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

export const VWORLD_RASTER_MIN_ZOOM = 6;
export const VWORLD_RASTER_MAX_ZOOM = 19; // z20부터는 V-World가 XML 에러를 준다(실측 확인)

/**
 * 일반 래스터 WMTS — 벡터 정렬 배경(getVWorldVectorBackgroundUrl)과는 **다른 엔드포인트**다.
 * 경로 순서가 {z}/{y}/{x}(행/열)이고, Satellite는 .jpeg / Hybrid는 .png만 응답한다(실측 확인).
 */
export function getVWorldRasterTileUrl(layer: "Satellite" | "Hybrid"): string {
  const ext = layer === "Satellite" ? "jpeg" : "png";
  return `${VWORLD_API_BASE}/req/wmts/1.0.0/${VWORLD_API_KEY}/${layer}/{z}/{y}/{x}.${ext}`;
}

/** setTransformRequest에서 getTile 요청을 reverse:// 프로토콜로 우회시킬 때 쓰는 URL 판별 */
export function isVWorldVectorTileUrl(url: string): boolean {
  return url.startsWith(VWORLD_TILE_PATH);
}

/** V-World 주소/장소 검색(search) API 엔드포인트 */
export function getVWorldSearchUrl(): string {
  return `${VWORLD_API_BASE}/req/search`;
}
