// app/api/geo-search/route.ts
import { NextRequest, NextResponse } from "next/server";

const VWORLD_KEY = process.env.VWORLD_API_KEY;
const VWORLD_DOMAIN = process.env.VWORLD_DOMAIN;

export type GeoSearchItem = {
  id: string;
  kind: "PLACE" | "ADDRESS";
  title: string;
  subtitle: string;
  lon: number;
  lat: number;
  category?: string;
  zipcode?: string;
  road?: string;
  parcel?: string;
  bldnm?: string;
  bldnmdc?: string;
};

export type GeoSearchResponseError = {
  code: string;
  text: string;
};

export type GeoSearchResponse = {
  items: GeoSearchItem[];
  totalCount: number;
  page: number;
  totalPages: number;
  error?: GeoSearchResponseError;
};

function normalize(item: any, kind: "PLACE" | "ADDRESS"): GeoSearchItem {
  // vworld는 point.x / point.y를 문자열로 내려줌 -> 반드시 숫자 변환
  const lon = Number(item.point.x);
  const lat = Number(item.point.y);

  if (kind === "PLACE") {
    return {
      id: `place-${item.id}`,
      kind,
      title: item.title,
      subtitle: item.address?.road || item.address?.parcel || "",
      lon,
      lat,
      category: item.category,
      road: item.address?.road,
      parcel: item.address?.parcel,
    };
  }

  const { zipcode, category, road, parcel, bldnm, bldnmdc } =
    item.address ?? {};
  return {
    id: `address-${item.id}`,
    kind,
    title: bldnm || road || parcel || "",
    subtitle: bldnm ? (road ?? "") : (parcel ?? ""),
    lon,
    lat,
    category, // "road" | "parcel" (주소 유형)
    zipcode,
    road,
    parcel,
    bldnm,
    bldnmdc: bldnmdc || undefined,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get("query")?.trim();
  const type = (searchParams.get("type") ?? "place") as "place" | "address";
  const bbox = searchParams.get("bbox") ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const size = Math.min(
    50,
    Math.max(1, Number(searchParams.get("size") ?? 10)),
  );

  const empty: GeoSearchResponse = {
    items: [],
    totalCount: 0,
    page,
    totalPages: 0,
  };
  if (!query) return NextResponse.json(empty);

  if (!VWORLD_KEY) {
    console.warn("[geo-search] VWORLD_API_KEY가 설정되지 않았습니다.");
    return NextResponse.json(empty);
  }

  const params = new URLSearchParams({
    service: "search",
    request: "search",
    version: "2.0",
    crs: "EPSG:4326",
    size: String(size),
    page: String(page),
    query,
    type,
    format: "json",
    errorFormat: "json",
    key: VWORLD_KEY,
    ...(type === "address" ? { category: "road" } : {}),
    ...(VWORLD_DOMAIN ? { domain: VWORLD_DOMAIN } : {}),
    ...(bbox ? { bbox } : {}),
  });

  const res = await fetch(
    `https://api.vworld.kr/req/search?${params.toString()}`,
  );
  const data = await res.json();

  console.log("[geo-search] vworld response:", data);

  if (data?.response?.status === "NOT_FOUND") return NextResponse.json(empty);
  if (data?.response?.status === "ERROR") {
    const err = data.response.error ?? {};
    return NextResponse.json({
      items: [],
      totalCount: 0,
      page,
      totalPages: 0,
      error: {
        code: err.code ?? "UNKNOWN",
        text: err.text ?? "알 수 없는 오류",
      },
    } satisfies GeoSearchResponse);
  }

  const kind = type === "place" ? "PLACE" : "ADDRESS";
  const items = (data.response.result?.items ?? []).map((item: any) =>
    normalize(item, kind),
  );

  return NextResponse.json({
    items,
    totalCount: Number(data.response.record?.total ?? 0),
    page: Number(data.response.page?.current ?? page),
    totalPages: Number(data.response.page?.total ?? 0),
  } satisfies GeoSearchResponse);
}
