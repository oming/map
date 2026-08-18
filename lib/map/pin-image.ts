"use client";

import type { Map as MaplibreMap } from "maplibre-gl";

// 검색 결과 마커에서 쓰던 것과 동일한 물방울 핀 SVG path (viewBox 384x512).
export const DEFAULT_PIN_PATH =
  "M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.774-39.464 0z";
const DEFAULT_PIN_SRC_WIDTH = 384;
const DEFAULT_PIN_SRC_HEIGHT = 512;
const DEFAULT_PIN_GLYPH_CENTER = { x: 192, y: 192 };

/** 검색/데이터 레이어 마커가 공유하는 표준 CSS 너비. 사이즈를 바꾸려면 여기 하나만 고친다. */
export const STANDARD_PIN_WIDTH = 24;

export interface PinIcon {
  /** lucide 아이콘의 path `d` 배열 (stroke 기반 — lucide는 fill이 아니라 stroke로 그린다). */
  paths: string[];
  /** 원본 SVG viewBox 정사각형 크기. lucide 기본값은 24. */
  viewBox?: number;
}

export interface PinImageOptions {
  /** 핀 외곽선 SVG path (viewBox 기준 좌표). 기본값은 검색 결과와 동일한 물방울 핀. */
  path?: string;
  /** path의 원본 viewBox 크기 — path를 바꿀 때만 함께 바꾼다. */
  srcWidth?: number;
  srcHeight?: number;
  /** 라벨/아이콘을 그릴 위치 — path의 원본 좌표계 기준. */
  glyphCenter?: { x: number; y: number };
  color: string;
  /** icon이 있으면 icon이 우선하고 label은 무시된다. */
  icon?: PinIcon;
  /** 생략하면 라벨 텍스트를 그리지 않는다(단색 핀). */
  label?: string;
  /** CSS 픽셀 기준 너비. 높이는 srcHeight/srcWidth 비율로 자동 계산된다. */
  cssWidth: number;
  pixelRatio?: number;
}

/** MapLibre map.addImage에 바로 넣을 수 있는 RGBA 이미지 데이터를 Canvas로 생성한다. */
export function createPinImage(options: PinImageOptions) {
  const {
    path = DEFAULT_PIN_PATH,
    srcWidth = DEFAULT_PIN_SRC_WIDTH,
    srcHeight = DEFAULT_PIN_SRC_HEIGHT,
    glyphCenter = DEFAULT_PIN_GLYPH_CENTER,
    color,
    icon,
    label,
    cssWidth,
    pixelRatio = 3,
  } = options;

  const cssHeight = cssWidth * (srcHeight / srcWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cssWidth * pixelRatio);
  canvas.height = Math.round(cssHeight * pixelRatio);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(pixelRatio, pixelRatio);

  const scale = cssWidth / srcWidth;
  const shape = new Path2D(path);

  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.fill(shape);
  ctx.lineWidth = 2 / scale;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke(shape);
  ctx.restore();

  if (icon) {
    const iconViewBox = icon.viewBox ?? 24;
    // 헤드 크기에 비례한 아이콘 렌더 크기. lineWidth는 lucide 기본값(24 viewBox
    // 기준 2)보다 조금 굵게(2.75) 줘서 24px 마커 크기에서도 선이 또렷이 보이게 한다
    // — <svg>를 그대로 축소하면 이 크기에서는 너무 가늘어 보인다.
    const iconSize = cssWidth * 0.58;
    const iconScale = iconSize / iconViewBox;

    ctx.save();
    ctx.translate(glyphCenter.x * scale, glyphCenter.y * scale);
    ctx.scale(iconScale, iconScale);
    ctx.translate(-iconViewBox / 2, -iconViewBox / 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.75;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const d of icon.paths) {
      ctx.stroke(new Path2D(d));
    }
    ctx.restore();
  } else if (label) {
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${Math.round(cssWidth * 0.55)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, glyphCenter.x * scale, glyphCenter.y * scale);
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    width: canvas.width,
    height: canvas.height,
    data: imageData.data,
    pixelRatio,
  };
}

/** 이미지가 아직 없을 때만 생성해 등록한다 — 여러 데이터 레이어가 같은 id로 중복 호출해도 안전. */
export function registerPinImage(
  map: MaplibreMap,
  imageId: string,
  options: PinImageOptions,
): void {
  if (map.hasImage(imageId)) return;
  const img = createPinImage(options);
  map.addImage(imageId, img, { pixelRatio: img.pixelRatio });
}
