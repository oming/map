import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const STYLE_URL =
  "https://api.vworld.kr/req/wmts/vector/getStyle/{apiKey}/vectorStylePoi";

export interface DownloadResult {
  tempDir: string;
  stylePath: string;
}

export async function downloadStyle(
  apiKey: string,
): Promise<DownloadResult> {
  const url = STYLE_URL.replace("{apiKey}", apiKey);

  console.log(`[1/4] V-World API에서 스타일 파일 다운로드: ${url}`);

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`다운로드 실패 (HTTP ${res.status})`);
  }

  const js = await res.text();
  const size = Buffer.byteLength(js);

  const tempDir = await mkdtemp(join(tmpdir(), "vworld-sprite-"));
  const stylePath = join(tempDir, "vectorStylePoi.js");

  await writeFile(stylePath, js);
  console.log(`  → ${stylePath} 저장 완료 (${size} bytes)`);

  return { tempDir, stylePath };
}
