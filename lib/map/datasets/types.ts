import type { DetailFieldsSchema } from "@/components/map/data/detail-fields";
import type { PinIcon } from "@/lib/map/pin-image";

export interface ClusterSpec {
  radius?: number;
  maxZoom?: number;
}

/** 모든 데이터셋은 tools/data-builder가 만든 정적 GeoJSON 파일을 소스로 쓴다. */
export interface SourceSpec {
  kind: "geojson";
  url: string;
  cluster?: ClusterSpec;
}

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
  /** 마커 안에 그릴 lucide 아이콘. 생략하면 단색 핀만 그린다. */
  icon?: PinIcon;
  minzoom?: number;
  source: SourceSpec;
  detail: DetailFieldsSchema;
  attribution: DataLayerAttribution;
}
