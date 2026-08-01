# Map QWER Dev

V-World 벡터 타일을 MapLibre GL JS로 렌더링하는 Next.js 기반 지도 애플리케이션입니다.

## 개요

이 프로젝트는 **Next.js 16**(App Router) + **MapLibre GL JS v6** + **React 19** 기반으로, V-World OpenAPI 벡터 타일과 POI(Points of Interest) 데이터를 클라이언트 사이드에서 렌더링합니다.

### 주요 기능

- **V-World 벡터 타일 렌더링** — 배경지도(raster) + POI(vector) + 교통정보(vector) 소스 동시 렌더링
- **커스텀 프로토콜 핸들러** — `reverse://` 프로토콜을 통해 V-World 벡타 타일 요청을 인터셉트하여 클라이언트 사이드에서 재처리
- **POI 클릭 팝업** — POI 레이어 클릭 시 속성 정보를 팝업으로 표시
- **지형(Terrain) 렌더링** — 3D 지형 표현
- **지오코딩** — OpenStreetMap Nominatim API 기반 주소 검색
- **나눔고딕 글리프** — Regular / Bold / ExtraBold 3종 포함
- **POI 아이콘 스프라이트** — `sprite/` 하단에 1x 및 2x 해상도 제공

## 명령어

패키지 매니저는 **pnpm**입니다.

```bash
pnpm dev           # 개발 서버 시작 (localhost:3000)
pnpm build         # 프로덕션 빌드
pnpm start         # 프로덕션 빌드 서빙
pnpm lint          # ESLint 실행
```

## 환경 변수

`.env.local`에 다음 값을 설정하세요:

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_VWORLD_API_KEY` | V-World API 키 (클라이언트/서버 모두 사용) |
| `VWORLD_API_KEY` | 동일 키, 서버사이드 전용 |
| `NEXT_PUBLIC_URL` | 스타일 생성 시 사용할 공개 베이스 URL (기본값: `http://localhost:3000`) |

```bash
# 예시
cp .env.local.example .env.local  # 또는 직접 작성
```

## 아키텍처

### 디렉토리 구조

```
app/                          # Next.js App Router
├── page.tsx                  # 홈 페이지 (VWorldMap 렌더링)
├── map-no-ssr.tsx            # SSR 비활성화 래퍼 (dynamic import, ssr: false)
├── vworld.json/route.ts      # MapLibre 스타일 JSON 동적 생성 라우트 핸들러
├── maplibre-worker/[file]/  # Web Worker 프록시 라우트
│   └── route.ts
└── test/page.tsx             # 플레이그라운드 (MapLibreMap 테스트)

components/
├── map/
│   └── VWorldMap.tsx         # 메인 맵 컴포넌트
└── MapLibreMap.tsx           # 기본 MapLibre 컴포넌트 (OSM Liberty 스타일, 테스트용)

data/
└── poi-layers.json           # POI 레이어 사양 (~527 KB)

lib/
└── vworld/
    └── config.ts             # V-World API 설정 (URL 빌더, 상수)

public/
├── font/                     # 나눔고딕 글리프 (Regular/Bold/ExtraBold)
│   ├── NanumGothic Regular/
│   ├── NanumGothic Bold/
│   └── NanumGothic ExtraBold/
└── sprite/                   # POI 아이콘 스프라이트
    ├── sprite.png
    ├── sprite.json
    ├── sprite@2x.png
    └── sprite@2x.json

tools/                        # 맵 리소스 빌드 도구
├── style-builder/            # V-World OpenLayers 스타일 → MapLibre JSON 변환
├── glyph-builder/            # 나눔고딕 폰트 → MapLibre 글리프 생성
└── sprite-builder/           # POI 아이콘 스프라이트 생성 (미완료)
```

### 맵 컴포넌트

클라이언트 전용 렌더링을 위해 `dynamic` import + `ssr: false`를 사용합니다:

- **`components/map/VWorldMap.tsx`** — 메인 맵 컴포넌트. V-World 벡터 타일, 커스텀 `reverse://` 프로토콜 핸들러, Nominatim 기반 지오코딩, 지형 렌더링, POI 클릭 팝업을 초기화합니다. Web Worker는 `setWorkerUrl("/maplibre-worker/...")`로 서빙됩니다.
- **`components/MapLibreMap.tsx`** — 기본 MapLibre 컴포넌트 (OSM Liberty 스타일 사용). 테스트용입니다.

### Route Handlers (서버사이드)

- **`app/vworld.json/route.ts`** — V-World API 엔드포인트와 `data/poi-layers.json`을 기반으로 MapLibre 스타일 JSON을 요청 시 동적 생성합니다. `?key=` 쿼리 파라미터로 인증합니다.
- **`app/maplibre-worker/[file]/route.ts`** — `node_modules/` 내의 MapLibre worker mjs 파일을 프록시합니다. Next.js에서 `node_modules` Web Worker를 직접 로드할 수 없으므로 필요합니다.

### 핵심 라이브러리

- **`lib/vworld/config.ts`** — V-World API URL 빌더(`getVWorldVectorTileUrl`, `getVWorldVectorBackgroundUrl`) 및 상수(줌 범위: 6–19)
- **`data/poi-layers.json`** — POI 렌더링용 MapLibre 레이어 사양(~527 KB). VWorldMap의 click 핸들러에서 `poi-normal-*` 레이어 ID를 참조합니다.

### 스타일링 & 설정

- **Tailwind CSS v4** (`@tailwindcss/postcss` 사용)
- **ESLint flat config** (`eslint.config.mjs`) — `eslint-config-next` 기반
- **TypeScript strict 모드**, 경로 별칭 `@/*` → `./*`

## Tools (맵 리소스 빌더)

`tools/` 디렉토리에는 V-World 스타일을 MapLibre 형식으로 변환하는 도구들이 있습니다. 자세한 내용은 [tools/README.md](./tools/README.md)를 참고하세요.

| 도구 | 상태 | 설명 |
|------|------|------|
| [style-builder](./tools/style-builder/) | ✅ 완료 | V-World OpenLayers 스타일 → MapLibre symbol layer JSON 변환 |
| [glyph-builder](./tools/glyph-builder/) | ✅ 완료 | 나눔고딕 폰트 → MapLibre 글리프(.pbf) 생성 |
| [sprite-builder](./tools/sprite-builder/) | ⚠️ 미완료 | POI 아이콘 스프라이트 생성 (현재는 수동 생성 파일 사용) |

## 개발 참고

- `/test` 라우트는 스크래치패드입니다. 홈 페이지(`app/page.tsx`)는 `MapNoSSRComponent`(VWorldMap)를 렌더링합니다.
- POI 레이어나 타일 소스를 수정할 때는 `data/poi-layers.json`과 `lib/vworld/config.ts` 둘 다 필요에 따라 업데이트하세요 — 스타일 라우트는 요청 시 JSON 파일을 읽습니다.
- VWorldMap의 커스텀 `reverse://` 프로토콜은 V-World 벡터 타일 요청을 인터셉트하여 클라이언트 사이드에서 재처리합니다. 실험적 접근 방식이며, 필요시 제거하면 직접 URL 로딩으로 단순화됩니다.

## 기술 스택

| 항목 | 버전 |
|------|------|
| Next.js | 16.2.12 |
| React | 19.2.4 |
| MapLibre GL JS | ^6.0.0 |
| Tailwind CSS | ^4 |
| TypeScript | ^5 |
| ESLint | ^9 |

## Links

- [V-World OpenAPI](https://api.vworld.kr)
- [MapLibre GL JS](https://maplibre.org/)
- [Next.js Documentation](https://nextjs.org/docs)
