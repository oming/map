import type { LngLatBounds } from "maplibre-gl";

const MIN_SEARCH_RADIUS_METERS = 1500;

// 뷰포트 bbox와 "뷰포트 중심 기준 최소반경 bbox"의 합집합을 반환한다.
// 뷰포트가 이미 넓으면(줌아웃) 그대로 쓰고, 좁으면(줌인) 최소반경만큼 확장해
// 검색 범위가 지나치게 좁아 0건이 되는 것을 방지한다.
export function viewportBBoxWithMinRadius(
  bounds: LngLatBounds,
  minRadiusMeters: number = MIN_SEARCH_RADIUS_METERS,
): string {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const center = bounds.getCenter();

  const latDelta = minRadiusMeters / 111_320;
  const lonDelta =
    minRadiusMeters / (111_320 * Math.cos((center.lat * Math.PI) / 180));

  const minLng = Math.min(sw.lng, center.lng - lonDelta);
  const minLat = Math.min(sw.lat, center.lat - latDelta);
  const maxLng = Math.max(ne.lng, center.lng + lonDelta);
  const maxLat = Math.max(ne.lat, center.lat + latDelta);

  return `${minLng},${minLat},${maxLng},${maxLat}`;
}
