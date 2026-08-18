import type { DataLayerDef } from "./types";

export const wifiSuwonLayer: DataLayerDef = {
  id: "wifi-suwon",
  label: "공공 와이파이 (수원)",
  color: "#0ea5e9",
  source: {
    kind: "geojson",
    url: "/data/wifi-suwon.geojson",
    cluster: { radius: 50, maxZoom: 17 },
  },
  detail: {
    titleKey: "name",
    fields: [
      { key: "address", label: "주소" },
      { key: "ssid", label: "SSID" },
      { key: "provider", label: "제공사" },
      { key: "category", label: "구분" },
    ],
  },
  attribution: {
    name: "수원시 무료 와이파이 정보",
    url: "https://www.data.go.kr/",
    license: "공공누리 제1유형",
    updatedAt: "2026-05-12",
  },
};
