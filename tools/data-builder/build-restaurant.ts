import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { loadEnvFile, resolveVworldApiKey } from "../shared/env.js";
import { getProjectRoot } from "../shared/project-root.js";
import { parseRestaurantMarkdownTable } from "./lib/markdown-table.js";
import { isInKoreaBBox, roundCoord, nfc } from "./lib/geojson.js";
import {
  loadCache,
  saveCache,
  geocodeAddress,
  createGeocodeStats,
} from "./lib/geocode.js";
import { writeDatasetGeojson } from "./lib/output.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONCURRENCY = 2;

interface Feature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, unknown>;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

async function main(): Promise<void> {
  loadEnvFile(join(__dirname, "../..", ".env.local"));
  const apiKey = resolveVworldApiKey();
  if (!apiKey) {
    console.error(
      "⚠ NEXT_PUBLIC_VWORLD_API_KEY 환경 변수가 설정되지 않았습니다.",
    );
    console.error(
      "  export NEXT_PUBLIC_VWORLD_API_KEY=<your-key> 또는 .env.local 파일을 확인하세요.",
    );
    process.exit(1);
  }

  const root = getProjectRoot();
  const inputPath = join(__dirname, "input", "restaurant-suwon.md");
  if (!existsSync(inputPath)) {
    console.error(`⚠ 입력 파일이 없습니다: ${inputPath}`);
    console.error(
      "  원본 마크다운을 tools/data-builder/input/restaurant-suwon.md 로 배치하세요.",
    );
    process.exit(1);
  }

  console.log("=== Data Builder: restaurant-suwon ===\n");

  console.log("[1/4] 마크다운 표 파싱");
  const text = readFileSync(inputPath, "utf8");
  const rows = parseRestaurantMarkdownTable(text);
  console.log(`      -> ${rows.length}행`);

  console.log(
    `\n[2/4] 지오코딩 (V-World Geocoder 2.0, 동시성 ${CONCURRENCY})`,
  );
  const cachePath = join(__dirname, "cache", "geocode.json");
  mkdirSync(dirname(cachePath), { recursive: true });
  const cache = loadCache(cachePath);
  const stats = createGeocodeStats();

  const geocoded = await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
    const point = await geocodeAddress(row.roadAddress, "", apiKey, cache, stats);
    return { row, point };
  });

  saveCache(cachePath, cache);
  console.log(
    `      -> 캐시 히트 ${stats.hitCache} / 도로명 성공 ${stats.roadOk} / 실패 ${stats.failed} / 네트워크 오류 ${stats.networkFailed}`,
  );
  if (stats.networkFailed > 0) {
    console.warn(
      `      ⚠ 네트워크 오류로 캐시되지 않은 주소 ${stats.networkFailed}건 — 재실행하면 자동 재시도됩니다.`,
    );
  }

  console.log("\n[3/4] GeoJSON 변환 (bbox 검증 + 좌표 5자리 절삭 + NFC 정규화)");
  const features: Feature[] = [];
  let droppedNoCoord = 0;
  let droppedOutOfBBox = 0;

  for (const { row, point } of geocoded) {
    if (!point) {
      droppedNoCoord++;
      continue;
    }
    if (!isInKoreaBBox(point.lon, point.lat)) {
      droppedOutOfBBox++;
      continue;
    }
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [roundCoord(point.lon), roundCoord(point.lat)],
      },
      properties: {
        id: row.rank,
        name: nfc(row.name),
        address: nfc(row.roadAddress),
        category: nfc(row.category),
        phone: row.phone,
        naverUrl: row.naverUrl,
      },
    });
  }

  console.log(
    `      -> ${features.length}건 (좌표 실패 ${droppedNoCoord}, bbox 이탈 ${droppedOutOfBBox})`,
  );

  console.log("\n[4/4] 파일 쓰기");
  const outPath = writeDatasetGeojson(root, "restaurant-suwon", {
    type: "FeatureCollection",
    features,
  });
  console.log(`      -> ${outPath}`);

  const statsPath = join(__dirname, "cache", "restaurant-suwon.stats.json");
  writeFileSync(
    statsPath,
    JSON.stringify(
      {
        totalRows: rows.length,
        hitCache: stats.hitCache,
        roadOk: stats.roadOk,
        failed: stats.failed,
        failedAddresses: stats.failedAddresses,
        networkFailed: stats.networkFailed,
        networkFailedAddresses: stats.networkFailedAddresses,
        droppedNoCoord,
        droppedOutOfBBox,
        featuresWritten: features.length,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  console.log(`      -> ${statsPath}`);

  console.log("\n=== 완료 ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
