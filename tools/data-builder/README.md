# Data Builder — 공공데이터 → 데이터 레이어 GeoJSON 변환기

공공데이터포털에서 받은 원본 CSV/JSON을 지도 데이터 레이어(`lib/map/datasets/`)가 바로 쓸 수 있는
GeoJSON으로 변환하는 도구입니다. 각 데이터셋은 `recipes/`에 있는 "레시피"(컬럼 매핑, 좌표
확보 방식, 중복 처리 규칙)로 선언하고, 공통 실행 로직(`lib/runner.ts`)이 실제 변환을 수행합니다.

## 사용법

**입력은 수동 배치입니다.** data.go.kr의 파일 다운로드 엔드포인트는 Referer/세션 게이팅이 걸려
있어 자동 다운로드가 불가능합니다. 원본 파일을 직접 내려받아 `input/<레시피id>.<확장자>`로
배치하세요 (레시피별 정확한 파일명은 `recipes/*.ts`의 `inputFile` 참고).

```bash
# 실행 (프로젝트 루트에서)
pnpm build:data-builder toilet-suwon
pnpm build:data-builder toilet-gyeonggi
pnpm build:data-builder wifi-suwon
```

맛집(`restaurant-suwon`)은 마크다운 표라는 단발성 입력 형식이라 레시피 시스템에 넣지 않고
독립 스크립트로 유지합니다:

```bash
pnpm build:data-builder:restaurant
```

## 파이프라인

```
입력 읽기 (csv → BOM 제거/UTF-8 시도/cp949 폴백 + csv-parse, json → 배열 또는 { data: [...] })
  → 좌표 확보
      - coordinates.kind === "present": CSV 컬럼에서 위도/경도 직접 파싱
      - coordinates.kind === "geocode": V-World Geocoder 2.0 (도로명 우선, 지번 폴백)
  → 한반도 bbox 검증 (범위 이탈 시 드롭)
  → 좌표 5자리 절삭(~1.1m) + 문자열 NFC 정규화
  → (옵션) dedupMerge: 반올림된 좌표가 같은 행들 중 완전 중복 제거 + 다중 시설 병합
  → mapRow (또는 병합 시 mergeGroup)로 최종 속성 생성
  → public/data/<id>.geojson + cache/<id>.stats.json 저장
```

레시피는 좌표가 **이미 컬럼에 존재한다는 것을 기본값**으로 삼습니다(`kind: "present"`).
공공데이터포털의 시설류 데이터셋은 대부분 위경도를 이미 제공하기 때문입니다. 주소만 있고
좌표가 없는 경우에만 `kind: "geocode"`로 명시적으로 전환하세요.

## 새 레시피 추가하기

`recipes/<id>.ts`에 `BuildRecipe`(타입: `lib/recipe-types.ts`) 상수 `recipe`를 export하면
끝입니다. 예시는 `recipes/toilet-gyeonggi.ts`(좌표 존재 + dedupMerge 사용) /
`recipes/toilet-suwon.ts`(지오코딩 사용) 참고.

## 지오코딩 캐시

`cache/geocode.json`은 **저장소에 커밋합니다.** 주소 문자열(`도로명||지번`)이 키이므로
데이터셋과 무관하게 공유되고, 재실행 시 API 호출이 0건입니다.

`cache/<id>.stats.json`도 함께 생성됩니다 — 실패한 주소 목록, 도로명/지번 발산(>500m) 경고,
동일좌표 중복/병합 통계를 담습니다. 실행 후 반드시 확인하세요. 조용한 드롭은 데이터를 모르고
잃는 방법입니다.

## 필요 환경 변수

- `NEXT_PUBLIC_VWORLD_API_KEY` — V-World API 키 (`.env.local`에서 자동 읽기, `coordinates.kind
  === "geocode"` 레시피에서만 필요)

## 왜 자동 CRS 재투영이 없는가

지금까지의 데이터셋은 WGS84(4326) 좌표만 다룹니다. 투영좌표계(5179/5186/5174)가 섞여 들어오는
데이터셋이 생기면 그때 CRS 판정 휴리스틱과 `proj4` 재투영을 추가할 예정입니다 — 지금은 범위
밖입니다.

## 관련 도구

- [style-builder](../style-builder/) — 이 도구가 따르는 `tools/` 관례의 원본
- [tools/shared](../shared/) — `.env.local` 로딩, 프로젝트 루트 탐색 등 공용 모듈 공유
