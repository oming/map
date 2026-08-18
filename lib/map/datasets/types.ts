import type { DetailFieldsSchema } from "@/components/map/data/detail-fields";

export interface ClusterSpec {
  radius?: number;
  maxZoom?: number;
}

export type SourceSpec =
  | { kind: "geojson"; url: string; cluster?: ClusterSpec }
  // 확장 슬롯 — Phase 4 이후. 엔진에서 아직 구현하지 않았다.
  | { kind: "pmtiles"; url: string; sourceLayer: string }
  | { kind: "api"; endpoint: string; bbox: boolean };

export interface DataLayerAttribution {
  name: string;
  url?: string;
  license?: string;
  updatedAt?: string;
}

export interface DataLayerDef {
  /** [a-z0-9-] 만 — URL 해시(layers=)에 그대로 인코딩되므로 다른 문자는 조용히 깨진다. */
  id: string;
  label: string;
  color: string;
  minzoom?: number;
  source: SourceSpec;
  detail: DetailFieldsSchema;
  attribution: DataLayerAttribution;
}
