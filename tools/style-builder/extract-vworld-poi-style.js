#!/usr/bin/env node
/**
 * extract-vworld-poi-style.js
 *
 * VWorld의 OpenLayers용 POI 스타일 정의 파일(예: vectorStylePoi.js 안의
 * `function StyleJson(){ return {...} }`)을 파싱하여
 *   1) cl_id 별로 정규화된 스타일 JSON (poi-style-by-clid.json)
 *   2) 그대로 MapLibre style.layers 배열에 넣을 수 있는
 *      symbol 레이어 목록 (poi-layers.json)
 * 을 생성합니다.
 *
 * 핵심 아이디어:
 *  - 기존 코드처럼 addProtocol로 PBF를 받아 매 타일/피처마다 런타임에
 *    cl_id -> 스타일을 resolve해서 properties를 주입할 필요가 없습니다.
 *  - cl_id는 벡터타일 안에 이미 존재하는 값이므로, cl_id 값 자체를 filter
 *    조건으로 사용해서 "동일 스타일을 공유하는 cl_id 묶음"별로 layer를
 *    미리 만들어두면, layout/paint에는 ["get", ...] 표현식이 전혀 필요
 *    없고 전부 리터럴 값으로 굳힐 수 있습니다.
 *  - 줌레벨 노출은 zoom 필터 없이 MapLibre 기본 동작(overlap 회피)과
 *    타일 서버가 이미 내려주는 feature 밀도에 맡깁니다.
 *  - 결과적으로 addProtocol 없이 원본 vworldPoi vector source를 그대로
 *    쓰고, layers만 이 스크립트가 만든 JSON으로 교체하면 됩니다.
 *
 * 사용법:
 *   node extract-vworld-poi-style.js <vworld-style-js-path> [sprite.json path] [output dir]
 *
 * 예)
 *   node extract-vworld-poi-style.js ./vectorStylePoi.js ./sprite_result/sprite.json ./out
 *
 * sprite.json을 주면, symbolCenterXLc/YLc (OpenLayers의 임의 소수점 anchor)를
 * MapLibre의 icon-offset(px)으로 변환합니다. MapLibre는 OpenLayers처럼
 * 임의 소수점 anchor를 지원하지 않고 icon-anchor는 키워드(center 등)만
 * 가능하기 때문입니다. sprite.json이 없으면 전부 icon-anchor: "center"로
 * 두고 icon-offset은 0으로 둡니다(대부분의 cl_id가 실제로 0.5,0.5라 큰
 * 차이는 없지만 일부 아이콘은 어긋날 수 있습니다).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function loadStyleJsonSource(vworldJsPath) {
  const content = fs.readFileSync(vworldJsPath, "utf8");

  const fnIdx = content.indexOf("function StyleJson");
  if (fnIdx === -1) {
    throw new Error(
      "파일에서 'function StyleJson'을 찾지 못했습니다. VWorld 스타일 js 파일이 맞는지 확인하세요.",
    );
  }
  const returnIdx = content.indexOf("return", fnIdx);
  const braceStart = content.indexOf("{", returnIdx);
  if (braceStart === -1) {
    throw new Error(
      "StyleJson() 함수의 return 객체 시작 '{'를 찾지 못했습니다.",
    );
  }

  // StyleJson() 함수 바로 다음에는 항상 `}\r\n}` 형태로
  // (return 객체 닫는 중괄호 + 함수 닫는 중괄호)가 온다고 가정하고,
  // 그 지점을 객체의 끝으로 잡는다. (base64 이미지 문자열 안에는
  // 이 패턴이 나타나지 않으므로 안전하다.)
  const closeMarker = "}\r\n}";
  let braceEnd = content.indexOf(closeMarker, braceStart);
  if (braceEnd === -1) {
    // 혹시 개행이 \n뿐인 파일이면 대비
    braceEnd = content.indexOf("}\n}", braceStart);
    if (braceEnd === -1) {
      throw new Error(
        "StyleJson() 객체의 끝을 찾지 못했습니다. closeMarker 패턴을 확인하세요.",
      );
    }
  }

  const jsonStr = content.substring(braceStart, braceEnd + 1);
  return JSON.parse(jsonStr);
}

function toNumber(v, fallback = 0) {
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
function mapTextAnchor(vrticlCode, widthCode) {
  const v =
    vrticlCode === "top" ? "top" : vrticlCode === "bottom" ? "bottom" : null; // middle -> null(수직 접두어 없음)
  const h =
    widthCode === "left" ? "left" : widthCode === "right" ? "right" : null; // center -> null(수평 접두어 없음)

  if (v && h) return `${v}-${h}`; // 예: top-left
  if (v) return v; // 예: top
  if (h) return h; // 예: left
  return "center"; // 수직 middle + 수평 center
}

// vworld 원본 코드가 실제로 이렇게 font를 만든다:
//   font: `${lblThikAt==='Y' ? 'bold' : ''} ${lblMg}px ${lblFont || 'Gosanja'}`
// 즉 CSS font shorthand의 [font-weight] [size] [font-family]처럼
// lblFont(폰트 패밀리)와 lblThikAt(굵게 여부)는 서로 독립된 축이다.
// lblFont 값 자체가 "이미 굵은 폰트냐 아니냐"를 뜻하는 게 아니라,
// 거기에 lblThikAt이 bold를 얹거나 안 얹거나 하는 방식.
// 나눔고딕은 Regular/Bold/ExtraBold 세 굵기 파일이 다 있으므로 조합대로 매핑한다.
// ExtraBold는 이미 최고 굵기라 lblThikAt==='Y'여도 더 굵어질 폰트가 없어 그대로 ExtraBold.
function resolveFontFamily(lblFont, lblThikAt) {
  const bold = lblThikAt === "Y";
  if (lblFont === "Nanum_Gothic_Extra_Bold") {
    return "NanumGothic ExtraBold";
  }
  if (lblFont === "Nanum_Gothic") {
    return bold ? "NanumGothic Bold" : "NanumGothic Regular";
  }
  // lblFont가 없거나(원본 기본값 'Gosanja') 다른 값이면 원본 fallback을 그대로 따르되
  // bold 축은 여전히 독립적으로 적용한다.
  const family = lblFont || "NanumGothic";
  return bold ? `${family} Bold` : family;
}

function mapJustify(widthCode) {
  // maplibre text-justify: "auto" | "left" | "center" | "right"
  if (widthCode === "left") return "left";
  if (widthCode === "right") return "right";
  return "center";
}

function normalizeLabel(lbl) {
  if (!lbl) return null;
  const size = toNumber(lbl.lblMg, 10);
  const outlined = lbl.lblOutlAt === "Y";
  return {
    fontFamily: resolveFontFamily(lbl.lblFont, lbl.lblThikAt),
    size,
    color: lbl.lblColor || "#333333",
    haloColor: outlined ? lbl.lblOutlColor || "#ffffff" : "rgba(0,0,0,0)",
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

function loadSpriteJson(spriteJsonPath) {
  if (!spriteJsonPath) return null;
  if (!fs.existsSync(spriteJsonPath)) {
    console.warn(
      `[warn] sprite json을 찾을 수 없습니다: ${spriteJsonPath} (icon-offset 계산 생략)`,
    );
    return null;
  }
  return JSON.parse(fs.readFileSync(spriteJsonPath, "utf8"));
}

function normalizeAll(styleJsonObj, spriteJson) {
  const result = {};
  for (const clId of Object.keys(styleJsonObj)) {
    const entry = styleJsonObj[clId];
    const sym = entry.symbolStyle || {};
    const hasIcon = !!sym.symbolImageCn;

    let iconOffset = [0, 0];
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
        normal: normalizeLabel(entry.lblStyle),
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
function buildLayers(normalizedMap, { sourceId, sourceLayer, mode }) {
  const groups = new Map(); // signature -> { clIds: [], style }

  for (const clId of Object.keys(normalizedMap)) {
    const n = normalizedMap[clId];
    const label = n.label[mode];
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
    groups.get(signature).clIds.push(clId);
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

function main() {
  const [, , vworldJsPathArg, spriteJsonPathArg, outDirArg] = process.argv;
  if (!vworldJsPathArg) {
    console.error(
      "사용법: node extract-vworld-poi-style.js <vworld-style-js-path> [sprite.json path] [output dir]",
    );
    process.exit(1);
  }

  const outDir = outDirArg || "./out";
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`[1/4] VWorld 스타일 파일 파싱 중: ${vworldJsPathArg}`);
  const styleJsonObj = loadStyleJsonSource(vworldJsPathArg);
  console.log(`      -> cl_id ${Object.keys(styleJsonObj).length}개 발견`);

  console.log(
    `[2/4] sprite.json 로드 중: ${spriteJsonPathArg || "(없음, 기본 anchor 사용)"}`,
  );
  const spriteJson = loadSpriteJson(spriteJsonPathArg);

  console.log("[3/4] cl_id별 스타일 정규화 중...");
  const normalized = normalizeAll(styleJsonObj, spriteJson);

  const normalizedOutPath = path.join(outDir, "poi-style-by-clid.json");
  fs.writeFileSync(normalizedOutPath, JSON.stringify(normalized, null, 2));
  console.log(`      -> ${normalizedOutPath} 저장 (참고/디버깅용 원본 매핑)`);

  console.log(
    "[4/4] MapLibre symbol layer 생성 중 (zoom 필터 없이, poi_eprss_at만 체크)...",
  );
  const layers = buildLayers(normalized, {
    sourceId: "vworldPoi",
    sourceLayer: "poi",
    mode: "normal",
  });

  const layersOutPath = path.join(outDir, "poi-layers.json");
  fs.writeFileSync(layersOutPath, JSON.stringify(layers, null, 2));

  console.log(`      -> ${layersOutPath} 저장`);
  console.log(
    `      -> layer 수: ${layers.length} (원본 cl_id 수: ${Object.keys(styleJsonObj).length})`,
  );
}

main();
