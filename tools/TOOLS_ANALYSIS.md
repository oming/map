# tools 디렉토리 스타일 관련 도구 분석 보고서

## 개요

`tools/` 디렉토리는 V-World OpenLayers 벡터 타일 POI 데이터를 MapLibre GL JS에서 렌더링할 수 있는 형식으로 변환하는 3가지 도구를 포함합니다.

---

## 1. style-builder (POI 스타일 변환기) ✅ 구현 완료

### 위치
`tools/style-builder/`

### 핵심 기능
V-World OpenLayers POI 스타일을 MapLibre symbol layer JSON으로 변환합니다.

### 주요 파일
- `extract-vworld-poi-style.js` (~13KB) - 핵심 변환 로직
- `run.sh` - 실행 스크립트
- `poi-layers.json` (~540KB) - **최종 출력물** (MapLibre symbol layers 배열)
- `poi-style-by-clid.json` (~322KB) - cl_id별 스타일 매핑 (디버깅용)

### 실행 방법
```bash
cd tools/style-builder
./run.sh
# 또는 직접:
node extract-vworld-poi-style.js <vworld-style-js-path> [sprite.json path] [output dir]
```

### 변환 로직 상세

#### 1. 스타일 파싱 (`loadStyleJsonSource`)
- V-World JS 파일에서 `function StyleJson()` 함수의 return 객체 추출
- `"function StyleJson"` → `"return"` → "{" 위치 찾음
- `"}\r\n}"` 또는 `"}\n}"` 패턴으로 객체 끝 식별

#### 2. cl_id별 스타일 정규화 (`normalizeAll`)
- **아이콘**: sprite 키 = cl_id (이미 만들어둔 sprite와 동일한 규칙 가정)
- **icon-scale**: `symbolScaleCn` 값 직접 사용
- **icon-offset**: OpenLayers anchor(0~1) → MapLibre pixel offset 변환
  ```javascript
  iconOffset = [
    Math.round((centerX - 0.5) * frame.width),
    Math.round((centerY - 0.5) * frame.height)
  ]
  ```

#### 3. 폰트 매핑 (`resolveFontFamily`)
| V-World 폰트 코드 | MapLibre 폰트 | Bold 여부 |
|------------------|---------------|-----------|
| `Nanum_Gothic_Extra_Bold` | NanumGothic ExtraBold | 항상 ExtraBold |
| `Nanum_Gothic` | NanumGothic Regular/Bold | `lblThikAt === 'Y'` 여부 |
| (없음/기본) | NanumGothic | `lblThikAt === 'Y'` 여부 |

#### 4. 텍스트 정렬 (`mapTextAnchor`)
V-World는 수직(lblCtrlpntVrticlCode)과 수평(lblCtrlpntWidthCode)을 따로 가지므로, 두 값을 조합:

| 수직 + 수평 | MapLibre text-anchor |
|------------|---------------------|
| top + left | `top-left` |
| middle + center | `center` |
| bottom + right | `bottom-right` |
| (기타) | `center` (기본값) |

#### 5. 레이어 생성 (`buildLayers`)
- 동일한 스타일(아이콘+텍스트)을 공유하는 cl_id들을 그룹화
- **클러스터링**: 674개 cl_id → 실제 필요한 레이어 수로 최소화 (성능 + 유지보수)

```javascript
// 동일한 스타일을 공유하는 cl_id들 묶기
const signature = JSON.stringify({
  icon: n.icon,
  iconScale: n.iconScale,
  iconOffset: n.iconOffset,
  label: label,
});
```

### 필터링 규칙

#### VISIBILITY_FILTER
```javascript
["==", ["get", "poi_eprss_at"], "Y"]
```
- `poi_eprss_at === 'Y'`인 POI만 노출 (브이월드가 명시적으로 "노출 안 함"으로 표시한 값 제외)

#### 줌레벨 처리
- **zoom 필터 없음**: MapLibre 기본 동작(symbol layer의 icon/text-allow-overlap 기본값 false로 인한 자동 충돌 회피)과 타일 서버가 이미 내려주는 feature 밀도에 맡김
- V-World의 `mumm_level/mxmm_level` 같은 줌 범위 속성은 사용하지 않음 (원본 OpenLayers 화면과 시점이 맞지 않아 제거됨)

### 출력 예시 구조
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

### 개발 참고
- **클러스터링**: 동일한 스타일의 cl_id들을 묶어서 레이어 수를 최소화합니다 (성능 + 유지보수).
- **sprite.json 필요성**: icon-offset 정확도를 위해 sprite.json 제공을 권장합니다.
- **폰트 파일**: `/public/font/*`에 나눔고딕 3종 (Regular/Bold/ExtraBold) 이 있어야 합니다.
- **스프라이트 파일**: `/public/sprite/*` 에 POI 아이콘 스프라이트가 있어야 합니다.

