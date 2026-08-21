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

축제(`festival`, 전국문화축제표준데이터)는 로컬 파일이 아니라 data.go.kr OpenAPI를
`pageNo`/`numOfRows` 페이징으로 직접 호출하는 방식이라 레시피 시스템(로컬 파일 전용) 밖의
독립 스크립트(`build-festival.ts`)로 구현했습니다. `DATA_GO_KR_FESTIVAL_KEY`(`.env.local`)가
필요합니다:

```bash
pnpm build:data-builder:festival
```

이 스크립트는 **진행중 + 예정 축제만** 남기고 종료된 축제는 빌드 시점에 걸러냅니다
(`fstvlEndDate` < 오늘). 즉 결과가 실행 시점에 따라 달라지므로, 데이터가 오래되면(원본은
분기 단위 갱신) 주기적으로 재실행해서 결과를 다시 커밋해야 합니다.

같은 장소(좌표)에서 여러 축제가 열리는 경우(예: 한 공연장에서 축제가 여러 건 개최)가
실제로 꽤 있다(약 20%). 빌드타임에 병합하지 않고 개별 feature로 그대로 둔다 — 지도
쪽에서 겹친 지점을 spiderfy로 펼쳐서 선택하게 한다(`hooks/use-spiderfy.ts`). 병합하면
개별 항목의 홈페이지/전화 같은 링크가 뭉개지고 지도 위에서 바로 선택할 수도 없어서다.

## 파이프라인

```
입력 읽기 (csv → BOM 제거/UTF-8 시도/cp949 폴백 + csv-parse, json → 배열 또는 { data: [...] })
  → 좌표 확보
      - coordinates.kind === "present": CSV 컬럼에서 위도/경도 직접 파싱
      - coordinates.kind === "geocode": V-World Geocoder 2.0 (도로명 우선, 지번 폴백)
  → 한반도 bbox 검증 (범위 이탈 시 드롭)
  → 좌표 5자리 절삭(~1.1m) + 문자열 NFC 정규화
  → (옵션) dedup: 반올림된 좌표가 같은 행들 중 완전 중복 행만 제거(병합은 하지 않음)
  → mapRow로 최종 속성 생성
  → public/data/<id>.<콘텐츠해시>.geojson + cache/<id>.stats.json 저장
```

`public/data/:path*`는 `next.config.ts`에서 1년 immutable 캐시를 쓰기 때문에, 파일명이
고정돼 있으면 재빌드로 데이터가 바뀌어도 이미 접속했던 브라우저는 옛 데이터를 계속 보게
됩니다. 그래서 출력 파일명에 콘텐츠 해시를 넣습니다(`lib/output.ts`의
`writeDatasetGeojson`) — 내용이 바뀌면 파일명도 바뀌고, `lib/map/datasets/data-manifest.json`의
해당 id 항목이 새 해시로 갱신됩니다. 데이터셋 정의(`lib/map/datasets/<id>.ts`)는 이 URL을
직접 쓰지 않고 `dataUrl(id)`(`lib/map/datasets/data-url.ts`)로 참조하므로, 별도 코드 수정 없이
재빌드 결과가 자동으로 반영됩니다. 이전 해시 파일은 빌드할 때마다 자동으로 정리됩니다.

같은 좌표에 여러 지점이 남아도(건물 단위 좌표, 우연히 같은 좌표로 반올림된 경우 등)
병합하지 않는다 — 개별 feature 그대로 두고, 지도 위에서 겹친 지점은 spiderfy로 펼쳐서
선택한다(`hooks/use-spiderfy.ts`, `lib/map/spiderfy.ts`). `dedup`은 좌표가 같은 행들
중 "완전히 같은 데이터가 중복 입력된 경우"만 제거하는 용도다.

레시피는 좌표가 **이미 컬럼에 존재한다는 것을 기본값**으로 삼습니다(`kind: "present"`).
공공데이터포털의 시설류 데이터셋은 대부분 위경도를 이미 제공하기 때문입니다. 주소만 있고
좌표가 없는 경우에만 `kind: "geocode"`로 명시적으로 전환하세요.

## 새 레시피 추가하기

`recipes/<id>.ts`에 `BuildRecipe`(타입: `lib/recipe-types.ts`) 상수 `recipe`를 export하면
끝입니다. 예시는 `recipes/toilet-gyeonggi.ts`(좌표 존재 + dedup 사용) /
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
