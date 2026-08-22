import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getProjectRoot } from "../../shared/project-root.js";
import type { OsmStyleJson } from "./types.js";

export async function writeOsmStyle(style: OsmStyleJson): Promise<void> {
  const outputDir = join(getProjectRoot(), "data");
  await mkdir(outputDir, { recursive: true });

  const outputPath = join(outputDir, "osm-style.json");
  await writeFile(outputPath, JSON.stringify(style, null, 2), "utf8");

  console.log(`  → ${outputPath} (레이어 ${style.layers.length}개)`);
}

export async function writeSpriteFile(
  filename: string,
  buffer: Buffer,
): Promise<void> {
  const outputDir = join(getProjectRoot(), "public", "sprite-osm", "basics");
  await mkdir(outputDir, { recursive: true });

  const outputPath = join(outputDir, filename);
  await writeFile(outputPath, buffer);

  console.log(`  → ${outputPath}`);
}
