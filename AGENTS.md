<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

# Project Instructions

## Commands

- `pnpm dev` / `pnpm build` / `pnpm lint`
- 테스트 프레임워크 없음 — `pnpm lint`와 `pnpm build` 통과가 완료 기준.

## Architecture

- 지도는 클라이언트 전용. `components/map/v-world-map.tsx`는 `ssr: false`로만 로드한다 (`app/map-no-ssr.tsx`).
- `app/vworld.json/route.ts`가 요청마다 `data/poi-layers.json` + `lib/vworld/config.ts`를 읽어 MapLibre 스타일을 생성한다. POI 레이어나 타일 소스를 바꾸면 두 파일을 함께 수정한다.
- `reverse://` 프로토콜(`v-world-map.tsx`)이 V-World 벡터 타일 응답을 가로채 클라이언트에서 재처리한다. 타일이 안 보이면 여기부터 확인한다.
- `useMap()`(`components/map/map-context.tsx`)은 `VWorldMap` 하위에서만 동작한다.
- `/api/geo-search`가 정의하는 `GeoSearchItem` 타입을 `hooks/use-geo-search.ts`, `hooks/use-search-map-layers.ts`가 그대로 소비한다. 응답 필드를 바꾸면 세 파일을 함께 확인한다.

## Rules

- 커밋 메시지는 한국어, `type(scope): 설명` 형식.
- `tools/` 내 Python 스크립트는 해당 디렉터리 venv에서만 실행한다 (`pip3`, 전역 설치 금지). 사용법은 `tools/<name>/README.md`.

## Important Constraints

- 필수 env(`.env.local`): `NEXT_PUBLIC_VWORLD_API_KEY`, `NEXT_PUBLIC_SITE_URL`. 없으면 지도/검색이 동작하지 않는다.
- `pnpm-workspace.yaml`의 `unrs-resolver` 빌드 비활성화 설정을 임의로 바꾸거나 강제 설치하지 않는다.
