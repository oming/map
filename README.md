# Map QWER Dev

V-World 지도 서비스를 MapLibre GL JS에서 쓸 수 있게 감싸고, 그 스타일 API를 다른 프로젝트도 재사용할 수 있게 공개하는 Next.js 기반 지도 애플리케이션입니다.

## 소개

이 프로젝트는 V-World OpenAPI(벡터/래스터 타일, POI, 검색)를 MapLibre GL JS가 바로 소비할 수 있는 스타일 JSON으로 변환합니다. 목표는 두 가지입니다.

1. V-World 지도 서비스를 MapLibre GL JS에서 바로 쓸 수 있게 한다.
2. 이 프로젝트가 만든 스타일 API(`/vworld.json`)를 다른 프로젝트에서도 그대로 호출해서 쓸 수 있게 한다.

이 저장소(`https://map.qwer.dev`)가 이미 그 스타일 API를 배포하고 있으므로, 아래 [사용 방법](#사용-방법)의 두 가지 중 하나를 선택해 자신의 MapLibre 지도에 V-World를 붙이면 됩니다.

## 사용 방법

V-World가 내려주는 벡터 타일은 레이어 이름이 MapLibre 표준과 다르게 나옵니다(`cl_id` 기반 원본 이름). 그래서 **어느 방법을 선택하든** 클라이언트 쪽에서 타일을 가로채 레이어 이름을 재작성하는 코드가 항상 필요합니다. 두 방법의 차이는 "스타일 JSON(`/vworld.json`)을 누가 서빙하느냐"일 뿐입니다.

| | 방법 1: 이미 배포된 API 사용 | 방법 2: 직접 구현(이 저장소 셀프호스트) |
|---|---|---|
| 스타일 JSON | `https://map.qwer.dev/vworld.json`을 그대로 호출 | 이 저장소를 클론/포크해서 직접 서빙 |
| 필요한 것 | 자신의 V-World API 키 | V-World API 키 + `tools/` 빌드 실행 + (Next.js라면) Worker 프록시 |
| 클라이언트 필수 설정 | `addProtocol` + `setTransformRequest` | `addProtocol` + `setTransformRequest` |

### 공통: 클라이언트 필수 설정

두 방법 모두 아래 두 가지를 MapLibre `Map` 인스턴스에 구성해야 POI 벡터 타일이 렌더링됩니다.

1. **`addProtocol("reverse", ...)`** — V-World 벡터 타일을 fetch해서 PBF로 디코드하고, 레이어 이름을 스타일이 기대하는 `"poi"`로 바꾼 뒤 다시 인코드합니다.
2. **`map.setTransformRequest(...)`** — V-World `getTile` 요청 URL을 `reverse://` 프로토콜로 라우팅합니다. 키를 주입하지는 않습니다 — 오직 1번 핸들러로 요청을 우회시키는 역할만 합니다.

```js
import maplibregl, { addProtocol } from "maplibre-gl";
import { PbfReader } from "pbf";
import { VectorTile } from "@mapbox/vector-tile";
import { fromVectorTileJs } from "@maplibre/vt-pbf";

addProtocol("reverse", async (params) => {
  const url = params.url.replace("reverse://", "");
  const data = await fetch(url).then((r) => r.arrayBuffer());
  const tile = new VectorTile(new PbfReader(data));
  const newTile = {
    layers: Object.fromEntries(
      Object.entries(tile.layers).map(([id, layer]) => [
        id,
        { ...layer, name: "poi" },
      ]),
    ),
  };
  return { data: fromVectorTileJs(newTile).buffer };
});

const map = new maplibregl.Map({
  container: "map",
  style: "<아래 방법 1 또는 2에서 얻은 스타일 URL>",
});

map.setTransformRequest((url, resourceType) => {
  if (
    url.startsWith("https://api.vworld.kr/req/wmts/vector/getTile/") &&
    resourceType === "Tile"
  ) {
    return { url: "reverse://" + url };
  }
  return undefined;
});
```

필요 의존성: `maplibre-gl`, `pbf`, `@mapbox/vector-tile`, `@maplibre/vt-pbf` (전부 일반 npm 패키지, 정확한 버전은 [package.json](./package.json) 참고). 래스터 배경지도 소스(`vworldBase`)는 별도 처리 없이 표준 raster 소스로 바로 동작합니다.

### 방법 1 — 이미 배포된 API 사용

가장 빠른 시작 방법입니다. 이 저장소를 실행할 필요 없이, 위 공통 설정만 자신의 프로젝트에 넣고 `style`을 아래 URL로 지정하세요.

```
style: "https://map.qwer.dev/vworld.json?key={YOUR_VWORLD_KEY}"
```

`{YOUR_VWORLD_KEY}`는 자신이 발급받은 V-World API 키로 채우세요(V-World 도메인 등록 시 사용한 키). 응답은 `version: 8` 스타일 객체이며, 래스터 배경지도 + POI/교통정보 벡터 소스 + 스프라이트/글리프 참조를 포함합니다.

> **⚠️ 유의사항 — `key`는 현재 값 검증이 없습니다.** `key` 쿼리 파라미터는 비어있지 않기만 하면 통과하며, 실제로 타일 요청에 쓰이는 V-World API 키는 이 서버(`map.qwer.dev`) 소유자의 키입니다. 즉 호출자가 어떤 `key` 값을 보내든 그 서버의 실제 V-World 자격 증명이 노출되는 구조입니다. 자신의 서비스 트래픽이 커질 경우 아래 "방법 2"로 전환해 자신의 V-World 키/쿼터를 쓰는 것을 권장합니다.

`setWorkerUrl` 등 Web Worker 관련 설정은 필요 없습니다 — 이 프로젝트 내부 구현 세부사항일 뿐입니다.

### 방법 2 — 직접 구현(이 저장소 셀프호스트)

자신의 V-World API 키와 쿼터로 스타일 API를 직접 서빙하고 싶다면 이 저장소를 클론/포크해서 실행하세요.

1. 클론 후 `.env.local`에 아래 [환경 변수](#환경-변수)를 설정합니다.
2. **`pnpm build:tools`를 반드시 실행**하세요 — V-World 스타일 데이터로부터 `data/poi-layers.json`(POI 레이어 사양)과 `public/sprite/*`(아이콘 스프라이트)를 생성합니다. 이 파일들이 없으면 `/vworld.json`이 POI 레이어 없는 반쪽 스타일을 반환합니다. 도구 상세 설명은 [tools/README.md](./tools/README.md)를 참고하세요.
3. `pnpm dev`(개발) 또는 `pnpm build && pnpm start`(프로덕션)로 서버를 띄웁니다.
4. 자신의 지도에서 `style: "<배포 도메인>/vworld.json?key=<아무 값>"`으로 스타일을 로드하고, 위 [공통: 클라이언트 필수 설정](#공통-클라이언트-필수-설정)을 동일하게 구성합니다.
5. **Next.js로 이 저장소를 그대로 쓰는 경우** `setWorkerUrl("/maplibre-gl-worker.mjs")`가 이미 `components/map/v-world-map.tsx`에 설정돼 있습니다 — Next.js가 `node_modules` 내 MapLibre Worker 파일을 직접 서빙하지 못하므로, `postinstall`(`scripts/copy-maplibre-worker.mjs`)이 워커/셰어드 번들을 `public/`으로 복사해 정적 파일로 내보냅니다. Next.js가 아닌 다른 번들러(Vite 등)를 쓴다면 보통 필요 없습니다.

## 레이어가 만들어지는 방식

지도에 보이는 레이어는 한곳에서 정의되지 않습니다. **빌드 시점 / 요청 시점 / 런타임** 세 단계에서 각각 다른 주체가 만들며, 단계마다 산출물과 갱신 주기가 다릅니다.

```
① 빌드(수동 실행)                      ② 요청 (GET /vworld.json)          ③ 런타임 (브라우저)
──────────────────────                ─────────────────────────         ──────────────────────
tools/sprite-builder ─┐                app/vworld.json/route.ts           useSearchMapLayers → ensureSearchLayers()
tools/style-builder  ─┼→ data/poi-layers.json ─→ 스타일 JSON 조립 ─→ new Map({style}) ─→ style.load ─┤
tools/data-builder   ─┘  public/sprite/*        (raster + POI + 앵커)                    useDataLayers → addDataLayer()
                         public/data/*.geojson                                            (활성 데이터셋만)
```

| 단계 | 언제 실행되나 | 무엇을 만드나 |
|---|---|---|
| ① 빌드 | 개발자가 `pnpm build:tools` / `pnpm build:data-builder`를 **직접** 실행할 때만 (`pnpm build`에 포함되지 않음) | `data/poi-layers.json`(POI 심볼 레이어 사양 ~509개), `public/sprite/*`, `public/data/<id>.<hash>.geojson` |
| ② 요청 | `/vworld.json?key=...` 요청마다 (`Cache-Control: public, max-age=3600`) | 배경 raster 레이어 + ①의 POI 레이어 전체 + `slot-overlay` 앵커를 담은 MapLibre 스타일 객체 |
| ③ 런타임 | 지도 `style.load` 이후, 그리고 사용자가 검색하거나 레이어를 토글할 때마다 | 검색 결과/선택 핀 레이어(`search-*`), 활성 데이터셋 레이어(`dl-*`) |

### ① 빌드 시점 — 정적 산출물

- `pnpm build:tools` = `sprite-builder` → `style-builder` 순서. V-World OpenLayers 스타일(`vectorStylePoi.js`)을 내려받아 아이콘 스프라이트를 만들고, 그 `sprite.json`을 참조해 POI 스타일을 MapLibre symbol 레이어 배열(`data/poi-layers.json`)로 변환합니다. 상세는 [tools/README.md](./tools/README.md).
- `pnpm build:data-builder`는 공공데이터 원본(CSV/API)을 `public/data/<id>.<hash>.geojson`으로 변환하고 `lib/map/datasets/data-manifest.json`에 콘텐츠 해시를 기록합니다. `next.config.ts`가 `/data/*`를 `immutable`(1년)로 캐시하므로, URL은 반드시 `dataUrl(id)`(`lib/map/datasets/data-url.ts`)로 해시가 붙은 경로를 생성해야 재빌드 결과가 반영됩니다.
- 두 빌드 모두 자동 실행되지 않습니다. `data/poi-layers.json`이 없으면 `/vworld.json`은 POI 없는 반쪽 스타일을 반환하고, 매니페스트에 항목이 없으면 `dataUrl()`이 throw합니다.

### ② 요청 시점 — 스타일 JSON 조립

`app/vworld.json/route.ts`가 요청마다 `StyleSpecification` 객체를 새로 조립합니다(POI 배열은 번들에 정적 import되어 있고, 소스 URL은 `lib/vworld/config.ts`가 생성).

레이어 순서는 다음 세 덩어리로 고정됩니다.

1. `vworld-base` — 벡터 타일과 격자가 맞는 배경 raster(`?base=satellite`면 V-World 위성 항공사진으로 교체).
2. `POI_LAYERS` — ①이 만든 심볼 레이어 전체. `source-layer`는 전부 `poi` 하나를 기대하므로, 클라이언트의 `reverse://` 프로토콜이 타일 레이어 이름을 `poi`로 재작성해야 렌더됩니다([공통 설정](#공통-클라이언트-필수-설정)).
3. `slot-overlay` — **소스 없는 투명 `background` 레이어(`visibility: "none"`)**. 렌더 비용은 0이고, 런타임 데이터 레이어가 `addLayer(spec, "slot-overlay")`로 항상 이 앵커 바로 아래에 삽입되도록 만드는 z-order 기준점입니다. 덕분에 `moveLayer()`로 순서를 재조정할 필요가 없습니다.

POI 레이어나 타일 소스를 바꿀 때는 `data/poi-layers.json`과 `lib/vworld/config.ts`를 함께 확인합니다.

### ③ 런타임 — 클라이언트가 추가하는 레이어

지도는 클라이언트 전용이며(`app/map-no-ssr.tsx`가 `ssr: false`로 로드), `components/map/v-world-map.tsx`가 `new Map({ style: "/vworld.json?key=..." })`로 ②의 스타일을 불러옵니다. 이후 레이어를 추가하는 주체는 두 곳입니다.

**검색 레이어** (`lib/map/search-layers.ts` ← `hooks/use-search-map-layers.ts`)

- `ensureSearchLayers(map)`가 `search-results`(클러스터 켜짐) / `search-selected` 두 GeoJSON 소스와 아이콘·라벨·클러스터 레이어를 만듭니다. 이미 있으면 아무 일도 하지 않으므로 반복 호출해도 안전합니다.
- `style.load`를 **구독**해서 호출합니다(최초 로드 + 향후 `setStyle` 모두 커버). 검색 UI는 `ReactControl`이 만든 별도 React 루트라 `useMap()`/`useStyleReady()`에 접근할 수 없어 맵 이벤트를 직접 구독합니다.
- `beforeId` 없이 추가하므로 항상 최상단입니다 — 사용자가 방금 요청한 결과이기 때문입니다.
- 핀 이미지는 라벨(A, B, … / 27, 28 …) × 색상 조합으로 미리 등록해두고, `icon-image`를 feature 속성에서 표현식으로 조립합니다. 개수 상한은 `lib/search-config.ts`의 `MAX_SEARCH_RESULT_SIZE`와 공유합니다.

**데이터 레이어** (`lib/map/data-layer-setup.ts` ← `hooks/use-data-layers.ts`)

- 데이터셋 정의는 `lib/map/datasets/`의 `DATA_LAYERS` 배열이 전부입니다. 새 데이터셋 추가 = 배열에 한 줄 + 파일 하나이며, 엔진과 UI는 이 배열만 읽습니다.
- 활성 목록은 **URL 해시의 `layers=` 파라미터**에서 옵니다(`components/map/data/index.tsx`). 토글하면 `writeHashParam`으로 해시를 갱신하고, 뒤로/앞으로가기는 `hashchange` 구독으로 반영됩니다. 즉 어떤 레이어가 그려지는지는 URL로 공유·복원됩니다.
- 활성화된 정의마다 `addDataLayer()`가 GeoJSON 소스(`dl-<id>`, 대부분 클러스터링) + 핀 이미지 + 레이어 3종(`-point`, `-cluster`, `-cluster-count`)을 만들고, 전부 `"slot-overlay"` 앞에 삽입합니다.
- 실행 조건은 `map && styleReady`입니다. `styleReady`는 `style.load`에서만 켜지며(`styledata`가 아님), 레이어/소스를 추가하는 effect는 반드시 이 값을 게이트로 씁니다.
- 비활성화·언마운트 시 `teardownLayerGroup()`이 **레이어 → 소스 → 이미지** 순서로 정리합니다. 순서를 바꾸거나 try/catch를 빼면 스타일 전환 중 `'Style is not done loading.'`으로 throw할 수 있습니다(`lib/map/layer-lifecycle.ts`).
- 겹친 핀을 펼치는 spiderfy(`lib/map/spiderfy.ts`)는 스타일 레이어가 아니라 DOM `Marker`로 그립니다 — 레이어 목록에 나타나지 않습니다.

### 최종 z-order와 클릭 우선순위

```
위 ┌ search-selected-icon / -label          ③ 검색 (beforeId 없음 → 최상단)
   │ search-results-icon / -label / -cluster / -cluster-count
   │ slot-overlay                            ② 앵커 (보이지 않음)
   │ dl-<id>-point / -cluster / -cluster-count   ③ 데이터 (앵커 앞에 삽입)
   │ poi-*                                   ② 빌드 산출 POI 심볼
아래└ vworld-base                             ② 배경 raster
```

클릭은 레이어별 핸들러가 아니라 맵 레벨 단일 라우터(`lib/map/click-router.ts`)가 우선순위로 중재합니다 — 검색 `0`, 데이터 레이어 `10+`(등록 순), 개발 환경 전용 POI 디버그 팝업 `1000`. `queryRenderedFeatures`는 존재하지 않는 레이어 id가 하나라도 섞이면 빈 배열을 돌려주므로, 라우터가 매 클릭마다 실제 존재하는 레이어만 걸러 한 번만 질의합니다.

## 베이스맵 전환

지도 우측 상단 스위처(`components/map/basemap/switcher.tsx`)에서 배경지도 3종을 고를 수 있습니다. 선택 상태는 URL 해시 `#map=...&base=<id>`로 저장/공유됩니다(기본값 `vworld`는 해시에 남기지 않음). 단일 진입점은 `lib/map/basemaps.ts`(`BasemapId`, 스타일 URL, 해시 파싱)입니다.

| id | 이름 | 스타일 소스 | 비고 |
|---|---|---|---|
| `vworld` (기본) | 브이월드 | `/vworld.json` | 벡터 정렬 배경 raster + POI |
| `satellite` | 위성사진 | `/vworld.json?base=satellite` | V-World 위성 항공사진(`.jpeg`, z6~19) 위에 **같은 POI 레이어**를 그대로 올림. 밝은 지붕/구름 위에서도 라벨이 읽히도록 raster-brightness-max/-saturation을 살짝 낮춤 |
| `osm` | OSM | `/osm.json` | OpenStreetMap [Shortbread](https://shortbread-tiles.org/) 스키마. 타일은 [VersaTiles](https://tiles.versatiles.org)가 서빙하고(`© OpenStreetMap contributors`), 스타일은 VersaTiles `colorful`을 빌드 시점에 이 프로젝트 폰트(나눔고딕)로 재매핑해서 씀 |

`osm` 스타일은 `tools/osm-style-builder`(`pnpm build:osm-style-builder`)가 만드는 빌드 산출물(`data/osm-style.json`, `public/sprite-osm/basics/*`)입니다 — OSMF는 Shortbread 타일만 제공하고 스타일 JSON은 호스팅하지 않기 때문입니다. 상세는 [tools/osm-style-builder/README.md](./tools/osm-style-builder/README.md).

`map.setStyle()`로 베이스맵을 바꾸는 동안, `v-world-map.tsx`는 `styledataloading`(전환 시작) → `style.load`(전환 완료)에 맞춰 `styleReady`를 false→true로 토글합니다. `useDataLayers`/`useSearchMapLayers`가 이 값을 게이트로 쓰고 있어, 전환할 때마다 활성 데이터 레이어와 검색 결과 핀이 새 스타일 위에 자동으로 다시 그려집니다. 세 스타일 모두 `slot-overlay` 앵커를 반드시 포함해야 하는 이유이기도 합니다(위 "요청 시점" 절 참고).

## 환경 변수

방법 2(직접 구현)에서만 필요합니다. `.env.local`에 설정하세요:

| 변수 | 필수 | 설명 |
|------|------|------|
| `NEXT_PUBLIC_VWORLD_API_KEY` | ✅ | V-World API 키. 클라이언트/서버/`tools/` 빌드 스크립트가 모두 이 하나의 변수만 사용합니다. |
| `NEXT_PUBLIC_SITE_URL` | ✅ | 배포된 공개 베이스 URL(예: `https://map.qwer.dev`). `/vworld.json`의 `sprite`/`glyphs` 절대경로와 V-World 서비스 등록 도메인(`/api/geo-search`)을 여기서 유도합니다. 비어있거나 잘못되면 아이콘/폰트가 깨진 채로 내려갑니다. |

## Links

- [V-World OpenAPI](https://api.vworld.kr)
- [MapLibre GL JS](https://maplibre.org/)
- [Next.js Documentation](https://nextjs.org/docs)
- [tools/README.md](./tools/README.md) — 이 저장소의 지도 리소스 빌드 도구