---

## 2. glyph-builder (폰트 빌더) ⚠️ 미구현

### 위치
`tools/glyph-builder/`

### 현재 상태
README만 있고 실제 코드 파일이 없습니다.

### 필요 기능
MapLibre용 글리프(폰트) 파일을 생성합니다.

### 지원 폰트
| 폰트 패밀리 | 굵기 (Weight) | 파일명 패턴 |
|------------|--------------|-------------|
| NanumGothic | Regular (400) | `NanumGothic-400.pbf` |
| NanumGothic | Bold (700) | `NanumGothic-700.pbf` |
| NanumGothic | ExtraBold (800) | `NanumGothic-800.pbf` |

### 실행 방법 (수동)
```bash
# font-maker 도구 설치 후 실행
maplibre-font-maker \
  --font-file NanumGothic-Regular.otf \
  --output ./out \
  --range-start 0 \
  --range-end 65535

# Bold, ExtraBold도 동일하게 생성
```

### 출력 위치
```
/Users/anhyosang/Developer/map.qwer.dev/public/font/
├── NanumGothic-400.pbf      # Regular
├── NanumGothic-700.pbf      # Bold
└── NanumGothic-800.pbf      # ExtraBold
```

### 관련 도구
- [style-builder](./style-builder/) — 폰트 매핑에 사용

---

## 3. sprite-builder (스프라이트 빌더) ⚠️ 미구현

### 위치
`tools/sprite-builder/`

### 현재 상태
README만 있고 실제 코드 파일이 없습니다. **미완료 상태**로 명시되어 있습니다.

### 필요 기능
MapLibre GL JS에서 POI(관심 장소) 아이콘을 렌더링하기 위해 필요한 스프라이트(Sprite) 파일을 생성합니다.

### 구현 계획 (TODO)
- [ ] V-World POI 아이콘 이미지 소스 파악
- [ ] 이미지 추출 로직 개발 (`cl_id` 기반, `symbolImageCn` 참조)
- [ ] 스프라이트 시트 생성 알고리즘 구현 (여러 작은 아이콘 → 하나의 큰 PNG)
- [ ] sprite.json 매핑 파일 자동 생성 (각 `cl_id` → 스프라이트 내 위치 매핑)
- [ ] style-builder와 통합 테스트

### 출력 형식
```
/Users/anhyosang/Developer/map.qwer.dev/public/sprite/
├── sprite.png          # 아이콘 이미지 (스프라이트 시트)
└── sprite.json         # 각 cl_id → 위치 매핑
```

#### sprite.json 구조 예시
```json
{
  "cl_001": {
    "width": 32,
    "height": 32,
    "pixelRatio": 1
  },
  "cl_002": {
    "width": 24,
    "height": 24,
    "pixelRatio": 1
  }
}
```

### 현재 사용 중인 스프라이트
현재 프로젝트에서는 `app/vworld.json/route.ts` 에서:
```javascript
const style = {
  sprite: `${publicUrl}/sprite/sprite`,
  // ...
};
```
이렇게 참조하며, `/public/sprite/` 디렉토리에 **수동으로 배치된 파일**을 사용합니다.

### 관련 도구
- [style-builder](./style-builder/) — icon-image 매핑에 사용
- [glyph-builder](./glyph-builder/) — 폰트 파일 생성

---

## 종합 분석

### 현재 상태
1. **style-builder**: ✅ 완전 구현됨 - V-World 스타일을 MapLibre 형식으로 변환하는 핵심 도구
2. **glyph-builder**: ⚠️ 미구현 - README만 있고 실제 코드 없음
3. **sprite-builder**: ⚠️ 미구현 (미완료) - README만 있고 실제 코드 없음

### 의존성 관계
```
style-builder (핵심)
  ├── glyph-builder 필요 (폰트 파일: /public/font/*)
  └── sprite-builder 필요 (스프라이트 파일: /public/sprite/*)
```

### 핵심 인사이트
1. **style-builder는 이미 완성됨**: V-World OpenLayers 스타일을 MapLibre symbol layers로 변환하는 모든 로직이 구현되어 있음
2. **클러스터링 최적화**: 674개 cl_id를 실제 필요한 레이어 수로 최소화하여 성능 개선
3. **sprite.json 선택적**: icon-offset 정확도를 위해 권장하지만, 없으면 기본값(center) 사용
4. **glyph-builder와 sprite-builder는 수동 작업**: 현재 프로젝트에서는 `/public/font/`와 `/public/sprite/`에 수동으로 배치된 파일들을 사용

### 다음 단계 제안
1. **sprite-builder 구현 우선순위 높임**: icon-offset 정확도를 위해 필요
2. **glyph-builder 자동화**: font-maker 도구 호출 스크립트 작성
3. **통합 테스트**: style-builder → glyph-builder → sprite-builder 전체 파이프라인 테스트
