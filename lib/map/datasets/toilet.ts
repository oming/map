import type { DataLayerDef } from "./types";

// lucide-react "toilet" 아이콘 (viewBox 24x24)에서 추출한 path — node_modules/lucide-react
// dist/esm/icons/toilet.mjs. wifi.ts와 같은 이유로 문자열만 갖고 있는다.
const TOILET_ICON_PATHS = [
  "M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18",
  "M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8",
];

export const toiletSuwonLayer: DataLayerDef = {
  id: "toilet-suwon",
  label: "공중화장실 (수원)",
  color: "#f97316",
  icon: { paths: TOILET_ICON_PATHS },
  source: {
    kind: "geojson",
    url: "/data/toilet-suwon.geojson",
    cluster: { radius: 50, maxZoom: 17 },
  },
  detail: {
    titleKey: "name",
    fields: [
      { key: "address", label: "주소" },
      { key: "category", label: "구분" },
      { key: "openHours", label: "개방시간" },
      { key: "owner", label: "소유구분" },
      {
        key: "hasDiaperTable",
        label: "기저귀교환대",
        format: (v) => (v ? "있음" : "없음"),
      },
    ],
  },
  attribution: {
    name: "수원시 공중화장실 정보",
    url: "https://www.data.go.kr/",
    license: "공공누리 제1유형",
    updatedAt: "2026-02-20",
  },
};
