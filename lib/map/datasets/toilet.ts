import type { DataLayerDef } from "./types";

export const toiletSuwonLayer: DataLayerDef = {
  id: "toilet-suwon",
  label: "공중화장실 (수원)",
  color: "#f97316",
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
