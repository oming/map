import type { DetailFieldsSchemaFor } from "@/components/map/data/detail-fields";
import type { DataLayerDef } from "./types";

/** public/data/wifi-suwon.geojson의 feature properties (tools/data-builder/recipes/wifi-suwon.ts).
 *  값이 없는 필드는 키가 빠지는 게 아니라 빈 문자열로 온다. */
interface WifiProperties {
  id: string;
  name: string;
  address: string;
  ssid: string;
  provider: string;
  category: string;
}

// lucide-react "wifi" 아이콘 (viewBox 24x24)에서 추출한 path — node_modules/lucide-react
// dist/esm/icons/wifi.mjs. 런타임에 lucide-react를 불러오지 않고 Canvas 2D로 직접
// stroke하므로 문자열만 필요하다.
const WIFI_ICON_PATHS = [
  "M12 20h.01",
  "M2 8.82a15 15 0 0 1 20 0",
  "M5 12.859a10 10 0 0 1 14 0",
  "M8.5 16.429a5 5 0 0 1 7 0",
];

export const wifiSuwonLayer: DataLayerDef = {
  id: "wifi-suwon",
  label: "공공 와이파이 (수원)",
  color: "#0ea5e9",
  icon: { paths: WIFI_ICON_PATHS },
  source: {
    kind: "geojson",
    url: "/data/wifi-suwon.geojson",
    cluster: { radius: 50, maxZoom: 17 },
  },
  detail: {
    titleKey: "name",
    hiddenKeys: ["id"],
    overrides: {
      address: { label: "주소" },
      ssid: { label: "SSID" },
      provider: { label: "제공사" },
      category: { label: "구분" },
    },
    popupFields: ["address", "ssid"],
  } satisfies DetailFieldsSchemaFor<WifiProperties>,
  attribution: {
    name: "수원시 무료 와이파이 정보",
    url: "https://www.data.go.kr/",
    license: "공공누리 제1유형",
    updatedAt: "2026-05-12",
  },
};
