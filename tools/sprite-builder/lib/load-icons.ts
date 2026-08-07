import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import type { StyleData, IconImage } from "./types.js";

export async function loadIcons(styleData: StyleData): Promise<IconImage[]> {
  const icons: IconImage[] = [];
  let skipped = 0;

  for (const [clId, style] of Object.entries(styleData)) {
    let decodeError = 0;
    const symbolStyle = style.symbolStyle || {};
    const dataUri = symbolStyle.symbolImageCn;

    if (!dataUri) {
      skipped++;
      continue;
    }

    try {
      const commaIndex = dataUri.indexOf(",");
      const header = dataUri.slice(0, commaIndex);
      const b64data = dataUri.slice(commaIndex + 1);

      const rawBytes = Buffer.from(b64data, "base64");

      let pngBuffer: Buffer;

      if (header.includes("svg")) {
        const resvg = new Resvg(rawBytes.toString("utf8"), {
          fitTo: { mode: "original" },
        });
        const pngData = resvg.render();
        pngBuffer = Buffer.from(pngData.asPng());
      } else {
        // 모든 버퍼를 PNG로 정규화 (sharp composite 호환성 확보)
        pngBuffer = await sharp(rawBytes).toFormat("png").toBuffer();
      }

      const metadata = await sharp(pngBuffer).metadata();

      if (!metadata.width || !metadata.height) continue;

      icons.push({
        id: clId,
        width: metadata.width,
        height: metadata.height,
        buffer: pngBuffer,
      });
    } catch (e) {
      console.error(`  ⚠ ${clId} 디코딩 실패:`, e);
    }
  }

  console.log(
    `아이콘 추출 완료: ${icons.length}개 (아이콘 없음/스킵: ${skipped}개)`,
  );
  return icons;
}
