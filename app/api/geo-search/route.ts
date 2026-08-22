import { NextRequest, NextResponse } from "next/server";
import {
  VWORLD_API_KEY,
  VWORLD_DOMAIN,
  getVWorldSearchUrl,
} from "@/lib/vworld/config";

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

/**
 * V-World search API의 원본 응답 형태. 좌표가 문자열로 오는 등 그대로 쓰기 어려워
 * 이 파일 안에서만 다루고, 바깥으로는 GeoSearchItem으로 변환해 내보낸다.
 */
interface VWorldSearchItem {
  id: string;
  title: string;
  category?: string;
  point: {
    /** 경도 — 숫자가 아니라 문자열로 내려온다. */
    x: string;
    /** 위도 — 숫자가 아니라 문자열로 내려온다. */
    y: string;
  };
  address?: {
    zipcode?: string;
    /** "road" | "parcel" — 주소 유형 */
    category?: string;
    road?: string;
    parcel?: string;
    bldnm?: string;
    bldnmdc?: string;
  };
}

interface VWorldSearchResponse {
  response: {
    status: "OK" | "NOT_FOUND" | "ERROR";
    error?: { code?: string; text?: string };
    record?: { total?: number | string };
    page?: { current?: number | string; total?: number | string };
    result?: { items?: VWorldSearchItem[] };
  };
}

function toGeoSearchItem(
  item: VWorldSearchItem,
  kind: GeoSearchItem["kind"],
): GeoSearchItem {
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
    category,
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

  const emptyResult: GeoSearchResponse = {
    items: [],
    totalCount: 0,
    page,
    totalPages: 0,
  };
  if (!query) return NextResponse.json(emptyResult);

  if (!VWORLD_API_KEY) {
    console.warn("[geo-search] NEXT_PUBLIC_VWORLD_API_KEY가 설정되지 않았습니다.");
    return NextResponse.json(emptyResult);
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
    key: VWORLD_API_KEY,
    ...(type === "address" ? { category: "road" } : {}),
    ...(VWORLD_DOMAIN ? { domain: VWORLD_DOMAIN } : {}),
    ...(bbox ? { bbox } : {}),
  });

  const vworldRes = await fetch(`${getVWorldSearchUrl()}?${params.toString()}`);
  const vworldResponse: VWorldSearchResponse = await vworldRes.json();

  if (vworldResponse?.response?.status === "NOT_FOUND") {
    return NextResponse.json(emptyResult);
  }
  if (vworldResponse?.response?.status === "ERROR") {
    const vworldError = vworldResponse.response.error ?? {};
    console.error("[geo-search] vworld error response:", vworldResponse);
    return NextResponse.json({
      items: [],
      totalCount: 0,
      page,
      totalPages: 0,
      error: {
        code: vworldError.code ?? "UNKNOWN",
        text: vworldError.text ?? "알 수 없는 오류",
      },
    } satisfies GeoSearchResponse);
  }

  const kind: GeoSearchItem["kind"] = type === "place" ? "PLACE" : "ADDRESS";
  const items = (vworldResponse.response.result?.items ?? []).map((item) =>
    toGeoSearchItem(item, kind),
  );

  return NextResponse.json({
    items,
    totalCount: Number(vworldResponse.response.record?.total ?? 0),
    page: Number(vworldResponse.response.page?.current ?? page),
    totalPages: Number(vworldResponse.response.page?.total ?? 0),
  } satisfies GeoSearchResponse);
}
