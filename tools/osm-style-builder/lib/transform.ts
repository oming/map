import type { OsmStyleJson } from "./types.js";

/**
 * VersaTiles colorful 스타일이 쓰는 폰트(noto_sans_*) → 이 프로젝트가 이미 서빙 중인
 * 나눔고딕(public/font/)으로의 매핑. VersaTiles 스타일 실측 결과 noto_sans_regular /
 * noto_sans_bold 두 종류만 쓰인다 — 매핑에 없는 값이 나오면 폴백하고 build.ts가 경고한다.
 */
const FONT_MAP: Record<string, string> = {
  noto_sans_regular: "NanumGothic Regular",
  noto_sans_bold: "NanumGothic Bold",
};
const FALLBACK_FONT = "NanumGothic Regular";

export interface TransformResult {
  style: OsmStyleJson;
  /** FONT_MAP에 없어서 FALLBACK_FONT로 대체된 원본 폰트 이름들(중복 제거) */
  unmappedFonts: string[];
}

/**
 * VersaTiles colorful 스타일을 이 앱이 쓸 수 있게 다듬는다.
 * - text-font: noto_sans_* → NanumGothic *
 * - 최상위 glyphs/sprite 키 제거 — 런타임 라우트(app/osm.json)가 SITE_URL 기준으로 주입한다
 * - sources/tiles URL, icon-image(basics:* 참조)는 그대로 둔다
 *
 * POI(학교/카페 등 실제 명칭·아이콘)는 이 스타일에 원래 없다 — VersaTiles colorful은
 * 의도적으로 "깔끔한" 배경 지도만 제공하고, 있는 POI 레이어도 opacity가 낮게 눌려 있어
 * 거의 안 보인다. 이걸 보정하는 대신 app/osm.json/route.ts가 V-World의 POI_LAYERS를
 * 그대로 얹는다(브이월드 벡터타일 + 스프라이트 재사용) — 그게 이 앱이 이미 갖고 있는
 * 풍부한 POI 데이터셋이기 때문.
 */
export function transformStyle(raw: OsmStyleJson): TransformResult {
  const unmapped = new Set<string>();

  const layers = raw.layers.map((layer) => {
    const textFont = layer.layout?.["text-font"];
    if (!Array.isArray(textFont)) return layer;

    const mappedFont = textFont.map((font) => {
      const mapped = FONT_MAP[font];
      if (!mapped) unmapped.add(font);
      return mapped ?? FALLBACK_FONT;
    });

    return {
      ...layer,
      layout: { ...layer.layout, "text-font": mappedFont },
    };
  });

  const style: OsmStyleJson = { ...raw, layers };
  delete style.glyphs;
  delete style.sprite;

  return {
    style,
    unmappedFonts: [...unmapped],
  };
}
