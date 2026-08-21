import type { InputFormat } from "./input.js";

export type CoordinateSpec =
  | { kind: "present"; latKey: string; lonKey: string }
  | { kind: "geocode"; roadAddressKey: string; parcelAddressKey?: string };

export interface DedupMergeSpec {
  /** 같은 좌표 그룹 안에서 완전 중복 행을 걸러내는 서명. */
  signature: (row: Record<string, string>) => string;
  /** 서명 중복 제거 후에도 2개 이상 남으면 호출된다 — 병합된 단일 Feature의 속성을 만든다. */
  mergeGroup: (
    rows: Record<string, string>[],
    lon: number,
    lat: number,
  ) => Record<string, unknown>;
}

export interface RowMeta {
  /** coordinates.kind === "geocode"일 때만 채워진다. */
  geocodeType?: "road" | "parcel";
}

export interface BuildRecipe {
  /** 출력 파일명(public/data/<id>.geojson, cache/<id>.stats.json)이자 레시피 파일명. */
  id: string;
  label: string;
  inputFile: string;
  inputFormat: InputFormat;
  /** 좌표가 이미 있는 데이터셋이 기본값(present) — 지오코딩(geocode)은 명시적 예외 경로. */
  coordinates: CoordinateSpec;
  mapRow: (row: Record<string, string>, meta: RowMeta) => Record<string, unknown>;
  /** 옵션 — 동일 반올림 좌표에 여러 행이 겹칠 때 완전중복 제거 + 다중 시설 병합. */
  dedupMerge?: DedupMergeSpec;
}
