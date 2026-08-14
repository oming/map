import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_LEVELS = 8;

export function getProjectRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));

  for (let i = 0; i < MAX_LEVELS; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    "프로젝트 루트를 찾을 수 없습니다 (pnpm-workspace.yaml 탐색 실패).",
  );
}
