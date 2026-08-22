import type { DetailFieldsSchema } from "@/components/map/data/detail-fields";

function toDateOnly(value: unknown): string {
  return String(value).slice(0, 10);
}

function toExposedLabel(value: unknown): string {
  return value === "Y" ? "노출" : "미노출";
}

/**
 * 대분류 → 세분류 순으로 값이 있는 단계만 걸러낸다. cl_id가 이 네 코드
 * (lclas_code+mlsfc_code+sclas_code+dclsf_code+atach_cl_code)를 그대로 이어붙인
 * 값과 실측 일치함을 확인했다 — 이 순서가 V-World의 실제 분류 계층 순서다.
 */
function getClassificationLevels(
  properties: Record<string, unknown>,
): string[] {
  return [
    properties.lclas_nm,
    properties.mlsfc_nm,
    properties.sclas_nm,
    properties.dclsf_nm,
  ].filter((v): v is string => typeof v === "string" && v !== "");
}

/**
 * 팝업(클릭 시 바로 뜨는 요약 카드)용. 원본 properties(30여개 필드, 실측 확인)를 그대로
 * 넘기면 내부 코드/id/날짜 필드까지 전부 auto-expose되므로, 여기서 먼저 원하는 필드만
 * 추려낸 객체를 만든다. "상세보기"를 누르면 대신 POI_FULL_DETAIL_SCHEMA + 원본
 * properties로 모든 필드를 보여준다(poi-sheet.tsx).
 */
export function toPoiSummaryProperties(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  return {
    poi_eprss_nm: properties.poi_eprss_nm,
    rn_adres: properties.rn_adres,
    rn_detail_adres: properties.rn_detail_adres,
    lnm_adres: properties.lnm_adres,
    lnm_detail_adres: properties.lnm_detail_adres,
    // 팝업은 간결하게 대>중>소까지만(세분류는 상세보기에서).
    classification: getClassificationLevels(properties).slice(0, 3).join(" > ") || undefined,
  };
}

export const POI_SUMMARY_SCHEMA: DetailFieldsSchema = {
  titleKey: "poi_eprss_nm",
  overrides: {
    rn_adres: { label: "도로명주소" },
    rn_detail_adres: { label: "도로명주소상세" },
    lnm_adres: { label: "지번주소" },
    lnm_detail_adres: { label: "지번주소상세" },
    classification: { label: "분류명" },
  },
};

/**
 * "상세보기" 시트(프로덕션)용 파생 properties. 대/중/소/세분류 개별 필드 대신
 * 하나의 분류명 브레드크럼("대분류 > 중분류 > 소분류 > 세분류")으로 합친다.
 */
export function toPoiFullDisplayProperties(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...properties,
    classification: getClassificationLevels(properties).join(" > ") || undefined,
  };
}

/**
 * "상세보기" 시트용. overrides는 dev/prod 스키마가 공유하는 단일 라벨 사전이다 —
 * prod에서 hiddenKeys로 숨긴 필드도 dev에서는 그대로 보이므로 전부 라벨을 붙여둔다.
 */
const POI_FIELD_OVERRIDES: DetailFieldsSchema["overrides"] = {
  poi_nm: { label: "공식명칭" },
  ncm_nm_1: { label: "별칭1" },
  ncm_nm_2: { label: "별칭2" },
  poi_id: { label: "POI ID" },
  intrstspot_id: { label: "관심지점 ID" },
  refrn_id: { label: "원천 데이터 참조 ID" },
  classification: { label: "분류명" },
  lclas_nm: { label: "대분류명" },
  mlsfc_nm: { label: "중분류명" },
  sclas_nm: { label: "소분류명" },
  dclsf_nm: { label: "세분류명" },
  cl_id: { label: "통합분류코드" },
  lclas_code: { label: "대분류 코드" },
  mlsfc_code: { label: "중분류 코드" },
  sclas_code: { label: "소분류 코드" },
  dclsf_code: { label: "세분류 코드" },
  atach_cl_code: { label: "부속분류 코드" },
  rn_adres: { label: "도로명주소" },
  rn_detail_adres: { label: "도로명주소상세" },
  rn_code: { label: "도로명코드" },
  lnm_adres: { label: "지번주소" },
  lnm_detail_adres: { label: "지번주소상세" },
  lnm_code: { label: "지번코드" },
  mumm_level: { label: "최소 노출 줌레벨" },
  mxmm_level: { label: "최대 노출 줌레벨" },
  cl_mumm_level: { label: "분류군 최소 노출 줌레벨" },
  cl_mxmm_level: { label: "분류군 최대 노출 줌레벨" },
  poi_eprss_at: { label: "지도 기본 노출 여부", format: toExposedLabel },
  dta_colct_dt: { label: "데이터 수집일", format: toDateOnly },
  object_change_dt: { label: "최종 변경일", format: toDateOnly },
  spainf_origin: { label: "공간정보의 출처" },
};

/**
 * 프로덕션 상세 시트. 분류는 classification 브레드크럼 한 행으로만 보여주고
 * 개별 대/중/소/세분류·내부 코드/id/줌레벨 필드는 숨긴다.
 */
export const POI_FULL_DETAIL_SCHEMA: DetailFieldsSchema = {
  titleKey: "poi_eprss_nm",
  overrides: POI_FIELD_OVERRIDES,
  hiddenKeys: [
    "poi_id",
    "intrstspot_id",
    "cl_id",
    "lclas_code",
    "mlsfc_code",
    "sclas_code",
    "dclsf_code",
    "atach_cl_code",
    "lclas_nm",
    "mlsfc_nm",
    "sclas_nm",
    "dclsf_nm",
    "rn_code",
    "lnm_code",
    "refrn_id",
    "mumm_level",
    "mxmm_level",
    "cl_mumm_level",
    "cl_mxmm_level",
    "poi_eprss_at",
    "ncm_nm_1",
    "ncm_nm_2",
  ],
};

/**
 * 개발 환경 전용. hiddenKeys 없이 원본 properties의 모든 필드(코드/id/줌레벨 포함,
 * 대/중/소/세분류도 각자 행으로)를 그대로 노출한다 — V-World가 실제로 어떤 필드를
 * 내려주는지 확인하는 디버깅 용도. classification 합성 필드는 쓰지 않는다.
 */
export const POI_FULL_DETAIL_SCHEMA_DEV: DetailFieldsSchema = {
  titleKey: "poi_eprss_nm",
  overrides: POI_FIELD_OVERRIDES,
};
