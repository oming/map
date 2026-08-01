# Sprite Builder — 스프라이트 빌더

POI 아이콘 스프라이트를 MapLibre sprite 형식으로 생성하는 도구입니다.

## 개요

MapLibre GL JS에서 POI(관심 장소) 아이콘을 렌더링하기 위해 필요한 **스프라이트(Sprite)** 파일을 생성합니다. 스프라이트는 여러 작은 이미지를 하나의 큰 이미지와 매핑 파일에 정리하는 형식입니다.

## 현재 상태

⚠️ **이 도구는 아직 완성되지 않았습니다.** 

현재 프로젝트에서는 V-World에서 제공하는 기존 스프라이트를 사용하거나, 수동으로 생성된 스프라이트 파일을 `/public/sprite/` 디렉토리에 배치하여 사용하고 있습니다.

## 필요 기능 (미구현)

### 1. 아이콘 추출
- V-World POI 데이터에서 `cl_id` 기반 아이콘 이미지 추출
- OpenLayers 스타일 정의에서 `symbolImageCn` 참조

### 2. 스프라이트 생성
- 여러 작은 아이콘 이미지를 하나의 큰 PNG 파일로 합치기
- 각 이미지의 위치 정보 (x, y, width, height) 매핑

### 3. JSON 매핑 파일 생성
- 각 `cl_id` → 스프라이트 내 위치 매핑
- MapLibre sprite 형식 (`{width, height, pixelRatio}`) 준수

## 출력 형식

```
/Users/anhyosang/Developer/map.qwer.dev/public/sprite/
├── sprite.png          # 아이콘 이미지 (스프라이트 시트)
└── sprite.json         # 각 cl_id → 위치 매핑
```

### sprite.json 구조 예시

```json
{
  "cl_001": {
    "width": 32,
    "height": 32,
    "pixelRatio": 1
  },
  "cl_002": {
    "width": 24,
    "height": 24,
    "pixelRatio": 1
  }
}
```

## 현재 사용 중인 스프라이트

현재 프로젝트에서는 `app/vworld.json/route.ts` 에서:

```javascript
const style = {
  sprite: `${publicUrl}/sprite/sprite`,
  // ...
};
```

이렇게 참조하며, `/public/sprite/` 디렉토리에 수동으로 배치된 파일을 사용합니다.

## 관련 도구

- [style-builder](../style-builder/) — POI 스타일 변환기 (icon-image 매핑에 사용)
- [glyph-builder](../glyph-builder/) — 폰트 파일 생성

## 구현 계획 (TODO)

- [ ] V-World POI 아이콘 이미지 소스 파악
- [ ] 이미지 추출 로직 개발
- [ ] 스프라이트 시트 생성 알고리즘 구현
- [ ] sprite.json 매핑 파일 자동 생성
- [ ] style-builder와 통합 테스트

## 참고 사항

- MapLibre는 스프라이트의 `pixelRatio`를 1로 가정합니다.
- 각 cl_id는 스프라이트 내에서 고유한 위치 (x, y) 에 매핑되어야 합니다.
- icon-offset 계산 정확도를 위해 style-builder에서 sprite.json 제공을 권장합니다.
