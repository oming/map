import { writeFileSync } from "node:fs";
import { join } from "node:path";

/** geojson을 public/data/<id>.geojson으로 쓰고 그 경로를 반환한다. */
export function writeDatasetGeojson(
  root: string,
  id: string,
  data: unknown,
): string {
  const outPath = join(root, "public", "data", `${id}.geojson`);
  writeFileSync(outPath, JSON.stringify(data), "utf8");
  return outPath;
}
