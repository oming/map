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
- 콘솔에 반복적으로 뜨는 `[MapLibre error] Error: Unimplemented type: 4`는 위 벡터 타일 재처리 과정에서 발생하는 기존 PBF 디코딩 이슈이며 화면 렌더링에는 영향 없음. 새 변경과 무관하게 항상 나타나므로 원인 조사/수정 시도하지 말고 무시한다.
- `useMap()`(`components/map/map-context.tsx`)은 `VWorldMap` 하위에서만 동작한다.
- `lib/site.ts`가 사이트 전역 상수(`SITE_URL`, 이름/설명/키워드)의 **유일한 진입점**이다. `process.env.NEXT_PUBLIC_SITE_URL`을 다른 파일에서 다시 읽지 말 것 — 폴백이 갈리면 canonical URL과 스타일 JSON의 `sprite`/`glyphs` 호스트가 어긋난다. SEO 메타데이터 라우트(`app/sitemap.ts`, `app/robots.ts`, `app/manifest.ts`, `app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx`)와 스타일 라우트가 모두 여기서 읽는다.
- `/api/geo-search`가 정의하는 `GeoSearchItem` 타입을 `hooks/use-geo-search.ts`, `hooks/use-search-map-layers.ts`가 그대로 소비한다. 응답 필드를 바꾸면 세 파일을 함께 확인한다.
- 베이스맵은 브이월드 기본 / 위성사진 / OSM Shortbread 3종이며 `lib/map/basemaps.ts`가 유일한 진입점(`BasemapId`, 스타일 URL, URL 해시 `base=` 파싱)이다. 위성은 `app/vworld.json?base=satellite`(같은 POI 레이어를 공유), OSM은 `app/osm.json`(`data/osm-style.json` — `tools/osm-style-builder`가 생성)이 스타일을 만든다. `lib/map/slot-overlay.ts`의 `SLOT_OVERLAY_LAYER`를 모든 베이스맵 스타일이 반드시 포함해야 `lib/map/data-layer-setup.ts`의 `addLayer(spec, "slot-overlay")`가 깨지지 않는다.
- `v-world-map.tsx`는 `styledataloading` → `style.load` 순서로 `styleReady`를 false→true로 토글해 `setStyle`(베이스맵 전환)이 데이터/검색 레이어를 재구성하게 만든다 — 이 계약을 건드리는 변경은 `useDataLayers`(`hooks/use-data-layers.ts`)와 `useSearchMapLayers`(`hooks/use-search-map-layers.ts`)를 함께 확인한다.

## Rules

- 커밋 메시지는 한국어, `type(scope): 설명` 형식.
- `tools/` 내 Python 스크립트는 해당 디렉터리 venv에서만 실행한다 (`pip3`, 전역 설치 금지). 사용법은 `tools/<name>/README.md`.
- OSM 베이스맵 스타일(`data/osm-style.json`, `public/sprite-osm/`)은 `pnpm build:osm-style-builder`로 생성하는 빌드 산출물 — 손으로 편집하지 않는다. 사용법은 `tools/osm-style-builder/README.md`.

## Important Constraints

- 필수 env(`.env.local`): `NEXT_PUBLIC_VWORLD_API_KEY`, `NEXT_PUBLIC_SITE_URL`. 없으면 지도/검색이 동작하지 않는다. `NEXT_PUBLIC_GTM_ID`는 선택 — 없으면 GTM 태그만 빠지고 나머지는 정상 동작한다.
- `pnpm-workspace.yaml`의 `unrs-resolver` 빌드 비활성화 설정을 임의로 바꾸거나 강제 설치하지 않는다.
