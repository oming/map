import { VWORLD_API_KEY } from "@/lib/vworld/config";

export const BASEMAP_IDS = ["vworld", "satellite", "osm"] as const;
export type BasemapId = (typeof BASEMAP_IDS)[number];

export const DEFAULT_BASEMAP_ID: BasemapId = "vworld";

export interface BasemapDef {
  id: BasemapId;
  /** 스위처에 보이는 이름 */
  label: string;
  /** 팝오버 항목의 보조 설명 */
  description: string;
  styleUrl: string;
}

export const BASEMAPS: Record<BasemapId, BasemapDef> = {
  vworld: {
    id: "vworld",
    label: "브이월드",
    description: "V-World 기본 벡터 지도",
    styleUrl: `/vworld.json?key=${VWORLD_API_KEY}`,
  },
  satellite: {
    id: "satellite",
    label: "위성사진",
    description: "V-World 위성 항공사진 + POI",
    styleUrl: `/vworld.json?key=${VWORLD_API_KEY}&base=satellite`,
  },
  osm: {
    id: "osm",
    label: "OSM",
    description: "OpenStreetMap Shortbread 벡터 지도",
    styleUrl: "/osm.json",
  },
};

/** 해시 값 등 신뢰할 수 없는 입력을 안전하게 BasemapId로 좁힌다. */
export function resolveBasemapId(raw: string | null | undefined): BasemapId {
  return (BASEMAP_IDS as readonly string[]).includes(raw ?? "")
    ? (raw as BasemapId)
    : DEFAULT_BASEMAP_ID;
}
