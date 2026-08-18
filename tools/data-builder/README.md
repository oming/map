# Data Builder — 공공데이터 CSV → 데이터 레이어 GeoJSON 변환기

공공데이터포털에서 받은 원본 CSV를 지도 데이터 레이어(`lib/map/datasets/`)가 바로 쓸 수 있는
GeoJSON으로 변환하는 도구입니다. 좌표가 없는 데이터셋은 V-World Geocoder 2.0으로 지오코딩합니다.

## 사용법

**입력은 수동 배치입니다.** data.go.kr의 파일 다운로드 엔드포인트는 Referer/세션 게이팅이 걸려
있어 자동 다운로드가 불가능합니다. 원본 CSV를 직접 내려받아 배치하세요.

```bash
# 1. 원본 CSV를 배치
cp ~/Downloads/공중화장실정보_경기수원시.csv tools/data-builder/input/toilet-suwon.csv

# 2. 실행 (프로젝트 루트에서)
pnpm build:data-builder
```

## 파이프라인 (`toilet-suwon` 레시피)

```
CSV 읽기
  → BOM 제거 → UTF-8 디코드 시도 → U+FFFD 나오면 cp949 재디코드 (lib/encoding.ts)
  → csv-parse (relax_column_count)                                  (lib/csv.ts)
  → 지오코딩: 소재지도로명주소 + type=road, 실패 시 소재지지번주소 + type=parcel  (lib/geocode.ts)
  → 한반도 bbox 검증 (범위 이탈 시 드롭)                              (lib/geojson.ts)
  → 좌표 5자리 절삭(~1.1m) + 문자열 NFC 정규화
  → public/data/toilet-suwon.geojson 저장
```

## 지오코딩 캐시

`cache/geocode.json`은 **저장소에 커밋합니다.** 주소 문자열(`도로명||지번`)이 키이므로
재실행 시 API 호출이 0건입니다. 캐시가 없으면 첫 실행 시 588건 전체를 새로 호출합니다
(V-World Geocoder 2.0 일일 한도 40,000건 대비 무시할 수준, 동시성 4로 수 분 소요).

`cache/toilet-suwon.stats.json`도 함께 생성됩니다 — 실패한 주소 목록과, 도로명/지번
지오코딩 결과가 500m 이상 벌어진 경우의 경고 목록을 담고 있습니다. 실행 후 반드시
확인하세요. 조용한 드롭은 데이터를 모르고 잃는 방법입니다.

## 필요 환경 변수

- `NEXT_PUBLIC_VWORLD_API_KEY` — V-World API 키 (`.env.local`에서 자동 읽기)

## 왜 자동 CRS 재투영이 없는가

수원시 Wi-Fi/화장실 데이터셋은 WGS84(4326) 좌표만 다룹니다. 전국/타 지자체로 확장할 때
투영좌표계(5179/5186/5174)가 섞여 들어올 수 있는데, 그때 CRS 판정 휴리스틱과 `proj4`
재투영을 추가할 예정입니다 — 지금은 범위 밖입니다.

## 관련 도구

- [style-builder](../style-builder/) — 이 도구가 따르는 `tools/` 관례의 원본
- [tools/shared](../shared/) — `.env.local` 로딩, 프로젝트 루트 탐색 등 공용 모듈 공유
