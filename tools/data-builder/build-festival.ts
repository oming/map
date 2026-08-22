// 레시피 파이프라인(run.ts + recipes/)을 쓰지 않는 이유 — 입력이 로컬 파일이 아니라
// data.go.kr OpenAPI라 페이지네이션·재시도·에러코드 해석이 필요하다(README 참고).
// 종료된 축제를 실행 시점 기준으로 걸러내므로 출력은 매 실행마다 달라질 수 있다.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";

import { loadEnvFile } from "../shared/env.js";
import { getProjectRoot } from "../shared/project-root.js";
import { isInKoreaBBox, roundCoord, nfc, type Feature } from "./lib/geojson.js";
import { writeDatasetGeojson } from "./lib/output.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_URL = "https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api";
const NUM_OF_ROWS = 1000; // 문서상 최대값
const MAX_PAGES = 50; // 안전장치 — totalCount가 비정상적으로 크게 오는 경우 무한루프 방지
const MAX_RETRIES = 5;

// docs/공공데이터/전국문화축제표준데이터.md 에러코드 표.
const ERROR_MESSAGES: Record<string, string> = {
  "00": "NORMAL_CODE (정상)",
  "01": "APPLICATION_ERROR (어플리케이션 에러)",
  "02": "DB_ERROR (데이터베이스 에러)",
  "03": "NODATA_ERROR (데이터없음 에러)",
  "04": "HTTP_ERROR",
  "05": "SERVICETIMEOUT_ERROR (서비스 연결실패 에러)",
  "10": "INVALID_REQUEST_PARAMETER_ERROR (잘못된 요청 파라메터 에러)",
  "11": "NO_MANDATORY_REQUEST_PARAMETERS_ERROR (필수요청 파라메터가 없음)",
  "12": "NO_OPENAPI_SERVICE_ERROR (해당 오픈API서비스가 없거나 폐기됨)",
  "20": "SERVICE_ACCESS_DENIED_ERROR (서비스 접근거부)",
  "21": "TEMPORARILY_DISABLE_THE_SERVICEKEY_ERROR (일시적으로 사용할 수 없는 서비스 키)",
  "22": "LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR (서비스 요청제한횟수 초과에러)",
  "30": "SERVICE_KEY_IS_NOT_REGISTERED_ERROR (등록되지 않은 서비스키)",
  "31": "DEADLINE_HAS_EXPIRED_ERROR (기한만료된 서비스키)",
  "32": "UNREGISTERED_IP_ERROR (등록되지 않은 IP)",
  "33": "UNSIGNED_CALL_ERROR (서명되지 않은 호출)",
  "99": "UNKNOWN_ERROR (기타에러)",
};

interface FestivalItem {
  fstvlNm?: string;
  opar?: string;
  fstvlStartDate?: string;
  fstvlEndDate?: string;
  fstvlCo?: string;
  mnnstNm?: string;
  auspcInsttNm?: string;
  suprtInsttNm?: string;
  phoneNumber?: string;
  homepageUrl?: string;
  relateInfo?: string;
  rdnmadr?: string;
  lnmadr?: string;
  latitude?: string;
  longitude?: string;
}

interface ApiResponse {
  header: { resultCode: string; resultMsg: string };
  body?: {
    items?: FestivalItem[] | { item: FestivalItem[] } | "";
    totalCount?: number;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractItems(body: ApiResponse["body"]): FestivalItem[] {
  if (!body || !body.items) return [];
  if (Array.isArray(body.items)) return body.items;
  if (Array.isArray(body.items.item)) return body.items.item;
  return [];
}

async function fetchPage(apiKey: string, pageNo: number): Promise<ApiResponse> {
  const url = new URL(API_URL);
  url.searchParams.set("serviceKey", apiKey);
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("numOfRows", String(NUM_OF_ROWS));
  url.searchParams.set("type", "json");

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as ApiResponse;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) await sleep(500 * 2 ** attempt);
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`페이지 ${pageNo} 요청 실패 (재시도 소진): ${message}`);
}

/**
 * "YYYY-MM-DD"와 "YYYYMMDD" 둘 다 시도한다 — 문서에 정확한 포맷이 명시되어 있지
 * 않으므로 방어적으로 파싱하고, 실패하면 조용히 버리지 않고 호출부에서 집계한다.
 */
