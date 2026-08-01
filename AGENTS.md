<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

# MapLibre GL JS + V-World 벡터 타일 렌더링 Next.js 16 App Router 프로젝트

## 명령어

```bash
pnpm dev          # 개발 서버 시작 (localhost:3000)
pnpm build        # 프로덕션 빌드
pnpm start        # 프로덕션 빌드 서빙
pnpm lint         # ESLint 실행
```

패키지 매니저는 **pnpm**입니다 (`pnpm-workspace.yaml` 참조). 테스트 프레임워크가 없습니다.

## 환경 변수

필수 env vars (`.env.local.example` 복사 또는 직접 설정):

- `NEXT_PUBLIC_VWORLD_API_KEY` — V-World API 키 (클라이언트/서버 모두 사용)
- `VWORLD_API_KEY` — 동일 키, 서버사이드 전용
- `NEXT_PUBLIC_URL` — 스타일 생성 시 사용할 공개 베이스 URL (기본값: `http://localhost:3000`)

## 아키텍처

### 맵 컴포넌트 (dynamic import + `ssr: false`로 클라이언트 전용)

- **`components/map/VWorldMap.tsx`** — 메인 맵. V-World 벡터 타일, 커스텀 `reverse://` 프로토콜 핸들러, Nominatim 기반 지오코딩, 지형 렌더링, POI 클릭 팝업을 초기화합니다. `setWorkerUrl("/maplibre-worker/...")`로 Web Worker를 서빙합니다.
### Route Handlers (서버사이드)

- **`app/vworld.json/route.ts`** — V-World API 엔드포인트와 `@/data/poi-layers.json`을 기반으로 MapLibre 스타일 JSON을 요청 시 동적 생성. 인증용 `?key=` 쿼리 파라미터 필요.
- **`app/maplibre-worker/[file]/route.ts`** — `node_modules/`의 maplibre worker/shared mjs를 프록시합니다. Next.js에서 `node_modules` Web Worker를 직접 로드할 수 없으므로 필요합니다.

### 주요 라이브러리 & 데이터

- **`@/lib/vworld/config.ts`** — V-World API URL 빌더 (`getVWorldVectorTileUrl`, `getVWorldVectorBackgroundUrl`) 및 상수 (줌 범위 6–19).
- **`@/data/poi-layers.json`** — POI 렌더링용 MapLibre 레이어 사양 (~527 KB). VWorldMap의 click 핸들러에서 참조하는 `poi-normal-*` 레이어 ID 포함.

### 스타일링 & 설정

- Tailwind CSS v4 (`@tailwindcss/postcss` 사용)
- ESLint flat config (`eslint.config.mjs`) — `eslint-config-next` 기반
- TypeScript strict 모드, 경로 별칭 `@/*` → `./*`

## 개발 참고

- 홈 페이지(`app/page.tsx`)는 현재 `MapNoSSRComponent`(V-World 맵)를 렌더링합니다.
- POI 레이어나 타일 소스를 수정할 때는 `@/data/poi-layers.json`과 `@/lib/vworld/config.ts` 둘 다 필요에 따라 업데이트하세요 — 스타일 라우트는 요청 시 JSON 파일을 읽습니다.
- VWorldMap의 커스텀 `reverse://` 프로토콜은 V-World 벡터 타일 요청을 인터셉트하여 클라이언트 사이드에서 재처리합니다. 실험적 접근 방식이며, 제거하면 직접 URL 로딩으로 단순화됩니다.

## tools 디렉토리 작업 시

- **참고**: `tools/` 하위 도구별 README.md 파일을 참고하세요
  - [style-builder](./tools/style-builder/README.md) — V-World POI 스타일 변환기
  - [glyph-builder](./tools/glyph-builder/README.md) — 나눔고딕 폰트 빌더
  - [sprite-builder](./tools/sprite-builder/README.md) — POI 아이콘 스프라이트 빌러 (미완료)
