import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rm } from "node:fs/promises";

import { downloadStyle } from "./lib/download.js";
import { extractStyle } from "./lib/extract.js";
import { loadIcons } from "./lib/load-icons.js";
import { packSprite } from "./lib/pack.js";
import { writeSprite } from "./lib/write.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(): void {
  const envPath = join(__dirname, "../..", ".env.local");

  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split("\n");

  for (const line of lines) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;

    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const value = line
      .slice(idx + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function main(): Promise<void> {
  loadEnv();

  const apiKey =
    process.env.VWORLD_API_KEY ?? process.env.NEXT_PUBLIC_VWORLD_API_KEY;

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
