import { dataUrl } from "./data-url";
import type { DataLayerDef } from "./types";

// lucide-react "utensils" 아이콘 (viewBox 24x24)에서 추출한 path — node_modules/lucide-react
// dist/esm/icons/utensils.mjs. wifi.ts/toilet.ts와 같은 이유로 문자열만 갖고 있는다.
const UTENSILS_ICON_PATHS = [
  "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2",
  "M7 2v20",
  "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7",
];

export const restaurantSuwonLayer: DataLayerDef = {
  id: "restaurant-suwon",
  label: "맛집 100선 (수원)",
  color: "#22c55e",
  icon: { paths: UTENSILS_ICON_PATHS },
  source: {
    kind: "geojson",
    url: dataUrl("restaurant-suwon"),
    cluster: { radius: 50, maxZoom: 17 },
  },
  detail: {
    titleKey: "name",
    // phone/naverUrl은 links의 href 클로저가 읽는다 — 정적으로 감지되지 않으므로
    // 자동 노출에서 직접 제외해야 한다.
    hiddenKeys: ["id", "phone", "naverUrl"],
    overrides: {
      address: { label: "주소" },
      category: { label: "주요 메뉴" },
    },
    links: [
      { label: "네이버 지도", href: (p) => p.naverUrl as string },
      { label: "전화", href: (p) => `tel:${p.phone as string}` },
    ],
    popupFields: ["address", "category"],
  },
  attribution: {
    name: "수원시 맛집 100선",
  },
};
