import type { StyleSpecification } from "maplibre-gl";
import { NextRequest, NextResponse } from "next/server";
import { POI_LAYERS } from "@/lib/vworld/poi-layers";
import {
  getVWorldVectorBackgroundUrl,
  getVWorldVectorTileUrl,
  SITE_URL,
  VWORLD_VECTOR_MAX_ZOOM,
  VWORLD_VECTOR_MIN_ZOOM,
} from "@/lib/vworld/config";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");

  if (!key) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing API key" },
      { status: 401 },
    );
  }

  const style: StyleSpecification = {
    version: 8,
    name: "V-World",
    sprite: `${SITE_URL}/sprite/sprite`,
    glyphs: `${SITE_URL}/font/{fontstack}/{range}.pbf`,
    sources: {
      vworldBase: {
        type: "raster",
        tiles: [getVWorldVectorBackgroundUrl("Base")],
        tileSize: 256,
        minzoom: VWORLD_VECTOR_MIN_ZOOM,
        maxzoom: VWORLD_VECTOR_MAX_ZOOM,
        attribution: `<a href="https://www.vworld.kr/" target="_blank">&copy; V-World</a>`,
      },
      vworldPoi: {
        type: "vector",
        tiles: [`${getVWorldVectorTileUrl("poi")}`],
        minzoom: VWORLD_VECTOR_MIN_ZOOM,
        maxzoom: VWORLD_VECTOR_MAX_ZOOM,
      },
      vworldTraffic: {
        type: "vector",
        tiles: [getVWorldVectorTileUrl("traffic")],
        minzoom: VWORLD_VECTOR_MIN_ZOOM,
        maxzoom: VWORLD_VECTOR_MAX_ZOOM,
      },
    },
    layers: [
      { id: "vworld-base", type: "raster", source: "vworldBase" },
      ...POI_LAYERS,
      // 데이터 레이어를 결정적인 z-order로 addLayer(spec, "slot-overlay")하기 위한 앵커.
      // 소스 없는 투명 background라 렌더 비용 0이고, 순서 재조정(moveLayer)이 필요 없다.
      { id: "slot-overlay", type: "background", layout: { visibility: "none" } },
    ],
  };

  return NextResponse.json(style, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
