import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { loadEnvFile, resolveVworldApiKey } from "../shared/env.js";
import { getProjectRoot } from "../shared/project-root.js";
import { decodeCsvBuffer } from "./lib/encoding.js";
import { parseCsv } from "./lib/csv.js";
import { isInKoreaBBox, roundCoord, nfc } from "./lib/geojson.js";
import {
  loadCache,
  saveCache,
  geocodeAddress,
  createGeocodeStats,
} from "./lib/geocode.js";

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

function pick(row: Record<string, string>, key: string): string {
  return row[key]?.trim() ?? "";
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
  const inputPath = join(__dirname, "input", "toilet-suwon.csv");
  if (!existsSync(inputPath)) {
    console.error(`⚠ 입력 파일이 없습니다: ${inputPath}`);
    console.error(
      "  원본 CSV를 tools/data-builder/input/toilet-suwon.csv 로 배치하세요.",
    );
    process.exit(1);
  }

  console.log("=== Data Builder: toilet-suwon ===\n");

  console.log("[1/4] CSV 읽기 + 인코딩 감지");
  const text = decodeCsvBuffer(readFileSync(inputPath));
  const rows = parseCsv(text);
  console.log(`      -> ${rows.length}행`);

  console.log(
    `\n[2/4] 지오코딩 (V-World Geocoder 2.0, 동시성 ${CONCURRENCY})`,
  );
  const cachePath = join(__dirname, "cache", "geocode.json");
  mkdirSync(dirname(cachePath), { recursive: true });
  const cache = loadCache(cachePath);
  const stats = createGeocodeStats();

  const geocoded = await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
    const roadAddress = pick(row, "소재지도로명주소");
    const parcelAddress = pick(row, "소재지지번주소");
    const point = await geocodeAddress(
      roadAddress,
      parcelAddress,
      apiKey,
      cache,
      stats,
    );
    return { row, point };
  });

  saveCache(cachePath, cache);
  console.log(
    `      -> 캐시 히트 ${stats.hitCache} / 도로명 성공 ${stats.roadOk} / 지번 폴백 ${stats.parcelFallbackOk} / 실패 ${stats.failed} / 네트워크 오류 ${stats.networkFailed}`,
  );
  if (stats.networkFailed > 0) {
    console.warn(
      `      ⚠ 네트워크 오류로 캐시되지 않은 주소 ${stats.networkFailed}건 — 재실행하면 자동 재시도됩니다.`,
    );
  }
  if (stats.divergenceWarnings.length > 0) {
    console.warn(
      `      ⚠ 도로명/지번 발산(>500m) ${stats.divergenceWarnings.length}건 — cache/toilet-suwon.stats.json 참고`,
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
    const address = pick(row, "소재지도로명주소") || pick(row, "소재지지번주소");
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [roundCoord(point.lon), roundCoord(point.lat)],
      },
      properties: {
        id: pick(row, "관리번호"),
        name: nfc(pick(row, "화장실명")),
        address: nfc(address),
        category: pick(row, "구분명"),
        openHours: pick(row, "개방시간상세") || pick(row, "개방시간"),
        owner: pick(row, "화장실소유구분명"),
        hasDiaperTable: pick(row, "기저귀교환대유무") === "Y",
        geocodeType: point.type,
      },
    });
  }

  console.log(
    `      -> ${features.length}건 (좌표 실패 ${droppedNoCoord}, bbox 이탈 ${droppedOutOfBBox})`,
  );

  console.log("\n[4/4] 파일 쓰기");
  const outPath = join(root, "public", "data", "toilet-suwon.geojson");
  writeFileSync(
    outPath,
    JSON.stringify({ type: "FeatureCollection", features }),
    "utf8",
  );
  console.log(`      -> ${outPath}`);

  const statsPath = join(__dirname, "cache", "toilet-suwon.stats.json");
  writeFileSync(
    statsPath,
    JSON.stringify(
      {
        totalRows: rows.length,
        hitCache: stats.hitCache,
        roadOk: stats.roadOk,
        parcelFallbackOk: stats.parcelFallbackOk,
        failed: stats.failed,
        failedAddresses: stats.failedAddresses,
        networkFailed: stats.networkFailed,
        networkFailedAddresses: stats.networkFailedAddresses,
        divergenceWarnings: stats.divergenceWarnings,
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
