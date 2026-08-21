import { nfc, pick } from "../lib/geojson.js";
import type { BuildRecipe } from "../lib/recipe-types.js";

export const recipe: BuildRecipe = {
  id: "wifi-suwon",
  label: "공공 와이파이 (수원)",
  inputFile: "wifi-suwon.csv",
  inputFormat: "csv",
  coordinates: { kind: "present", latKey: "WGS84위도", lonKey: "WGS84경도" },
  mapRow: (row) => ({
    id: pick(row, "관리번호"),
    name: nfc(pick(row, "설치장소명")),
    address: nfc(
      pick(row, "소재지도로명주소") || pick(row, "소재지지번주소"),
    ),
    ssid: pick(row, "와이파이SSID"),
    provider: pick(row, "서비스제공사명"),
    category: pick(row, "설치시설구분명"),
  }),
};
