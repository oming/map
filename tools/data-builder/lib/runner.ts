import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { loadEnvFile, resolveVworldApiKey } from "../../shared/env.js";
import { getProjectRoot } from "../../shared/project-root.js";
import { readInputRows } from "./input.js";
import { isInKoreaBBox, roundCoord, pick, type Feature } from "./geojson.js";
import { mapWithConcurrency } from "./concurrency.js";
import {
  loadCache,
  saveCache,
  geocodeAddress,
  createGeocodeStats,
  type GeocodeStats,
} from "./geocode.js";
import { writeDatasetGeojson } from "./output.js";
import type { BuildRecipe } from "./recipe-types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_BUILDER_DIR = join(__dirname, "..");
const CONCURRENCY = 2;

interface CoordRow {
  row: Record<string, string>;
  lon: number;
  lat: number;
  geocodeType?: "road" | "parcel";
}

/**
 * 모든 레시피가 공유하는 실행 흐름: 입력 읽기 → 좌표 확보(이미 있음/지오코딩) →
 * bbox 검증 → (옵션) 동일좌표 완전중복 제거 → mapRow → geojson/stats 저장.
 * 각 단계의 세부 규칙(컬럼 매핑, dedup 서명)만 레시피가 결정한다. 같은 좌표에 여러
 * 지점이 남아도 병합하지 않는다 — 지도 위에서 spiderfy로 펼쳐서 선택하게 한다.
 */
