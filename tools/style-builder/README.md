# Style Builder — POI 스타일 변환기

V-World OpenLayers 스타일을 MapLibre symbol layer JSON으로 변환하는 도구입니다.

## 개요

이 도구는 V-World의 벡터 타일에 포함된 POI(관심 장소) 데이터를 MapLibre GL JS에서 렌더링할 수 있는 형식으로 변환합니다.

### 핵심 기능

- **스타일 파싱**: V-World OpenLayers 스타일 JS 파일 (`function StyleJson()`) 파싱
- **클러스터링**: 동일한 스타일을 공유하는 cl_id들을 그룹화하여 레이어 수 최소화 (674개 cl_id → 실제 필요한 레이어 수)
- **좌표계 변환**: OpenLayers anchor(0~1) → MapLibre icon-offset(px) 변환
- **폰트 매핑**: V-World 폰트 코드 → 나눔고딕 Regular/Bold/ExtraBold 조합
- **텍스트 정렬**: 수직/수평 코드를 MapLibre text-anchor 하나로 통합

## 사용법

```bash
# 실행 (run.sh 사용)
cd tools/style-builder
./run.sh

# 또는 직접 Node.js로 실행
node extract-vworld-poi-style.js <vworld-style-js-path> [sprite.json path] [output dir]

# 예시
node extract-vworld-poi-style.js ./vectorStylePoi.js ./sprite_result/sprite.json ./out
```

## 입력 파일

| 파일 | 설명 | 필수 |
|------|------|------|
| `vectorStylePoi.js` | V-World OpenLayers 스타일 정의 파일 | ✅ |
| `sprite.json` | POI 아이콘 스프라이트 매핑 (선택) | ❌ |

### sprite.json 옵션

- **제공 시**: icon-offset 정확히 계산 (OpenLayers anchor 기준)
- **미제공 시**: 모든 아이콘을 `icon-anchor: "center"` + `icon-offset: [0, 0]` 적용
- 대부분의 cl_id는 실제로 0.5, 0.5이므로 큰 차이 없으나, 일부 아이콘은 어긋날 수 있음

## 출력 파일

| 파일 | 설명 | 용도 |
|------|------|------|
| `poi-layers.json` | MapLibre symbol layers 배열 | **최종 출력물** - `app/data/poi-layers.json`으로 복사 |
| `poi-style-by-clid.json` | cl_id별 스타일 매핑 | 디버깅/참고용 원본 매핑 |

## 변환 로직 상세

### 1. 스타일 파싱 (`loadStyleJsonSource`)

```javascript
// V-World JS 파일에서 function StyleJson() 함수의 return 객체 추출
// "function StyleJson" → "return" → "{" 위치 찾음
// "}\r\n}" 또는 "}\n}" 패턴으로 객체 끝 식별
```

### 2. cl_id별 스타일 정규화 (`normalizeAll`)

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
- **sprite.json 필요성**: icon-offset 정확도를 위해 sprite.json 제공을 권장합니다.
- **폰트 파일**: `/public/font/*`에 나눔고딕 3종 (Regular/Bold/ExtraBold) 이 있어야 합니다.
- **스프라이트 파일**: `/public/sprite/*` 에 POI 아이콘 스프라이트가 있어야 합니다.

## 관련 도구

- [glyph-builder](../glyph-builder/) — 폰트 파일 생성
- [sprite-builder](../sprite-builder/) — 스프라이트 파일 생성
