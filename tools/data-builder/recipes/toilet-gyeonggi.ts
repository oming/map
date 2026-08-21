import { nfc, pick } from "../lib/geojson.js";
import { pickMeaningful } from "../lib/normalize.js";
import type { BuildRecipe } from "../lib/recipe-types.js";

interface Facility {
  name: string;
  address: string;
  category: string;
  openHours: string;
  owner: string;
  phone: string;
  hasDiaperTable: boolean;
}

function toFacility(row: Record<string, string>): Facility {
  return {
    name: nfc(pick(row, "화장실명")) || "공중화장실",
    address: nfc(
      pick(row, "소재지도로명주소") || pick(row, "소재지지번주소"),
    ),
    category: pick(row, "구분"),
    openHours: pickMeaningful(row, "개방시간"),
    owner: pickMeaningful(row, "화장실소유구분"),
    phone: pick(row, "전화번호"),
    hasDiaperTable: pick(row, "기저귀교환대유무") === "Y",
  };
}

export const recipe: BuildRecipe = {
  id: "toilet-gyeonggi",
  label: "공중화장실 (경기도)",
  inputFile: "toilet-gyeonggi.csv",
  inputFormat: "csv",
  coordinates: { kind: "present", latKey: "위도", lonKey: "경도" },
  mapRow: (row) => ({ ...toFacility(row) }),
  dedup: {
    // 원본에 이름+주소가 완전히 같은 행이 그대로 중복 입력된 경우가 있다.
    // 같은 좌표 안에서만 중복 제거한다 — 다른 좌표의 동명 시설(체인점 등)은 안 건드림.
    // 원본이 건물 단위로만 좌표를 제공해 같은 좌표에 여러 시설이 남는 경우가 흔하지만
    // (예: 스타필드/신세계백화점/이마트가 한 좌표에 섞여 있는 경우), 병합하지 않고
    // 개별 feature로 둔다 — 지도 위에서 spiderfy로 펼쳐서 선택한다.
    signature: (row) => {
      const f = toFacility(row);
      return `${f.name}||${f.address}`;
    },
  },
};
