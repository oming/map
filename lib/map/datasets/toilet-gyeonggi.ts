import type { DataLayerDef } from "./types";

// lucide-react "toilet" 아이콘 (viewBox 24x24)에서 추출한 path — node_modules/lucide-react
// dist/esm/icons/toilet.mjs. toilet.ts(수원)와 동일 아이콘, 색만 다르게 구분한다.
const TOILET_ICON_PATHS = [
  "M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18",
  "M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8",
];

export const toiletGyeonggiLayer: DataLayerDef = {
  id: "toilet-gyeonggi",
  label: "공중화장실 (경기도)",
  color: "#a855f7",
  icon: { paths: TOILET_ICON_PATHS },
  source: {
    kind: "geojson",
    url: "/data/toilet-gyeonggi.geojson",
    cluster: { radius: 50, maxZoom: 17 },
  },
  detail: {
    titleKey: "name",
    overrides: {
      address: { label: "주소" },
      category: { label: "구분" },
      openHours: { label: "개방시간" },
      owner: { label: "소유구분" },
      phone: { label: "전화번호" },
      hasDiaperTable: {
        label: "기저귀교환대",
        format: (v) => (v ? "있음" : "없음"),
      },
    },
    popupFields: ["address", "category", "openHours"],
  },
  attribution: {
    name: "경기도 공중화장실 표준데이터",
    url: "https://www.data.go.kr/",
    license: "공공누리 제1유형",
  },
};
