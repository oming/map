import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StyleData } from "./types.js";

const exec = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function extractStyle(stylePath: string): Promise<StyleData> {
  const script = join(__dirname, "extract-style.cjs");

  const { stdout, stderr } = await exec("node", [script, stylePath], {
    maxBuffer: 50 * 1024 * 1024, // 50MB
  });

  if (stderr) {
    console.warn(stderr);
  }

  if (!stdout.trim()) {
    throw new Error(
      "extract-style.cjs가 빈 출력을 반환했습니다. 하위 프로세스 stderr를 확인하세요.",
    );
  }

  try {
    return JSON.parse(stdout);
  } catch (e) {
    throw new Error(
      `extract-style.cjs 출력 JSON 파싱 실패: ${(e as Error).message}\n  stdout (전체): ${stdout}`,
    );
  }
}
