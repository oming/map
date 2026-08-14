# Style Builder — V-World API 통합 POI 스타일 변환기

V-World OpenLayers 스타일을 MapLibre symbol layer JSON으로 **자동 변환**하는 도구입니다.

## 개요

이 도구는 V-World의 벡터 타일에 포함된 POI(관심 장소) 데이터를 MapLibre GL JS에서 렌더링할 수 있는 형식으로 변환합니다.

**수동 파일 준비가 필요 없습니다.** `pnpm build:style-builder` 한 번으로 V-World API에서 스타일을 자동 다운로드하고, MapLibre symbol layer JSON(`data/poi-layers.json`)을 생성합니다.

### 핵심 기능

- **자동 다운로드**: V-World API에서 `vectorStylePoi.js`를 자동으로 가져옴 (`tools/shared/download-style.ts`)
- **클러스터링**: 동일한 스타일을 공유하는 cl_id들을 그룹화하여 레이어 수 최소화 (674개 cl_id → 실제 필요한 레이어 수)
- **좌표계 변환**: OpenLayers anchor(0~1) → MapLibre icon-offset(px) 변환 (기존 sprite.json 활용)
- **폰트 매핑**: V-World 폰트 코드 → 나눔고딕 Regular/Bold/ExtraBold 조합
- **텍스트 정렬**: 수직/수평 코드를 MapLibre text-anchor 하나로 통합

## 사용법

```bash
# 프로젝트 루트에서
pnpm build:style-builder

# 또는 직접 실행
cd tools/style-builder
tsx build.ts
```

### 파이프라인 흐름

```
V-World API (vectorStylePoi.js)
    │  tools/shared/download-style.ts
    ├─→ tools/shared/extract-style.ts  →  StyleJson() 실행 결과 (cl_id별 아이콘/라벨 정의)
    │
    └─→ lib/style.ts (normalizeAll → buildLayers)  →  MapLibre symbol layers 추출
        └─→ lib/write.ts  →  data/poi-layers.json
```

### 출력 파일

| 경로 | 설명 |
|------|------|
| `data/poi-layers.json` | **최종 출력물** — MapLibre symbol layers 배열 |

### 필요 환경 변수

- `VWORLD_API_KEY` — V-World API 키 (`.env.local`에서 자동 읽기)

## 의존 관계

| 도구 | 역할 | 선행 작업 필요? |
|------|------|----------------|
| [sprite-builder](../sprite-builder/) | 스프라이트 파일 생성 (`public/sprite/sprite.json`) | `./run.sh` 실행 |

`build.ts`는 sprite-builder가 생성한 `public/sprite/sprite.json`을 참조하여 icon-offset 계산을 수행합니다.

> **순서**: 먼저 `pnpm build:sprite-builder`로 스프라이트를 생성한 후, `pnpm build:style-builder`를 실행하세요. (`pnpm build:tools`가 이 순서를 그대로 수행합니다.)

## 변환 로직 상세

V-World 스타일 파일(`vectorStylePoi.js`)의 `StyleJson()` 실행 결과를 파싱하는 부분은 `tools/shared/extract-style.ts` + `extract-style.cjs`가 담당합니다 (실제 V8 엔진으로 코드를 실행해 `StyleJson()` 반환값을 뽑아내는 방식 — sprite-builder와 공유). 아래는 그 결과를 받아 MapLibre 레이어로 변환하는 `lib/style.ts`의 로직입니다.

### 1. cl_id별 스타일 정규화 (`normalizeAll`)

- **아이콘**: sprite 키 = cl_id (이미 만들어둔 sprite와 동일한 규칙 가정)
- **icon-scale**: `symbolScaleCn` 값 직접 사용
- **icon-offset**: OpenLayers anchor(0~1) → MapLibre pixel offset 변환
  ```javascript
  iconOffset = [
    Math.round((centerX - 0.5) * frame.width),
    Math.round((centerY - 0.5) * frame.height)
  ]
  ```

### 3. 폰트 매핑 (`resolveFontFamily`)

