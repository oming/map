# Map Resources Builder (tools/)

V-World 벡터 타일 기반 지도 애플리케이션에서 사용하는 **맵 리소스 빌드 도구** 모음입니다.

## 개요

이 디렉토리는 V-World OpenLayers 스타일을 MapLibre 형식으로 변환하고, 필요한 폰트와 스프라이트를 생성하는 도구들을 포함합니다.

### 워크플로우

```
V-World OpenLayers 스타일 JS 파일 (vectorStylePoi.js)
        ↓
  tools/shared/ (다운로드 + StyleJson() 파싱 — 두 도구가 공유)
        ↓
  ┌─────────────────────────────┬──────────────────────────────┐
  │ tools/sprite-builder/         │ tools/style-builder/          │
  │ (POI 아이콘 스프라이트 생성)  │ (POI 스타일 변환, sprite.json │
  │        ↓                     │  필요 — sprite-builder 이후 실행)│
  │  /public/sprite/*             │        ↓                      │
  └─────────────────────────────┴──────────────────────────────┘
                                          ↓
                                   data/poi-layers.json
                                          ↓
                                 MapLibre 렌더링 (클라이언트 사이드)

tools/glyph-builder/ (나눔고딕 폰트 생성 — 수동/외부 프로세스)
        ↓
  /public/font/*
```

---

## 하위 디렉토리

### [shared/](./shared/) — 공용 모듈

`sprite-builder`와 `style-builder`가 함께 쓰는 코드. 둘 다 같은 V-World `vectorStylePoi.js`를 내려받아 같은 `StyleJson()` 함수를 파싱하기 때문에 이 부분을 공용화했습니다.

- `.env.local` 로딩 (`env.ts`)
- V-World 스타일 다운로드 (`download-style.ts`)
- `StyleJson()` 실행/파싱 — eval 서브프로세스 방식 (`extract-style.ts` + `extract-style.cjs`)
- 프로젝트 루트 탐색 (`project-root.ts`)
- 공용 타입 (`types.ts`)

실행 진입점이 아니므로 `package.json`은 없고, 에디터 타입체크용 `tsconfig.json`만 있습니다.

### [style-builder/](./style-builder/) — POI 스타일 변환기 ✅

V-World OpenLayers 스타일을 MapLibre symbol layer JSON으로 변환합니다.

**주요 기능**:
- V-World 스타일 파일 파싱 (OpenLayers → MapLibre)
- cl_id별 스타일 클러스터링 (레이어 수 최소화)
- 좌표계 변환 (OpenLayers anchor → MapLibre icon-offset)
- 폰트 매핑 (V-World 코드 → 나눔고딕 조합)

**출력**: `data/poi-layers.json` (MapLibre layers 배열에 직접 삽입 가능)

---

### [sprite-builder/](./sprite-builder/) — 스프라이트 빌더 ✅

POI 아이콘 스프라이트를 생성합니다.

**역할**: V-World POI 아이콘을 MapLibre sprite 형식으로 변환

**출력 위치**: `/public/sprite/*`

---

### [glyph-builder/](./glyph-builder/) — 폰트 빌더 🔧 수동 프로세스

MapLibre용 글리프(폰트) 파일을 생성합니다. **자동화된 스크립트가 아니라, 수동으로 외부 웹사이트(maplibre.org/font-maker)를 사용하는 워크플로우**입니다 — 자세한 절차는 [glyph-builder/README.md](./glyph-builder/README.md) 참고.

**지원 폰트**:
- 나눔고딕 Regular
- 나눔고딕 Bold
- 나눔고딕 ExtraBold

**출력 위치**: `/public/font/*`

---

## 개발 참고

- 각 도구는 독립적으로 실행 가능하며, 필요 시 재생성 가능합니다.
- `style-builder`가 `data/poi-layers.json`에 직접 저장하며, 애플리케이션(`app/vworld.json/route.ts`)이 이 파일을 그대로 import합니다.
- `style-builder`는 `sprite-builder`가 생성한 `public/sprite/sprite.json`을 참조하므로 sprite-builder를 먼저 실행해야 합니다.
- 폰트와 스프라이트는 `/public/` 디렉토리에 정적 파일로 제공됩니다.

---

## pnpm 스크립트

프로젝트 루트에서 다음 명령어로 실행할 수 있습니다:

```bash
pnpm build:style-builder   # POI 스타일 변환만 실행 (tsx tools/style-builder/build.ts)
pnpm build:sprite-builder  # 스프라이트 생성만 실행 (tsx tools/sprite-builder/build.ts)
pnpm build:tools           # sprite-builder → style-builder 순서로 모두 실행
```

> `build:glyph-builder`는 현재 미구현 상태입니다 (glyph-builder는 수동 프로세스이므로 자동화 스크립트가 없습니다).

---

## 상태

| 도구 | 상태 | 설명 |
|------|------|------|
| style-builder | ✅ 완료 | V-World POI 스타일 변환, TypeScript 파이프라인 |
| sprite-builder | ✅ 완료 | V-World POI 아이콘 스프라이트 생성, TypeScript 파이프라인 |
| glyph-builder | 🔧 수동 프로세스 | 자동화 스크립트 없음, 외부 웹사이트 기반 수동 워크플로우 |
