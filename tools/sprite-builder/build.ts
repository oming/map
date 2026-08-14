import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rm } from "node:fs/promises";

import { loadEnvFile, resolveVworldApiKey } from "../shared/env.js";
import { downloadStyle } from "../shared/download-style.js";
import { extractStyle } from "../shared/extract-style.js";
import { loadIcons } from "./lib/load-icons.js";
import { packSprite } from "./lib/pack.js";
import { writeSprite } from "./lib/write.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  loadEnvFile(join(__dirname, "../..", ".env.local"));

  const apiKey = resolveVworldApiKey();

  if (!apiKey) {
    console.error("⚠ VWORLD_API_KEY 환경 변수가 설정되지 않았습니다.");
    console.error(
      "  export VWORLD_API_KEY=<your-key> 또는 .env.local 파일을 확인하세요.",
    );
    process.exit(1);
  }

  console.log("=== V-World POI Sprite Builder ===\n");

  let tempDir: string | null = null;

  try {
    console.log("[1/4] V-World 스타일 파일 다운로드");
    const { tempDir: td, stylePath } = await downloadStyle(apiKey);
    tempDir = td;

    console.log();
    const styleData = await extractStyle(stylePath);

    console.log();
    console.log(`[2/4] 스타일 데이터 처리: 전체 cl_id ${Object.keys(styleData).length}개`);
    const icons = await loadIcons(styleData);

    if (icons.length === 0) {
      console.error("추출된 아이콘이 없습니다.");
      process.exit(1);
    }

    console.log();
    console.log(`[3/4] 스프라이트 패킹 (${icons.length}개 아이콘)`);
    const { spriteBuffer, spriteJson } = await packSprite(icons);

    console.log();
    await writeSprite(spriteBuffer, spriteJson);
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
