import type { DetailFieldsSchemaFor } from "@/components/map/data/detail-fields";
import { dataUrl } from "./data-url";
import type { DataLayerDef } from "./types";

/** public/data/festival.geojson의 feature properties (tools/data-builder/build-festival.ts).
 *  전국 데이터라 비어 있는 필드가 흔하다 — 키가 빠지는 게 아니라 빈 문자열로 온다. */
interface FestivalProperties {
  name: string;
  place: string;
  startDate: string;
  endDate: string;
  content: string;
  host: string;
  organizer: string;
  sponsor: string;
  phone: string;
  homepage: string;
  relatedInfo: string;
  roadAddress: string;
  parcelAddress: string;
}

// lucide-react "ticket" 아이콘 (viewBox 24x24)에서 추출한 path — node_modules/lucide-react
// dist/esm/icons/ticket.mjs. wifi.ts/toilet.ts와 같은 이유로 문자열만 갖고 있는다.
const TICKET_ICON_PATHS = [
  "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z",
  "M13 5v2",
  "M13 17v2",
  "M13 11v2",
];

// 원본 homepageUrl 필드가 "www.example.com"처럼 스킴 없이 오는 경우가 많다 —
// <a href>에 그대로 넣으면 절대 URL이 아니라 현재 페이지 기준 상대경로로 해석돼
// 우리 사이트 내부로 이동해버린다. 스킴이 없으면 https://를 붙여 절대 URL로 만든다.
function normalizeExternalUrl(raw: string): string {
  if (!raw) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export const festivalLayer: DataLayerDef = {
  id: "festival",
  label: "전국 문화축제",
  color: "#f43f5e",
  icon: { paths: TICKET_ICON_PATHS },
  source: {
    kind: "geojson",
    url: dataUrl("festival"),
    cluster: { radius: 50, maxZoom: 17 },
  },
  detail: {
    titleKey: "name",
    // homepage/phone은 links 클로저가 읽어서 버튼으로 이미 노출된다 — 원본 텍스트
    // 필드로 중복 표시하지 않도록 숨긴다(phone은 "전화번호" override로 텍스트도
    // 같이 보여주는 게 유용해 제외, homepage는 URL 그대로 노출할 이유가 없다).
    hiddenKeys: ["relatedInfo", "parcelAddress", "homepage"],
    overrides: {
      place: { label: "개최장소" },
      startDate: { label: "시작일" },
      endDate: { label: "종료일" },
      content: { label: "축제내용" },
      host: { label: "주관기관" },
      organizer: { label: "주최기관" },
      sponsor: { label: "후원기관" },
      phone: { label: "전화번호" },
      roadAddress: { label: "주소" },
    },
    links: [
      {
        label: "홈페이지",
        href: (properties) => {
          const { homepage } = properties as unknown as FestivalProperties;
          return normalizeExternalUrl(homepage);
        },
      },
      {
        label: "전화",
        href: (properties) => {
          const { phone } = properties as unknown as FestivalProperties;
          return phone ? `tel:${phone}` : "";
        },
      },
    ],
    popupFields: ["place", "startDate", "endDate"],
  } satisfies DetailFieldsSchemaFor<FestivalProperties>,
  attribution: {
    name: "전국문화축제표준데이터",
    url: "https://www.data.go.kr/data/15013104/standard.do",
    license: "공공누리",
  },
};