function parseDateFlexible(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const iso = /^\d{8}$/.test(trimmed)
    ? `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`
    : trimmed;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  loadEnvFile(join(__dirname, "../..", ".env.local"));
  const apiKey = process.env.DATA_GO_KR_FESTIVAL_KEY;
  if (!apiKey) {
    console.error("⚠ DATA_GO_KR_FESTIVAL_KEY 환경 변수가 설정되지 않았습니다.");
    console.error(
      "  https://www.data.go.kr/data/15013104/openapi.do 에서 발급받은 일반 인증키(Decoding)를",
    );
    console.error("  .env.local의 DATA_GO_KR_FESTIVAL_KEY에 넣으세요.");
    process.exit(1);
  }

  const root = getProjectRoot();
  const todayStr = new Date().toISOString().slice(0, 10);

  console.log("=== Data Builder: festival ===\n");
  console.log("[1/3] API 페이징 호출");

  const rawItems: FestivalItem[] = [];
  let totalCount = Infinity;
  for (let pageNo = 1; pageNo <= MAX_PAGES && rawItems.length < totalCount; pageNo++) {
    const data = await fetchPage(apiKey, pageNo);
    const { resultCode, resultMsg } = data.header;
    if (resultCode !== "00") {
      console.error(
        `⚠ API 에러 (page ${pageNo}): ${resultCode} ${ERROR_MESSAGES[resultCode] ?? resultMsg}`,
      );
      process.exit(1);
    }

    const items = extractItems(data.body);
    totalCount = data.body?.totalCount ?? items.length;
    if (items.length === 0) break;
    rawItems.push(...items);
    console.log(`      -> page ${pageNo}: ${items.length}건 (누적 ${rawItems.length}/${totalCount})`);
  }

  if (rawItems.length < totalCount) {
    console.warn(
      `      ⚠ 페이지 상한(${MAX_PAGES})에 도달해 ${rawItems.length}/${totalCount}건만 가져왔습니다.`,
    );
  }

  console.log(
    "\n[2/3] GeoJSON 변환 (bbox 검증 + 진행중/예정 필터 + 좌표 5자리 절삭 + NFC 정규화 + 완전 중복 제거)",
  );

  const features: Feature[] = [];
  const seen = new Set<string>();
  let droppedNoCoord = 0;
  let droppedOutOfBBox = 0;
  let droppedPast = 0;
  let droppedBadDate = 0;
  let dedupRemoved = 0;

  for (const item of rawItems) {
    const lat = Number(item.latitude);
    const lon = Number(item.longitude);
    if (!item.latitude || !item.longitude || Number.isNaN(lat) || Number.isNaN(lon)) {
      droppedNoCoord++;
      continue;
    }
    if (!isInKoreaBBox(lon, lat)) {
      droppedOutOfBBox++;
      continue;
    }

    const endDate = parseDateFlexible(item.fstvlEndDate ?? "");
    if (endDate === null) {
      droppedBadDate++;
      continue;
    }
    if (endDate < todayStr) {
      droppedPast++;
      continue;
    }

    const roundedLon = roundCoord(lon);
    const roundedLat = roundCoord(lat);
    const name = nfc((item.fstvlNm ?? "").trim());
    const startDate = parseDateFlexible(item.fstvlStartDate ?? "") ?? "";
    const signature = `${name}||${startDate}||${roundedLon}||${roundedLat}`;
    if (seen.has(signature)) {
      dedupRemoved++;
      continue;
    }
    seen.add(signature);

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [roundedLon, roundedLat] },
      properties: {
        name,
        place: nfc((item.opar ?? "").trim()),
        startDate,
        endDate,
        content: nfc((item.fstvlCo ?? "").trim()),
        host: nfc((item.mnnstNm ?? "").trim()),
        organizer: nfc((item.auspcInsttNm ?? "").trim()),
        sponsor: nfc((item.suprtInsttNm ?? "").trim()),
        phone: (item.phoneNumber ?? "").trim(),
        homepage: (item.homepageUrl ?? "").trim(),
        relatedInfo: nfc((item.relateInfo ?? "").trim()),
        roadAddress: nfc((item.rdnmadr ?? "").trim()),
        parcelAddress: nfc((item.lnmadr ?? "").trim()),
      },
    });
  }

  console.log(
    `      -> ${features.length}건 (좌표없음 ${droppedNoCoord}, bbox이탈 ${droppedOutOfBBox}, 종료된축제 ${droppedPast}, 날짜파싱실패 ${droppedBadDate}, 중복제거 ${dedupRemoved})`,
  );

  console.log("\n[3/3] 파일 쓰기");
  const outPath = writeDatasetGeojson(root, "festival", {
    type: "FeatureCollection",
    features,
  });
  console.log(`      -> ${outPath}`);

  const cacheDir = join(__dirname, "cache");
  mkdirSync(cacheDir, { recursive: true });
  const statsPath = join(cacheDir, "festival.stats.json");
  writeFileSync(
    statsPath,
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        totalFetched: rawItems.length,
        droppedNoCoord,
        droppedOutOfBBox,
        droppedPast,
        droppedBadDate,
        dedupRemoved,
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