export async function runRecipe(recipe: BuildRecipe): Promise<void> {
  const root = getProjectRoot();
  const inputPath = join(DATA_BUILDER_DIR, "input", recipe.inputFile);
  if (!existsSync(inputPath)) {
    console.error(`⚠ 입력 파일이 없습니다: ${inputPath}`);
    console.error(
      `  원본 파일을 tools/data-builder/input/${recipe.inputFile} 로 배치하세요.`,
    );
    process.exit(1);
  }

  console.log(`=== Data Builder: ${recipe.id} ===\n`);

  console.log("[1/4] 입력 읽기");
  const rows = readInputRows(recipe.inputFormat, readFileSync(inputPath));
  console.log(`      -> ${rows.length}행`);

  let coordRows: CoordRow[];
  let geocodeStats: GeocodeStats | null = null;
  let droppedNoCoord = 0;

  if (recipe.coordinates.kind === "present") {
    console.log("\n[2/4] 좌표 파싱 (컬럼에 이미 존재)");
    const { latKey, lonKey } = recipe.coordinates;
    coordRows = [];
    for (const row of rows) {
      const lat = Number(pick(row, latKey));
      const lon = Number(pick(row, lonKey));
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || (!lat && !lon)) {
        droppedNoCoord++;
        continue;
      }
      coordRows.push({ row, lon, lat });
    }
    console.log(`      -> ${coordRows.length}건 (좌표 없음 ${droppedNoCoord})`);
  } else {
    console.log(
      `\n[2/4] 지오코딩 (V-World Geocoder 2.0, 동시성 ${CONCURRENCY})`,
    );
    loadEnvFile(join(DATA_BUILDER_DIR, "..", "..", ".env.local"));
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

    const { roadAddressKey, parcelAddressKey } = recipe.coordinates;
    const cachePath = join(DATA_BUILDER_DIR, "cache", "geocode.json");
    mkdirSync(dirname(cachePath), { recursive: true });
    const cache = loadCache(cachePath);
    const stats = createGeocodeStats();
    geocodeStats = stats;

    const geocoded = await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
      const roadAddress = pick(row, roadAddressKey);
      const parcelAddress = parcelAddressKey ? pick(row, parcelAddressKey) : "";
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
        `      ⚠ 도로명/지번 발산(>500m) ${stats.divergenceWarnings.length}건 — cache/${recipe.id}.stats.json 참고`,
      );
    }

    coordRows = [];
    for (const { row, point } of geocoded) {
      if (!point) {
        droppedNoCoord++;
        continue;
      }
      coordRows.push({ row, lon: point.lon, lat: point.lat, geocodeType: point.type });
    }
  }

  console.log(
    "\n[3/4] bbox 검증 + 좌표 반올림" +
      (recipe.dedup ? " + 동일좌표 중복 제거" : ""),
  );
  let droppedOutOfBBox = 0;
  let exactDuplicatesRemoved = 0;
  const features: Feature[] = [];

  if (!recipe.dedup) {
    // dedup이 없는 레시피는 원본 행 순서를 그대로 유지한다 — 좌표로 그룹핑하면
    // 순서가 바뀌어 기존 geojson과의 byte-for-byte 비교가 무의미해진다.
    for (const { row, lon, lat, geocodeType } of coordRows) {
      if (!isInKoreaBBox(lon, lat)) {
        droppedOutOfBBox++;
        continue;
      }
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [roundCoord(lon), roundCoord(lat)],
        },
        properties: recipe.mapRow(row, { geocodeType }),
      });
    }
  } else {
    const byCoord = new Map<
      string,
      { lon: number; lat: number; rows: Record<string, string>[] }
    >();
    for (const { row, lon, lat } of coordRows) {
      if (!isInKoreaBBox(lon, lat)) {
        droppedOutOfBBox++;
        continue;
      }
      const roundedLon = roundCoord(lon);
      const roundedLat = roundCoord(lat);
      const key = `${roundedLon},${roundedLat}`;
      if (!byCoord.has(key)) {
        byCoord.set(key, { lon: roundedLon, lat: roundedLat, rows: [] });
      }
      byCoord.get(key)!.rows.push(row);
    }

    for (const { lon, lat, rows: groupRows } of byCoord.values()) {
      const seen = new Set<string>();
      for (const row of groupRows) {
        const signature = recipe.dedup.signature(row);
        if (seen.has(signature)) {
          exactDuplicatesRemoved++;
          continue;
        }
        seen.add(signature);
        // 같은 좌표에 여러 지점이 남아도 병합하지 않는다 — 개별 feature로 두고
        // 지도 위에서 spiderfy로 펼쳐서 선택하게 한다(hooks/use-spiderfy.ts).
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [lon, lat] },
          properties: recipe.mapRow(row, {}),
        });
      }
    }
  }

  console.log(
    `      -> ${features.length}건 (좌표 없음 ${droppedNoCoord}, bbox 이탈 ${droppedOutOfBBox}` +
      (recipe.dedup ? `, 완전 중복 제거 ${exactDuplicatesRemoved})` : ")"),
  );

  console.log("\n[4/4] 파일 쓰기");
  const outPath = writeDatasetGeojson(root, recipe.id, {
    type: "FeatureCollection",
    features,
  });
  console.log(`      -> ${outPath}`);

  const statsPath = join(DATA_BUILDER_DIR, "cache", `${recipe.id}.stats.json`);
  const statsObj = geocodeStats
    ? {
        totalRows: rows.length,
        hitCache: geocodeStats.hitCache,
        roadOk: geocodeStats.roadOk,
        parcelFallbackOk: geocodeStats.parcelFallbackOk,
        failed: geocodeStats.failed,
        failedAddresses: geocodeStats.failedAddresses,
        networkFailed: geocodeStats.networkFailed,
        networkFailedAddresses: geocodeStats.networkFailedAddresses,
        divergenceWarnings: geocodeStats.divergenceWarnings,
        droppedNoCoord,
        droppedOutOfBBox,
        featuresWritten: features.length,
      }
    : {
        totalRows: rows.length,
        droppedNoCoord,
        droppedOutOfBBox,
        ...(recipe.dedup ? { exactDuplicatesRemoved } : {}),
        featuresWritten: features.length,
      };
  writeFileSync(statsPath, JSON.stringify(statsObj, null, 2) + "\n", "utf8");
  console.log(`      -> ${statsPath}`);

  console.log("\n=== 완료 ===");
}
