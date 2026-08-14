import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getProjectRoot } from "../../shared/project-root.js";

export async function writePoiLayers(layers: unknown[]): Promise<void> {
  const outputDir = join(getProjectRoot(), "data");
  await mkdir(outputDir, { recursive: true });

  const outputPath = join(outputDir, "poi-layers.json");
  await writeFile(outputPath, JSON.stringify(layers, null, 2), "utf8");

  console.log(`[4/4] POI 레이어 저장 완료`);
  console.log(`  → ${outputPath} (레이어 ${layers.length}개)`);
}
