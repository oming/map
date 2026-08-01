# Map Resources Builder (tools/)

V-World 벡터 타일 기반 지도 애플리케이션에서 사용하는 **맵 리소스 빌드 도구** 모음입니다.

## 개요

이 디렉토리는 V-World OpenLayers 스타일을 MapLibre 형식으로 변환하고, 필요한 폰트와 스프라이트를 생성하는 도구들을 포함합니다.

### 워크플로우

```
V-World OpenLayers 스타일 JS 파일
        ↓
  tools/style-builder/ (POI 스타일 변환)
        ↓
  poi-layers.json → app/data/poi-layers.json
        ↓
  MapLibre 렌더링 (클라이언트 사이드)

tools/glyph-builder/ (나눔고딕 폰트 생성)
        ↓
  /public/font/*

tools/sprite-builder/ (POI 아이콘 스프라이트 생성)
        ↓
  /public/sprite/*
```

---

## 하위 디렉토리

### [style-builder/](./style-builder/) — POI 스타일 변환기 ✅

V-World OpenLayers 스타일을 MapLibre symbol layer JSON으로 변환합니다.

**주요 기능**:
- V-World 스타일 파일 파싱 (OpenLayers → MapLibre)
- cl_id별 스타일 클러스터링 (레이어 수 최소화)
- 좌표계 변환 (OpenLayers anchor → MapLibre icon-offset)
- 폰트 매핑 (V-World 코드 → 나눔고딕 조합)

**출력**: `poi-layers.json` (MapLibre layers 배열에 직접 삽입 가능)

---

### [glyph-builder/](./glyph-builder/) — 폰트 빌더 ✅

MapLibre용 글리프(폰트) 파일을 생성합니다.

**지원 폰트**:
- 나눔고딕 Regular
- 나눔고딕 Bold
- 나눔고딕 ExtraBold

**출력 위치**: `/public/font/*`

---

### [sprite-builder/](./sprite-builder/) — 스프라이트 빌더 ⚠️

POI 아이콘 스프라이트를 생성합니다.

**역할**: V-World POI 아이콘을 MapLibre sprite 형식으로 변환

**출력 위치**: `/public/sprite/*`

> ⚠️ **현재 상태**: 이 도구는 아직 완성되지 않았습니다. 수동으로 생성된 스프라이트 파일을 사용합니다.

---

## 개발 참고

- 각 도구는 독립적으로 실행 가능하며, 필요 시 재생성 가능합니다.
- `poi-layers.json`은 `app/data/poi-layers.json`으로 복사되어 애플리케이션에서 사용됩니다.
- 폰트와 스프라이트는 `/public/` 디렉토리에 정적 파일로 제공됩니다.

---

## 상태

| 도구 | 상태 | 설명 |
|------|------|------|
| style-builder | ✅ 완료 | V-World POI 스타일 변환 완성 |
| glyph-builder | ✅ 완료 | 나눔고딕 폰트 생성 도구 완성 |
| sprite-builder | ⚠️ 미완료 | 구현 필요 (TODO 목록 참조) |
