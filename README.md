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
5. **Next.js로 이 저장소를 그대로 쓰는 경우** `setWorkerUrl("/maplibre-worker/maplibre-gl-worker.mjs")`가 이미 `components/map/v-world-map.tsx`에 설정돼 있습니다 — Next.js가 `node_modules` 내 MapLibre Worker 파일을 직접 서빙하지 못하는 문제를 우회하기 위한 프록시 라우트(`app/maplibre-worker/[file]/route.ts`)입니다. Next.js가 아닌 다른 번들러(Vite 등)를 쓴다면 보통 필요 없습니다.

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
