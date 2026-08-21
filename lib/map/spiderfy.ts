import type { Map as MaplibreMap } from "maplibre-gl";

/** 이 개수를 넘는 클러스터/겹침은 펼치지 않고 기존처럼 확대(zoom)한다. */
export const MAX_SPIDERFY_LEAVES = 12;

// 팝업 카드(약 230x100px)가 leg 하나를 클릭하면 그 leg 근처에 뜨므로, 반지름이
// 너무 작으면 인접 leg들을 가려버린다 — 원본 핀 겹침 걱정은 없어졌지만(아래 참고)
// 팝업 자체와의 충돌은 남아 있어 반지름을 넉넉히 잡는다.
const MIN_RADIUS = 70;
// 인접 마커 사이 원둘레 거리(px) — SPIDER_DOT_WIDTH(28)보다 훨씬 넉넉하게 잡아
// count가 많을 때도 반지름이 충분히 커지게 한다.
const LEG_SEPARATION = 56;
// 12시 방향(정위)에서 시작해 시계방향으로 전체 원을 균등하게 채운다. 원본 핀은
// 펼쳐지는 동안 feature-state로 숨기므로(hooks/use-data-layers.ts) 원본 핀과의
// 겹침을 피하려고 특정 방향을 비워둘 필요는 없다.
const START_ANGLE = -Math.PI / 2;

export interface PixelOffset {
  dx: number;
  dy: number;
}

/**
 * count개 항목을 앵커를 중심으로 한 원 둘레에 균등 배치할 픽셀 오프셋. 12시
 * 방향에서 시작해 시계방향으로 돈다.
 */
export function layoutSpiderfyOffsets(count: number): PixelOffset[] {
  if (count <= 0) return [];
  if (count === 1) return [{ dx: 0, dy: 0 }];

  const angleStep = (2 * Math.PI) / count;
  const radius = Math.max(MIN_RADIUS, (LEG_SEPARATION * count) / (2 * Math.PI));
  return Array.from({ length: count }, (_, i) => {
    const angle = START_ANGLE + i * angleStep;
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
