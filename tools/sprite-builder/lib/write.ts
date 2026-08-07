import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SpriteJson } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// lib/ → sprite-builder-new/ → tools/ → 프로젝트 루트 (3단계 상향)
const projectRoot = join(__dirname, "..", "..", "..");
const outputDir = join(projectRoot, "public", "sprite");

export async function writeSprite(
  spriteBuffer: Buffer,
  spriteJson: SpriteJson,
): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  const metadata = await sharp(spriteBuffer).metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  const pngPath = join(outputDir, "sprite.png");
  const jsonPath = join(outputDir, "sprite.json");
  const at2xPngPath = join(outputDir, "sprite@2x.png");
  const at2xJsonPath = join(outputDir, "sprite@2x.json");

  await sharp(spriteBuffer).toFile(pngPath);
  await writeFile(jsonPath, JSON.stringify(spriteJson, null, 2), "utf8");

  await sharp(spriteBuffer).toFile(at2xPngPath);
  await writeFile(at2xJsonPath, JSON.stringify(spriteJson, null, 2), "utf8");

  console.log(`[4/4] 스프라이트 생성 완료`);
  console.log(`  → ${pngPath} (${width}x${height}, pixelRatio=1)`);
  console.log(`  → ${jsonPath}`);
  console.log(`  → ${at2xPngPath} (${width}x${height}, pixelRatio=1)`);
  console.log(`  → ${at2xJsonPath}`);
}
