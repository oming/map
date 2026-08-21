import type { Map as MaplibreMap } from "maplibre-gl";

/** 이 개수를 넘는 클러스터/겹침은 펼치지 않고 기존처럼 확대(zoom)한다. */
export const MAX_SPIDERFY_LEAVES = 12;

const MIN_RADIUS = 44;
// 인접 마커 사이 원둘레 거리(px) — SPIDER_DOT_WIDTH(28) + 여유.
const LEG_SEPARATION = 36;
// 부채꼴 각도 범위(180°)와 중심 방향(6시=정아래). 팝업은 anchor 위쪽에 뜨고 원본
// 핀도 bottom-anchor라 몸통이 anchor 위쪽에 있으므로, 아래쪽 반원으로만 펼쳐서
// 팝업/원본 핀과 겹치지 않게 한다.
const ARC_SPAN = Math.PI;
const ARC_CENTER = Math.PI / 2;

export interface PixelOffset {
  dx: number;
  dy: number;
}

/**
 * count개 항목을 앵커 아래쪽 반원(부채꼴)에 배치할 픽셀 오프셋. 3시 방향에서
 * 시작해 6시(정아래)를 지나 9시 방향까지 — 팝업/원본 핀이 있는 위쪽은 비워둔다.
 */
export function layoutSpiderfyOffsets(count: number): PixelOffset[] {
  if (count <= 0) return [];
  if (count === 1) return [{ dx: 0, dy: 0 }];

  const angleStep = ARC_SPAN / (count - 1);
  const radius = Math.max(MIN_RADIUS, (LEG_SEPARATION * (count - 1)) / ARC_SPAN);
  const startAngle = ARC_CENTER - ARC_SPAN / 2;
  return Array.from({ length: count }, (_, i) => {
    const angle = startAngle + i * angleStep;
    return {
      dx: Math.round(radius * Math.cos(angle)),
      dy: Math.round(radius * Math.sin(angle)),
    };
  });
}

/**
 * 앵커 좌표 주변에 펼쳐질 각 항목의 지리좌표. spiderfy가 열리는 순간 한 번만 계산한다
 * — 패닝/줌이 시작되면 즉시 닫으므로 매 프레임 갱신할 필요가 없다.
 */
export function computeLegLngLats(
  map: MaplibreMap,
  anchor: [number, number],
  count: number,
): [number, number][] {
  const anchorPx = map.project(anchor);
  return layoutSpiderfyOffsets(count).map(({ dx, dy }) => {
    const p = map.unproject([anchorPx.x + dx, anchorPx.y + dy]);
    return [p.lng, p.lat];
  });
}

interface FeatureLike {
  id?: string | number;
  properties?: Record<string, unknown> | null;
  geometry: unknown;
}

/**
 * queryRenderedFeatures/getClusterLeaves 결과에 타일 경계 중복 렌더가 섞여 있을 수 있어
 * 걸러낸다. feature.id가 있으면 그걸로, 없으면 속성+좌표 서명으로 판단한다.
 */
export function dedupeFeatures<T extends FeatureLike>(features: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const feature of features) {
    const key =
      feature.id != null
        ? `id:${feature.id}`
        : `sig:${JSON.stringify(feature.geometry)}|${JSON.stringify(feature.properties)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(feature);
  }
  return result;
}
