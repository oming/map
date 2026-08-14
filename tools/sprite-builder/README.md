# Sprite Builder — V-World POI 아이콘 스프라이트 생성기

V-World OpenLayers 스타일에 포함된 POI 아이콘을 MapLibre GL JS의 스프라이트 형식으로 **자동 변환**하는 도구입니다.

## 개요

V-World 벡터 타일 스타일 정의(`vectorStylePoi.js`)에는 각 POI(`cl_id`)의 아이콘이 base64 데이터 URI(SVG 또는 raster)로 포함되어 있습니다. 이 도구는 API에서 스타일 파일을 자동으로 내려받아 모든 아이콘을 디코딩하고, 하나의 스프라이트 이미지로 패킹합니다.

### 핵심 기능

- **자동 다운로드**: V-World API에서 `vectorStylePoi.js`를 자동으로 가져옴 (`tools/shared/download-style.ts`)
- **아이콘 디코딩**: SVG는 `@resvg/resvg-js`, raster는 `sharp`로 PNG 변환
- **스프라이트 패킹**: shelf 방식 bin-packing (`tools/sprite-builder/lib/pack.ts`)

## 사용법

```bash
# 프로젝트 루트에서
pnpm build:sprite-builder

# 또는 직접 실행
cd tools/sprite-builder
tsx build.ts
```

### 파이프라인 흐름

```
V-World API (vectorStylePoi.js)
    │  tools/shared/download-style.ts
    ├─→ tools/shared/extract-style.ts  →  StyleJson() 실행 결과 (cl_id별 아이콘/라벨 정의)
    │
    └─→ lib/load-icons.ts  →  cl_id별 PNG 디코딩
        └─→ lib/pack.ts  →  스프라이트 이미지로 패킹
            └─→ lib/write.ts  →  public/sprite/*
```

### 출력 파일

| 경로 | 설명 |
|------|------|
| `public/sprite/sprite.png`, `sprite.json` | 스프라이트 이미지 + 좌표 매핑 |
| `public/sprite/sprite@2x.png`, `sprite@2x.json` | 1x 파일의 복사본 (아래 알려진 제한사항 참고) |

### 필요 환경 변수

- `NEXT_PUBLIC_VWORLD_API_KEY` — `.env.local`에서 자동 읽기

## 알려진 제한사항

- `sprite@2x.*`는 실제 2배 해상도로 렌더링된 파일이 아니라 1x 파일의 복사본입니다. 고해상도 디스플레이에서 아이콘이 흐리게 보일 수 있습니다.

## 의존 관계

`tools/shared/`의 공용 모듈(`.env.local` 로딩, V-World 스타일 다운로드, `StyleJson()` 파싱, 프로젝트 루트 탐색)을 사용합니다 — 같은 스타일 소스를 파싱하는 [style-builder](../style-builder/)와 공유됩니다.

## 관련 도구

- [style-builder](../style-builder/) — POI 스타일(라벨/필터) 변환. `icon-offset` 계산 시 이 도구가 생성한 `sprite.json`을 사용합니다.
- [glyph-builder](../glyph-builder/) — 폰트 파일 생성
