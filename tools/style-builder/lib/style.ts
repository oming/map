import type { StyleData, SpriteJson, SymbolStyle } from "../../shared/types.js";

export interface NormalizedLabel {
  fontFamily: string;
  size: number;
  color: string;
  haloColor: string;
  haloWidth: number;
  offsetEm: [number, number];
  textAnchor: string;
  textJustify: string;
}

export interface NormalizedEntry {
  clId: string;
  icon: string | null;
  iconScale: number;
  iconOffset: [number, number];
  label: {
    normal: NormalizedLabel | null;
  };
}

export type NormalizedMap = Record<string, NormalizedEntry>;

function toNumber(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

// vworld -> maplibre 값 매핑
//
// 중요: MapLibre의 text-anchor는 수평+수직을 합친 "하나의" 키워드다
// (center/left/right/top/bottom/top-left/top-right/bottom-left/bottom-right).
// vworld는 수직(lblCtrlpntVrticlCode: top/middle)과 수평(lblCtrlpntWidthCode:
// left/center)을 따로 갖고 있으므로, 반드시 두 값을 조합해서
// text-anchor 하나로 만들어야 한다. 수평값을 text-justify에만 반영하고
// text-anchor는 수직값만으로 정하면(예: 항상 "center"), 도시명/역명처럼
// "아이콘은 중앙, 텍스트는 오른쪽으로" 같은 배치가 깨지고 텍스트가
// 아이콘 위에 그대로 겹쳐진다.
function mapTextAnchor(vrticlCode: unknown, widthCode: unknown): string {
  const v =
    vrticlCode === "top" ? "top" : vrticlCode === "bottom" ? "bottom" : null;
  const h =
    widthCode === "left" ? "left" : widthCode === "right" ? "right" : null;

  if (v && h) return `${v}-${h}`;
  if (v) return v;
  if (h) return h;
  return "center";
}

// vworld 원본 코드가 실제로 이렇게 font를 만든다:
//   font: `${lblThikAt==='Y' ? 'bold' : ''} ${lblMg}px ${lblFont || 'Gosanja'}`
// 즉 CSS font shorthand의 [font-weight] [size] [font-family]처럼
// lblFont(폰트 패밀리)와 lblThikAt(굵게 여부)는 서로 독립된 축이다.
// 나눔고딕은 Regular/Bold/ExtraBold 세 굵기 파일이 다 있으므로 조합대로 매핑한다.
// ExtraBold는 이미 최고 굵기라 lblThikAt==='Y'여도 더 굵어질 폰트가 없어 그대로 ExtraBold.
function resolveFontFamily(lblFont: unknown, lblThikAt: unknown): string {
  const bold = lblThikAt === "Y";
  if (lblFont === "Nanum_Gothic_Extra_Bold") {
    return "NanumGothic ExtraBold";
  }
  if (lblFont === "Nanum_Gothic") {
    return bold ? "NanumGothic Bold" : "NanumGothic Regular";
  }
  const family = (lblFont as string) || "NanumGothic";
  return bold ? `${family} Bold` : family;
}

function mapJustify(widthCode: unknown): string {
  if (widthCode === "left") return "left";
  if (widthCode === "right") return "right";
  return "center";
}

function normalizeLabel(
  lbl: Record<string, unknown> | undefined,
): NormalizedLabel | null {
  if (!lbl) return null;
  const size = toNumber(lbl.lblMg, 10);
  const outlined = lbl.lblOutlAt === "Y";
  return {
    fontFamily: resolveFontFamily(lbl.lblFont, lbl.lblThikAt),
    size,
    color: (lbl.lblColor as string) || "#333333",
    haloColor: outlined
      ? (lbl.lblOutlColor as string) || "#ffffff"
      : "rgba(0,0,0,0)",
    haloWidth: outlined ? Math.max(1.4, toNumber(lbl.lblOutlBt, 0)) : 0,
    // 원본은 OpenLayers offsetX/offsetY(px) 기준이라, maplibre text-offset(em)으로
    // 변환하기 위해 size(px)로 나눈다. size가 0이 될 수 없도록 최소 1 보장.
    offsetEm: [
      Number((toNumber(lbl.lblXaxsEprssLc, 0) / Math.max(size, 1)).toFixed(3)),
      Number((toNumber(lbl.lblYaxsEprssLc, 0) / Math.max(size, 1)).toFixed(3)),
    ],
    textAnchor: mapTextAnchor(
      lbl.lblCtrlpntVrticlCode,
      lbl.lblCtrlpntWidthCode,
    ),
    textJustify: mapJustify(lbl.lblCtrlpntWidthCode),
  };
}

export function normalizeAll(
  styleJsonObj: StyleData,
  spriteJson: SpriteJson | null,
): NormalizedMap {
  const result: NormalizedMap = {};
  for (const clId of Object.keys(styleJsonObj)) {
    const entry = styleJsonObj[clId];
    const sym: SymbolStyle = entry.symbolStyle || {};
    const hasIcon = !!sym.symbolImageCn;

    let iconOffset: [number, number] = [0, 0];
    const centerX =
      sym.symbolCenterXLc != null ? toNumber(sym.symbolCenterXLc, 0.5) : 0.5;
    const centerY =
      sym.symbolCenterYLc != null ? toNumber(sym.symbolCenterYLc, 0.5) : 0.5;

    if (hasIcon && spriteJson && spriteJson[clId]) {
      const frame = spriteJson[clId];
      // OpenLayers anchor(0~1, 0.5=center 기준)를 maplibre icon-anchor: "center" +
      // icon-offset(px, anchor 기준 이동량)으로 변환.
      // center(0.5,0.5) 대비 벗어난 만큼을 픽셀로 환산한다.
      iconOffset = [
        Math.round((centerX - 0.5) * frame.width),
        // OpenLayers Y축은 아래로 갈수록 커지고 maplibre icon-offset도 동일(아래가 +)하므로 부호는 그대로 둔다.
        Math.round((centerY - 0.5) * frame.height),
      ];
    }

    result[clId] = {
      clId,
      icon: hasIcon ? clId : null, // sprite 키 = cl_id (이미 만들어둔 sprite와 동일한 규칙 가정)
      iconScale: toNumber(sym.symbolScaleCn, 1),
      iconOffset,
      label: {
        normal: normalizeLabel(
          entry.lblStyle as Record<string, unknown> | undefined,
        ),
      },
    };
  }
  return result;
}

// 브이월드 벡터타일 feature에는 mumm_level/mxmm_level(및
// cl_mumm_level/cl_mxmm_level) 같은 줌 범위 속성이 있지만, 실제로 이
// 값 기준으로 MapLibre의 ["zoom"]과 맞춰봐도 브이월드 원본(OpenLayers)
// 화면과 표시 시점이 맞지 않아 제거함. 대신 MapLibre의 기본 동작
// (symbol layer의 icon/text-allow-overlap 기본값 false로 인한 자동
// 충돌 회피)과 타일 서버가 줌별로 이미 내려주는 feature 밀도에 맡긴다.
// poi_eprss_at(브이월드가 명시적으로 "이 POI는 노출 안 함"이라고
// 표시한 값)만 계속 걸러낸다 — 이건 줌과 무관한 값이라 그대로 둠.
const VISIBILITY_FILTER = ["==", ["get", "poi_eprss_at"], "Y"];

// 동일한 스타일(아이콘+텍스트 스타일)을 공유하는 cl_id들을 묶어서
// layer 개수를 최소화한다. (674개 cl_id -> 실제로는 훨씬 적은 조합)
export function buildLayers(
  normalizedMap: NormalizedMap,
  {
    sourceId,
    sourceLayer,
    mode,
  }: { sourceId: string; sourceLayer: string; mode: string },
) {
  const groups = new Map<
    string,
    { clIds: string[]; n: NormalizedEntry; label: NormalizedLabel }
  >();

  for (const clId of Object.keys(normalizedMap)) {
    const n = normalizedMap[clId];
    const label = (n.label as Record<string, NormalizedLabel | null>)[mode];
    if (!label) continue; // 해당 모드 라벨 정의가 없으면 스킵 (해당 cl_id는 노출 안함)

    const signature = JSON.stringify({
      icon: n.icon,
      iconScale: n.iconScale,
      iconOffset: n.iconOffset,
      label,
    });

    if (!groups.has(signature)) {
      groups.set(signature, { clIds: [], n, label });
    }
    groups.get(signature)!.clIds.push(clId);
  }

  const layers = [];
  let i = 0;
  for (const { clIds, n, label } of groups.values()) {
    i += 1;
    const hasIcon = !!n.icon;
    const layer = {
      id: `poi-${mode}-${i}`,
      type: "symbol",
      source: sourceId,
      "source-layer": sourceLayer,
      filter: [
        "all",
        ["in", ["get", "cl_id"], ["literal", clIds]],
        VISIBILITY_FILTER,
      ],
      layout: {
        "text-field": ["get", "poi_eprss_nm"],
        "text-font": [label.fontFamily],
        "text-size": label.size,
        "text-anchor": label.textAnchor,
        "text-justify": label.textJustify,
        "text-offset": label.offsetEm,
        "text-max-width": 8,
        ...(hasIcon
          ? {
              "icon-image": n.icon,
              "icon-size": n.iconScale,
              "icon-offset": n.iconOffset,
              "icon-allow-overlap": true,
              "text-optional": true,
            }
          : {}),
      },
      paint: {
        "text-color": label.color,
        "text-halo-color": label.haloColor,
        "text-halo-width": label.haloWidth,
      },
    };
    layers.push(layer);
  }
  return layers;
}
