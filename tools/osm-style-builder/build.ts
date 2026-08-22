import { downloadSprites, downloadStyle } from "./lib/download.js";
import { transformStyle } from "./lib/transform.js";
import { writeOsmStyle, writeSpriteFile } from "./lib/write.js";

async function main(): Promise<void> {
  console.log("=== OSM Shortbread(VersaTiles) Style Builder ===\n");

  console.log("[1/3] VersaTiles colorful 스타일 다운로드");
  const raw = await downloadStyle();
  console.log(`      -> 레이어 ${raw.layers.length}개`);

  console.log("\n[2/3] 스타일 변환 (폰트 매핑, glyphs/sprite 제거)");
  const { style, unmappedFonts } = transformStyle(raw);
  if (unmappedFonts.length > 0) {
    console.warn(
      `      ⚠ FONT_MAP에 없는 폰트 발견 — NanumGothic Regular로 폴백: ${unmappedFonts.join(", ")}`,
    );
    console.warn(
      "      원본 스타일에 폰트가 추가된 것일 수 있다 — tools/osm-style-builder/lib/transform.ts의 FONT_MAP을 확인하세요.",
    );
  }
  await writeOsmStyle(style);

  console.log("\n[3/3] 스프라이트 다운로드");
  const sprites = await downloadSprites();
  for (const { filename, buffer } of sprites) {
    await writeSpriteFile(filename, buffer);
  }

  console.log("\n=== 완료 ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
