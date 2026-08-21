import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const HASH_LENGTH = 10;

/**
 * geojson을 콘텐츠 해시가 붙은 파일명(public/data/<id>.<hash>.geojson)으로 쓰고,
 * 같은 id의 이전 해시 파일을 지운 뒤 lib/map/datasets/data-manifest.json의 해당
 * id 항목을 갱신한다.
 *
 * next.config.ts가 /data/:path*를 immutable(1년) 캐시로 설정해두는데, data-builder가
 * 같은 파일명을 덮어쓰면 브라우저가 갱신된 데이터를 영영 못 받는다 — 콘텐츠가
 * 바뀔 때마다 해시(=파일명)도 함께 바뀌어야 안전하다. 콘텐츠가 그대로면 해시도
 * 그대로라 불필요한 git diff/재배포가 생기지 않는다.
 */
export function writeDatasetGeojson(
  root: string,
  id: string,
  data: unknown,
): string {
  const content = JSON.stringify(data);
  const hash = createHash("sha256").update(content).digest("hex").slice(0, HASH_LENGTH);
  const fileName = `${id}.${hash}.geojson`;
  const dataDir = join(root, "public", "data");
  const hashedNamePattern = new RegExp(`^${id}\\.[0-9a-f]{${HASH_LENGTH}}\\.geojson$`);

  for (const existing of readdirSync(dataDir)) {
    if (existing !== fileName && hashedNamePattern.test(existing)) {
      rmSync(join(dataDir, existing));
    }
  }

  const outPath = join(dataDir, fileName);
  writeFileSync(outPath, content, "utf8");

  const manifestPath = join(root, "lib", "map", "datasets", "data-manifest.json");
  const manifest: Record<string, string> = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8"))
    : {};
  manifest[id] = hash;
  writeFileSync(
    manifestPath,
    JSON.stringify(manifest, Object.keys(manifest).sort(), 2) + "\n",
    "utf8",
  );

  return outPath;
}
