/**
 * 사이트 전역 상수의 **단일 진입점**. 메타데이터/사이트맵/robots/manifest/OG 이미지와
 * 스타일 라우트(`app/vworld.json`, `app/osm.json`)가 모두 여기서만 값을 읽는다.
 * `process.env.NEXT_PUBLIC_SITE_URL`을 다른 곳에서 다시 읽지 말 것 — 폴백이 갈리면
 * canonical URL과 스타일 JSON의 sprite/glyphs 호스트가 서로 어긋난다.
 */

/** 이 앱이 배포된 공개 베이스 URL (예: https://map.qwer.dev). 로컬에서는 보통 http://localhost:3000. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const SITE_NAME = "map.qwer.dev";

export const SITE_TITLE = "지도로 보는 대한민국 공공정보";

/** SERP에서 잘리지 않도록 공백 포함 150자 이내로 유지한다. */
export const SITE_DESCRIPTION =
  "표로만 흩어져 있던 대한민국 공공정보를 지도 위에서 한눈에 확인하세요. 공공 와이파이, 공중화장실, 문화축제를 일반지도·위성사진 위에 겹쳐 봅니다.";

/**
 * 일반 사용자용 키워드가 앞, 개발자 키워드가 뒤.
 * 브이월드·MapLibre는 타이틀/설명에서는 뺐지만(구현 수단이지 서비스의 정의가 아니다)
 * README가 `/vworld.json` 스타일 API 재사용을 공개 목표로 적고 있으므로 여기에는 남긴다.
 */
export const SITE_KEYWORDS = [
  "지도",
  "대한민국 지도",
  "공공데이터",
  "공공정보",
  "공공 와이파이",
  "공중화장실",
  "문화축제",
  "위성지도",
  "브이월드",
  "V-World",
  "MapLibre",
];
