export interface OsmStyleLayer {
  layout?: {
    "text-font"?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * VersaTiles colorful style.json의 최소 형태. maplibre-gl의 StyleSpecification을
 * tools/에서 쓰지 않는 기존 관례(tools/shared/types.ts)를 따라 로컬 타입으로 둔다 —
 * 이 빌더가 실제로 건드리는 필드(layers[].layout["text-font"], 최상위 glyphs/sprite)만
 * 좁게 타이핑하고 나머지는 원본 그대로 통과시킨다.
 */
export interface OsmStyleJson {
  version: number;
  name?: string;
  glyphs?: string;
  sprite?: unknown;
  layers: OsmStyleLayer[];
  [key: string]: unknown;
}
