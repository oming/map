import { decodeCsvBuffer } from "./encoding.js";
import { parseCsv } from "./csv.js";

export type InputFormat = "csv" | "json";

/**
 * csv/json 모두 Record<string,string>[]로 통일해 반환한다 — 이후 파이프라인
 * (좌표 확보/dedup/mapRow)이 입력 포맷을 몰라도 되게 하기 위해서다.
 */
export function readInputRows(
  format: InputFormat,
  buf: Buffer,
): Record<string, string>[] {
  if (format === "csv") {
    return parseCsv(decodeCsvBuffer(buf));
  }

  // 공공데이터포털 JSON 다운로드는 배열이거나 { data: [...] } 형태가 흔하다 —
  // 실제 데이터셋이 생기면 이 관대한 처리를 그 응답 모양에 맞춰 조정한다.
  const parsed: unknown = JSON.parse(buf.toString("utf8"));
  const records = Array.isArray(parsed)
    ? parsed
    : (parsed as { data?: unknown[] } | null)?.data;
  if (!Array.isArray(records)) {
    throw new Error("JSON 입력이 배열 또는 { data: [...] } 형태가 아닙니다.");
  }

  return records.map((rec) => {
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      rec as Record<string, unknown>,
    )) {
      row[key] = value == null ? "" : String(value);
    }
    return row;
  });
}
