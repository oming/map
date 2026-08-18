"use client";

import type { Map as MaplibreMap } from "maplibre-gl";

// 검색 결과 마커에서 쓰던 것과 동일한 물방울 핀 SVG path (viewBox 384x512).
export const DEFAULT_PIN_PATH =
  "M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.774-39.464 0z";
const DEFAULT_PIN_SRC_WIDTH = 384;
const DEFAULT_PIN_SRC_HEIGHT = 512;
const DEFAULT_PIN_GLYPH_CENTER = { x: 192, y: 192 };

export interface PinImageOptions {
  /** 핀 외곽선 SVG path (viewBox 기준 좌표). 기본값은 검색 결과와 동일한 물방울 핀. */
  path?: string;
  /** path의 원본 viewBox 크기 — path를 바꿀 때만 함께 바꾼다. */
  srcWidth?: number;
  srcHeight?: number;
  /** 라벨(글리프) 텍스트를 그릴 위치 — path의 원본 좌표계 기준. */
  glyphCenter?: { x: number; y: number };
  color: string;
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

  if (label) {
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