| V-World 폰트 코드 | MapLibre 폰트 | Bold 여부 |
|------------------|---------------|-----------|
| `Nanum_Gothic_Extra_Bold` | NanumGothic ExtraBold | 항상 ExtraBold |
| `Nanum_Gothic` | NanumGothic Regular/Bold | `lblThikAt === 'Y'` 여부 |
| (없음/기본) | NanumGothic | `lblThikAt === 'Y'` 여부 |

### 4. 텍스트 정렬 (`mapTextAnchor`)

V-World는 수직(lblCtrlpntVrticlCode)과 수평(lblCtrlpntWidthCode)을 따로 가지므로, 두 값을 조합:

| 수직 + 수평 | MapLibre text-anchor |
|------------|---------------------|
| top + left | `top-left` |
| middle + center | `center` |
| bottom + right | `bottom-right` |
| (기타) | `center` (기본값) |

### 5. 레이어 생성 (`buildLayers`)

```javascript
// 동일한 스타일(아이콘+텍스트)을 공유하는 cl_id들을 그룹화
const signature = JSON.stringify({
  icon: n.icon,
  iconScale: n.iconScale,
  iconOffset: n.iconOffset,
  label: label,
});

// 그룹별 레이어 생성
filter: [
  "all",
  ["in", ["get", "cl_id"], ["literal", clIds]],  // 해당 cl_id들만 렌더링
  VISIBILITY_FILTER,                               // poi_eprss_at === 'Y' 필터
]
```

## 필터링 규칙

### VISIBILITY_FILTER
```javascript
["==", ["get", "poi_eprss_at"], "Y"]
```
- `poi_eprss_at === 'Y'`인 POI만 노출 (브이월드가 명시적으로 "노출 안 함"으로 표시한 값 제외)

### 줌레벨 처리
- **zoom 필터 없음**: MapLibre 기본 동작(symbol layer의 icon/text-allow-overlap 기본값 false로 인한 자동 충돌 회피)과 타일 서버가 이미 내려주는 feature 밀도에 맡김
- V-World의 `mumm_level/mxmm_level` 같은 줌 범위 속성은 사용하지 않음 (원본 OpenLayers 화면과 시점이 맞지 않아 제거됨)

## 출력 예시 (poi-layers.json 구조)

```json
[
  {
    "id": "poi-normal-1",
    "type": "symbol",
    "source": "vworldPoi",
    "source-layer": "poi",
    "filter": [
      "all",
      ["in", ["get", "cl_id"], ["literal", ["cl_001", "cl_002"]]],
      ["==", ["get", "poi_eprss_at"], "Y"]
    ],
    "layout": {
      "text-field": ["get", "poi_eprss_nm"],
      "text-font": ["NanumGothic Regular"],
      "text-size": 10,
      "text-anchor": "center",
      "text-justify": "center",
      "text-offset": [0, 0],
      "text-max-width": 8,
      "icon-image": "cl_001",
      "icon-size": 1,
      "icon-offset": [2, -3],
      "icon-allow-overlap": true,
      "text-optional": true
    },
    "paint": {
      "text-color": "#333333",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.4
    }
  }
]
```

## 개발 참고

- **클러스터링**: 동일한 스타일의 cl_id들을 묶어서 레이어 수를 최소화합니다 (성능 + 유지보수).
- **sprite.json 필요성**: icon-offset 정확도를 위해 sprite-builder에서 생성한 `public/sprite/sprite.json`을 사용합니다.
- **폰트 파일**: `/public/font/*`에 나눔고딕 3종 (Regular/Bold/ExtraBold) 이 있어야 합니다.
- **스프라이트 파일**: `/public/sprite/*` 에 POI 아이콘 스프라이트가 있어야 합니다.
- **공용 모듈**: `.env.local` 로딩, V-World 스타일 다운로드, `StyleJson()` 파싱, 프로젝트 루트 탐색은 `tools/shared/`에 있으며 [sprite-builder](../sprite-builder/)와 공유합니다.

## 관련 도구

- [glyph-builder](../glyph-builder/) — 폰트 파일 생성
- [sprite-builder](../sprite-builder/) — 스프라이트 파일 생성 (style-builder의 icon-offset 계산에 사용)
