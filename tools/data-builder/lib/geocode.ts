import { readFileSync, writeFileSync, existsSync } from "node:fs";

const VWORLD_GEOCODER_URL = "https://api.vworld.kr/req/address";

export interface GeocodePoint {
  lon: number;
  lat: number;
  type: "road" | "parcel";
}

interface VWorldGeocodeResponse {
  response: {
    status: "OK" | "NOT_FOUND" | "ERROR";
    result?: { point: { x: string; y: string } };
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeocoderOnce(
  address: string,
  type: "road" | "parcel",
  apiKey: string,
): Promise<GeocodePoint | null> {
  const url = new URL(VWORLD_GEOCODER_URL);
  url.searchParams.set("service", "address");
  url.searchParams.set("request", "getcoord");
  url.searchParams.set("version", "2.0");
  url.searchParams.set("crs", "epsg:4326");
  url.searchParams.set("address", address);
  url.searchParams.set("refine", "true");
  url.searchParams.set("simple", "false");
  url.searchParams.set("format", "json");
  url.searchParams.set("type", type);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  // HTTP 레벨 오류(예: 502)는 "찾을 수 없음"이 아니라 일시적 장애다 — throw해서
  // callGeocoder의 재시도 루프를 태워야 한다. 여기서 null을 반환하면 재시도 없이
  // 바로 캐시에 영구 실패로 박제된다(실제로 이 버그로 상당수가 오분류됐었다).
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = (await res.json()) as VWorldGeocodeResponse;
  if (data.response.status !== "OK" || !data.response.result) return null;

  return {
    lon: Number(data.response.result.point.x),
    lat: Number(data.response.result.point.y),
    type,
  };
}

const MAX_RETRIES = 5;

/** 재시도를 모두 소진한 네트워크 실패 — 캐시에 쓰면 안 된다(다음 실행에서 다시 시도해야 함). */
export class GeocodeNetworkError extends Error {}

/**
 * V-World Geocoder 2.0. type은 주소 종류와 반드시 일치해야 한다 — 지번주소를
 * type=road로 보내면 NOT_FOUND (실제 호출로 검증됨. 계획서 §3.1 참고).
 * 소켓 오류 등 일시적 네트워크 장애는 지수 백오프로 재시도한다 — NOT_FOUND(정상
 * 응답, null 반환)와 네트워크 실패(예외, 재시도 후에도 실패하면 throw)를 구분해야
 * 후자를 캐시에 영구히 "찾을 수 없음"으로 잘못 남기지 않는다.
 */
async function callGeocoder(
  address: string,
  type: "road" | "parcel",
  apiKey: string,
): Promise<GeocodePoint | null> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await callGeocoderOnce(address, type, apiKey);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        await sleep(500 * 2 ** attempt);
      }
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new GeocodeNetworkError(`${address}: ${message}`);
}

// 단순 Haversine — 도로명/지번 결과 발산 검증용(미터 단위 근사치면 충분).
function distanceMeters(a: GeocodePoint, b: GeocodePoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type GeocodeCache = Record<string, GeocodePoint | null>;

export function loadCache(path: string): GeocodeCache {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8"));
}

export function saveCache(path: string, cache: GeocodeCache): void {
  writeFileSync(path, JSON.stringify(cache, null, 2) + "\n", "utf8");
}

export interface GeocodeStats {
  hitCache: number;
  roadOk: number;
  parcelFallbackOk: number;
  failed: number;
  failedAddresses: string[];
  networkFailed: number;
  networkFailedAddresses: string[];
  divergenceWarnings: { road: string; parcel: string; meters: number }[];
}

export function createGeocodeStats(): GeocodeStats {
  return {
    hitCache: 0,
    roadOk: 0,
    parcelFallbackOk: 0,
    failed: 0,
    failedAddresses: [],
    networkFailed: 0,
    networkFailedAddresses: [],
    divergenceWarnings: [],
  };
}

/**
 * 도로명주소 + type=road를 우선 시도하고, 실패하면 지번주소 + type=parcel로
 * 폴백한다(같은 주소로 type만 바꾸는 게 아니다 — §3.1에서 검증). 캐시는
 * "도로명||지번" 조합 키로 저장해 재실행 시 API 호출 0을 보장한다.
 *
 * 도로명이 성공한 경우에도 지번을 한 번 더 조회해 두 좌표가 500m 이상
 * 벌어지면 경고로 남긴다 — 실측 예에서 ~1.25km 발산이 확인됐으므로
 * 조용히 넘기지 않는다(§3.1). 588건 규모에서 이 추가 호출은 일일 한도(40,000)
 * 대비 무시할 수준이다.
 */
export async function geocodeAddress(
  roadAddress: string,
  parcelAddress: string,
  apiKey: string,
  cache: GeocodeCache,
  stats: GeocodeStats,
): Promise<GeocodePoint | null> {
  const cacheKey = `${roadAddress}||${parcelAddress}`;
  if (cacheKey in cache) {
    stats.hitCache++;
    return cache[cacheKey];
  }

  let road: GeocodePoint | null = null;
  try {
    road = roadAddress ? await callGeocoder(roadAddress, "road", apiKey) : null;
  } catch (err) {
    if (err instanceof GeocodeNetworkError) {
      stats.networkFailed++;
      stats.networkFailedAddresses.push(roadAddress || parcelAddress);
      return null; // 캐시에 쓰지 않는다 — 다음 실행에서 재시도된다.
    }
    throw err;
  }

  let result: GeocodePoint | null = road;

  try {
    if (road) {
      stats.roadOk++;
      if (parcelAddress) {
        const parcel = await callGeocoder(parcelAddress, "parcel", apiKey);
        if (parcel) {
          const meters = distanceMeters(road, parcel);
          if (meters > 500) {
            stats.divergenceWarnings.push({
              road: roadAddress,
              parcel: parcelAddress,
              meters: Math.round(meters),
            });
          }
        }
      }
    } else if (parcelAddress) {
      const parcel = await callGeocoder(parcelAddress, "parcel", apiKey);
      if (parcel) {
        stats.parcelFallbackOk++;
        result = parcel;
      }
    }
  } catch (err) {
    if (err instanceof GeocodeNetworkError) {
      // 도로명은 이미 성공했다면(road) 그 결과는 유효하다 — 지번 폴백/발산체크 단계의
      // 네트워크 실패는 도로명 결과 자체를 무효화하지 않는다. road도 실패한 경우만
      // 아래에서 result가 null로 남아 networkFailed로 집계된다.
      if (!road) {
        stats.networkFailed++;
        stats.networkFailedAddresses.push(roadAddress || parcelAddress);
        return null;
      }
    } else {
      throw err;
    }
  }

  if (!result) {
    stats.failed++;
    stats.failedAddresses.push(roadAddress || parcelAddress);
  }

  cache[cacheKey] = result;
  return result;
}
