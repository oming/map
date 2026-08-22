import { VWORLD_API_KEY } from "@/lib/vworld/config";

export const BASEMAP_IDS = ["vworld", "satellite", "osm"] as const;
export type BasemapId = (typeof BASEMAP_IDS)[number];

export const DEFAULT_BASEMAP_ID: BasemapId = "vworld";

export interface BasemapDef {
  id: BasemapId;
  /** 스위처에 보이는 이름 */
  label: string;
  /** 팝오버 항목의 보조 설명 — 그리드에는 안 보이고 aria-label/title로만 쓰인다. */
  description: string;
  /**
   * 스위처 그리드에 깔리는 미리보기 이미지(144x144).
   * 세 장 모두 여의도 일대를 같은 좌표·줌(14/37.5285/126.9245)에서 캡처한 것이라
   * 나란히 놓으면 배경지도 차이만 드러난다. OSM은 벡터 타일이라 원본 래스터 타일이
   * 없으므로, 캡처가 유일한 방법이다. 스타일을 바꾸면 세 장을 함께 다시 캡처한다.
   */
  thumbnail: string;
  styleUrl: string;
}

export const BASEMAPS: Record<BasemapId, BasemapDef> = {
  vworld: {
    id: "vworld",
    label: "브이월드",
    description: "V-World 기본 벡터 지도",
    thumbnail: "/basemap/vworld.png",
    styleUrl: `/vworld.json?key=${VWORLD_API_KEY}`,
  },
  satellite: {
    id: "satellite",
    label: "위성사진",
    description: "V-World 위성 항공사진 + POI",
    thumbnail: "/basemap/satellite.png",
    styleUrl: `/vworld.json?key=${VWORLD_API_KEY}&base=satellite`,
  },
  osm: {
    id: "osm",
    label: "OSM",
    description: "OpenStreetMap Shortbread 벡터 지도 + 브이월드 POI",
    thumbnail: "/basemap/osm.png",
    styleUrl: "/osm.json",
  },
};

/** 해시 값 등 신뢰할 수 없는 입력을 안전하게 BasemapId로 좁힌다. */
export function resolveBasemapId(raw: string | null | undefined): BasemapId {
  return (BASEMAP_IDS as readonly string[]).includes(raw ?? "")
    ? (raw as BasemapId)
    : DEFAULT_BASEMAP_ID;
}
