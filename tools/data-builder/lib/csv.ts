import { parse } from "csv-parse/sync";

/**
 * naive split(",")는 따옴표 안 쉼표(예: "미나리광시장(1호,2호)")에서 확실히 깨진다 —
 * csv-parse가 필수인 이유. relax_column_count로 지자체별 컬럼 수 오차를 허용하고
 * 거부된 행은 호출자가 세도록 결과 행 수를 그대로 반환한다.
 */
export function parseCsv(text: string): Record<string, string>[] {
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  }) as Record<string, string>[];
}
