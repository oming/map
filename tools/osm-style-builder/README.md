# OSM Style Builder — VersaTiles Shortbread 스타일 변환기

OpenStreetMap Shortbread 벡터 타일 스키마용 MapLibre 스타일을 자동으로 받아 이 프로젝트가 쓸 수 있게 가공합니다.

## 왜 VersaTiles인가

OSM Foundation은 Shortbread 벡터 **타일**(`vector.openstreetmap.org/shortbread_v1`)만 호스팅하고, 스타일 JSON은 제공하지 않습니다. [VersaTiles](https://versatiles.org)의 `colorful` 스타일은 동일한 Shortbread 스키마용으로 만들어진 완성도 높은 기성 스타일이며, 원본 타일도 VersaTiles가 직접 서빙하므로(`tiles.versatiles.org/tiles/osm`) 스키마 불일치 위험이 없습니다.

- 스타일 원본: `https://tiles.versatiles.org/assets/styles/colorful/style.json`
- 라이선스: `metadata.license` = CC0 (Public Domain)
- 타일 소스: `https://tiles.versatiles.org/tiles/osm/{z}/{x}/{y}` (Shortbread, maxzoom 14 — 그 이상은 오버줌)
- attribution: `© OpenStreetMap contributors` (변환 과정에서 그대로 유지 — OSM 표시 의무)

## 사용법

```bash
# 프로젝트 루트에서
pnpm build:osm-style-builder

# 또는 직접 실행
cd tools/osm-style-builder
tsx build.ts
```

## 파이프라인 흐름

```
VersaTiles colorful style.json
    │  lib/download.ts
    ├─→ lib/transform.ts  → 폰트 매핑 + glyphs/sprite 키 제거
    │       └─→ lib/write.ts → data/osm-style.json
    │
    └─→ VersaTiles sprites (basics)
            └─→ lib/write.ts → public/sprite-osm/basics/*
```

## 출력 파일

| 경로 | 설명 |
|------|------|
| `data/osm-style.json` | **최종 스타일 산출물** — `layers` 배열(324개), `sources`, `version` 등. `glyphs`/`sprite`는 제거됨 |
| `public/sprite-osm/basics/sprites.json` | 스프라이트 메타데이터 (@1x) |
| `public/sprite-osm/basics/sprites.png` | 스프라이트 이미지 (@1x) |
| `public/sprite-osm/basics/sprites@2x.json` | 스프라이트 메타데이터 (@2x) |
| `public/sprite-osm/basics/sprites@2x.png` | 스프라이트 이미지 (@2x) |

`data/osm-style.json`과 `public/sprite-osm/**`는 다른 빌더 산출물(`data/poi-layers.json`, `public/sprite/*`)과 동일하게 **git에 커밋**합니다. 손으로 편집하지 말고 이 빌더를 다시 돌리세요.

## 스프라이트 id를 반드시 `basics`로 유지해야 하는 이유

VersaTiles colorful 스타일의 모든 `icon-image` 값은 `basics:icon-*` 형태로 프리픽스가 붙어 있습니다(예: `basics:icon-cafe`). MapLibre는 이 프리픽스를 스타일의 `sprite` 배열에서 `id: "basics"`인 항목과 매칭합니다. 런타임 라우트(`app/osm.json/route.ts`)가 `sprite: [{ id: "basics", url: ... }]`로 내려주는 것과 여기 출력 경로(`public/sprite-osm/basics/`)가 반드시 짝을 이뤄야 하며, id를 바꾸면 아이콘이 전부 사라집니다.

## 폰트 매핑 (`lib/transform.ts`)

| VersaTiles 폰트 | 이 프로젝트 폰트 |
|---|---|
| `noto_sans_regular` | `NanumGothic Regular` |
| `noto_sans_bold` | `NanumGothic Bold` |
| (매핑에 없는 값) | `NanumGothic Regular`로 폴백 + 빌드 시 경고 |

원본 스타일 실측 결과 두 폰트만 쓰입니다. VersaTiles가 스타일을 갱신해 폰트가 추가되면 빌드 로그에 경고가 뜨니 `FONT_MAP`을 갱신하세요.

`public/font/*`에 나눔고딕 3종(Regular/Bold/ExtraBold)이 이미 있어야 합니다(V-World 스타일과 공유).

## glyphs/sprite를 스타일에서 지우는 이유

원본 VersaTiles 스타일의 `glyphs`/`sprite`는 VersaTiles 도메인을 직접 가리킵니다. 이 앱은 배포 도메인(`NEXT_PUBLIC_SITE_URL`)마다 값이 달라져야 하므로, 이 두 키는 빌드 산출물에서 제거하고 런타임 라우트(`app/osm.json/route.ts`)가 `SITE_URL` 기준으로 다시 채워 넣습니다 — `app/vworld.json/route.ts`와 동일한 패턴입니다.

## 관련 도구

- [style-builder](../style-builder/) — V-World POI 스타일 변환기 (같은 목적, 다른 소스)
