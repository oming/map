# Sprite Builder — V-World API 통합 스프라이트 빌더

POI 아이콘 스프라이트를 MapLibre sprite 형식으로 생성하는 도구입니다.

## 개요

MapLibre GL JS에서 POI(관심 장소) 아이콘을 렌더링하기 위해 필요한 **스프라이트(Sprite)** 파일을 생성합니다. 스프라이트는 여러 작은 이미지를 하나의 큰 이미지와 매핑 파일에 정리하는 형식입니다.

V-World API에서 `vectorStylePoi.js`를 **자동 다운로드** → Node.js로 JSON 추출 → Python으로 스프라이트 패킹까지 **단일 파이프라인**으로 처리합니다.

## 사용법

```bash
# 전체 파이프라인 실행 (API 다운로드 → 추출 → 스프라이트 생성)
cd tools/sprite-builder
./run.sh

# 또는 Python 스크립트 직접 실행 (run.sh이 env를 설정하지 않음)
VWORLD_API_KEY=your-key python3 build_sprite.py
```

### 파이프라인 흐름

```
V-World API (vectorStylePoi.js)
    │  https://api.vworld.kr/req/wmts/vector/getStyle/{key}/vectorStylePoi
    ├─→ download (Python urllib)  →  vectorStylePoi.js 저장
    │
    ├─→ extract_style.js (Node.js)  →  StyleJson() JSON 추출 (stdout)
    │
    └─→ build_sprite.py (Python + Pillow + cairosvg)
        ├─→ /public/sprite/sprite.png  (아이콘 시트)
        └─→ /public/sprite/sprite.json  (좌표 매핑)
```

### 출력 파일

| 경로 | 설명 |
|------|------|
| `/public/sprite/sprite.png` | 아이콘 스프라이트 시트 (1x) |
| `/public/sprite/sprite.json` | cl_id → 좌표 매핑 JSON |

원본 출력파일을 복사하여 sprite@2x.json, sprite@2x.png 을 추가 생성

### 필요 환경 변수

- `VWORLD_API_KEY` — V-World API 키 (`.env.local`에서 자동 읽기)

### 필요 패키지

```bash
pip install Pillow cairosvg
```

## 출력 형식

```
public/sprite/
├── sprite.png          # 아이콘 이미지 (스프라이트 시트)
└── sprite.json         # 각 cl_id → 위치 매핑
```

### sprite.json 구조 예시

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

## 관련 도구

- [style-builder](../style-builder/) — POI 스타일 변환기 (icon-image 매핑에 사용)
- [glyph-builder](../glyph-builder/) — 폰트 파일 생성

## 참고 사항

- MapLibre는 스프라이트의 `pixelRatio`를 1로 가정합니다.
- 각 cl_id는 스프라이트 내에서 고유한 위치 (x, y) 에 매핑되어야 합니다.
- icon-offset 계산 정확도를 위해 style-builder에서 sprite.json 제공을 권장합니다.
