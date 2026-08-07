import sharp from "sharp";
import type { IconImage, SpriteJson } from "./types.js";

const PADDING = 1;
const MAX_WIDTH = 4096;

export async function packSprite(icons: IconImage[]): Promise<{
  spriteBuffer: Buffer;
  spriteJson: SpriteJson;
}> {
  const items = [...icons].sort((a, b) => b.height - a.height);

  const positions = new Map<string, [number, number, number, number]>();
  let xCursor = 0;
  let yCursor = 0;
  let rowHeight = 0;
  let canvasWidth = 0;

  for (const icon of items) {
    const { id, width: w, height: h } = icon;

    if (xCursor + w > MAX_WIDTH) {
      xCursor = 0;
      yCursor += rowHeight + PADDING;
      rowHeight = 0;
    }

    positions.set(id, [xCursor, yCursor, w, h]);
    canvasWidth = Math.max(canvasWidth, xCursor + w);
    rowHeight = Math.max(rowHeight, h);
    xCursor += w + PADDING;
  }

  const canvasHeight = yCursor + rowHeight;

  const layers = [];
  const spriteJson: SpriteJson = {};

  for (const icon of items) {
    const [x, y] = positions.get(icon.id)!;

    layers.push({
      input: icon.buffer,
      left: x,
      top: y,
    });

    spriteJson[icon.id] = {
      x,
      y,
      width: icon.width,
      height: icon.height,
      pixelRatio: 1,
    };
  }

  // 빈 RGBA 캔버스 생성
  const blankBuffer = Buffer.alloc(canvasWidth * canvasHeight * 4, 0);
  const sprite = sharp(blankBuffer, {
    raw: { width: canvasWidth, height: canvasHeight, channels: 4 },
  }).composite(layers);

  const spriteBuffer = await sprite.toFormat("png").toBuffer();

  return { spriteBuffer, spriteJson };
}
