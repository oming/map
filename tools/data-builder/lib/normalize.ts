import { pick } from "./geojson.js";

// 원본 데이터의 "값 없음" 자리표시자 — ":~:" (개방시간 미기재), "-" 단독 표기,
// 구분류 컬럼의 "N"(범주형 값이 아니라 단순 미기재 표시) 등. 화면에 그대로
// 노출하면 사용자가 실제 값으로 오해하므로 빈 값으로 취급한다.
const PLACEHOLDER_VALUES = new Set([":~:", "-", "N"]);

export function pickMeaningful(row: Record<string, string>, key: string): string {
  const value = pick(row, key);
  return PLACEHOLDER_VALUES.has(value) ? "" : value;
}
