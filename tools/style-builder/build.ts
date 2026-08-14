import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";

import { loadEnvFile, resolveVworldApiKey } from "../shared/env.js";
import { downloadStyle } from "../shared/download-style.js";
import { extractStyle } from "../shared/extract-style.js";
import { getProjectRoot } from "../shared/project-root.js";
import type { SpriteJson } from "../shared/types.js";
import { normalizeAll, buildLayers } from "./lib/style.js";
import { writePoiLayers } from "./lib/write.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadSpriteJson(spriteJsonPath: string): SpriteJson | null {
  if (!existsSync(spriteJsonPath)) {
    console.warn(
      `[warn] sprite.json을 찾을 수 없습니다: ${spriteJsonPath} (icon-offset 계산 생략)`,
    );
    return null;
  }
  return JSON.parse(readFileSync(spriteJsonPath, "utf8"));
}

async function main(): Promise<void> {
  loadEnvFile(join(__dirname, "../..", ".env.local"));

  const apiKey = resolveVworldApiKey();

  if (!apiKey) {
    console.error("⚠ NEXT_PUBLIC_VWORLD_API_KEY 환경 변수가 설정되지 않았습니다.");
    console.error(
      "  export NEXT_PUBLIC_VWORLD_API_KEY=<your-key> 또는 .env.local 파일을 확인하세요.",
    );
    process.exit(1);
  }

  console.log("=== V-World POI Style Builder ===\n");

  let tempDir: string | null = null;

  try {
    console.log("[1/4] V-World 스타일 파일 다운로드");
    const { tempDir: td, stylePath } = await downloadStyle(apiKey);
    tempDir = td;

    console.log();
    const styleData = await extractStyle(stylePath);
    console.log(`      -> cl_id ${Object.keys(styleData).length}개 발견`);

    const spriteJsonPath = join(
      getProjectRoot(),
      "public",
      "sprite",
      "sprite.json",
    );
    console.log(`\n[2/4] sprite.json 로드: ${spriteJsonPath}`);
    const spriteJson = loadSpriteJson(spriteJsonPath);

    console.log("\n[3/4] cl_id별 스타일 정규화 및 레이어 생성 중...");
    const normalized = normalizeAll(styleData, spriteJson);
    const layers = buildLayers(normalized, {
      sourceId: "vworldPoi",
      sourceLayer: "poi",
      mode: "normal",
    });
    console.log(
      `      -> layer 수: ${layers.length} (원본 cl_id 수: ${Object.keys(styleData).length})`,
    );

    console.log();
    await writePoiLayers(layers);
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  console.log("\n=== 완료 ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
