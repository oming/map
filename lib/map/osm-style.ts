import type { StyleSpecification } from "maplibre-gl";
import osmStyleRaw from "@/data/osm-style.json";

/**
 * data/osm-style.json은 tools/osm-style-builder가 VersaTiles colorful 스타일을
 * 옮겨둔 것이라 MapLibre의 StyleSpecification 판별 유니온으로 추론되지 않는다
 * (JSON import는 type/layout 같은 판별 필드까지 전부 넓은 string으로 읽힌다).
 * 단언은 이 파일 한 곳에서만 하고, 스타일 생성(app/osm.json)은 타입이 붙은 값을 쓴다.
 */
export const OSM_STYLE = osmStyleRaw as unknown as Omit<
  StyleSpecification,
  "glyphs" | "sprite"
>;
