<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

## 명령어

```bash
pnpm dev          # 개발 서버 시작 (localhost:3000)
pnpm build        # 프로덕션 빌드
pnpm start        # 프로덕션 빌드 서빙
pnpm lint         # ESLint 실행 (flat config, eslint-config-next 기반)
```

패키지 매니저는 **pnpm**입니다. 테스트 프레임워크가 없습니다.

## 환경 변수

필수 env vars (`.env.local`에 설정):

- `NEXT_PUBLIC_VWORLD_API_KEY` — V-World API 키 (클라이언트/서버 모두 사용)
- `VWORLD_API_KEY` — 동일 키, 서버사이드 전용
- `NEXT_PUBLIC_URL` — 스타일 생성 시 사용할 공개 베이스 URL (기본값: `http://localhost:3000`)

## 아키텍처

- **맵 렌더링은 클라이언트 전용.** `components/map/VWorldMap.tsx`를 `dynamic()` + `ssr: false`로 로드. 홈 페이지(`app/page.tsx`)에서 렌더링.
- **`app/vworld.json/route.ts`** — 서버 라우트. V-World API 엔드포인트 + `data/poi-layers.json` 기반으로 MapLibre 스타일 JSON을 요청 시 동적 생성. `?key=` 쿼리 파라미터 필요.
- **`app/maplibre-worker/[file]/route.ts`** — `node_modules/` 내 MapLibre worker mjs를 프록시. Next.js가 `node_modules`에서 직접 워커 로딩 불가하므로 필요.
- **`lib/vworld/config.ts`** — V-World API URL 빌더 (`getVWorldVectorTileUrl`, `getVWorldBackgroundUrl`), 줌 범위 6–19.
- **`data/poi-layers.json`** — POI 렌더링용 MapLibre 심볼 레이어 (~527 KB). 클릭 핸들러에서 `poi-normal-*` 레이어 ID 참조.
- **`reverse://` 프로토콜** — VWorldMap의 실험적 커스텀 핸들러. V-World 벡터 타일 요청을 인터셉트하여 클라이언트 사이드에서 재처리. 제거하면 직접 URL 로딩으로 단순화됨.

## 주의사항

- **테스트 프레임워크 없음.** 테스트 관련 스크립트가 없습니다.
- **`pnpm-workspace.yaml`**에서 `sharp`, `unrs-resolver` 빌드를 비활성화 (`allowBuilds: false`). 설치 시도 금지.
- **TypeScript strict 모드**, 경로 별칭 `@/*` → `./*`.
- **Tailwind CSS v4** (`@tailwindcss/postcss` 사용, `postcss.config.mjs` 참조).
- **CI/CD 워크플로우 없음.** `.github/`에 설정 파일이 없습니다.

## Python 도구 (`tools/`)

- **반드시 venv 사용:** 글로벌 `pip3 install` 금지. 도구 디렉토리에서 `python3 -m venv .venv`로 생성.
- macOS Homebrew Python 3.13 기준, pip 명령어는 `pip3`입니다 (`pip` 아님).
- 활성화: `source tools/<도구명>/.venv/bin/activate`
- 각 도구별 README를 참고: `tools/style-builder/`, `tools/glyph-builder/`, `tools/sprite-builder/`.
- POI 레이어 또는 타일 소스를 수정할 때는 `data/poi-layers.json`과 `lib/vworld/config.ts` 둘 다 필요에 따라 업데이트 — 스타일 라우트가 요청 시 JSON 파일을 읽습니다.
