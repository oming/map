import { nfc, pick } from "../lib/geojson.js";
import type { BuildRecipe } from "../lib/recipe-types.js";

export const recipe: BuildRecipe = {
  id: "toilet-suwon",
  label: "공중화장실 (수원)",
  inputFile: "toilet-suwon.csv",
  inputFormat: "csv",
  coordinates: {
    kind: "geocode",
    roadAddressKey: "소재지도로명주소",
    parcelAddressKey: "소재지지번주소",
  },
  mapRow: (row, meta) => {
    const address =
      pick(row, "소재지도로명주소") || pick(row, "소재지지번주소");
    return {
      id: pick(row, "관리번호"),
      name: nfc(pick(row, "화장실명")),
      address: nfc(address),
      category: pick(row, "구분명"),
      openHours: pick(row, "개방시간상세") || pick(row, "개방시간"),
      owner: pick(row, "화장실소유구분명"),
      hasDiaperTable: pick(row, "기저귀교환대유무") === "Y",
      geocodeType: meta.geocodeType,
    };
  },
};
