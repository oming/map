import { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { NextRequest, NextResponse } from "next/server";
import poiLayersRaw from "@/data/poi-layers.json";
import {
  getVWorldVectorBackgroundUrl,
  getVWorldVectorTileUrl,
  SITE_URL,
  VWORLD_VECTOR_MAX_ZOOM,
  VWORLD_VECTOR_MIN_ZOOM,
} from "@/lib/vworld/config";

export async function GET(request: NextRequest) {
  // 1. URL에서 searchParams(쿼리 스트링) 추출
  const searchParams = request.nextUrl.searchParams;
  const key = searchParams.get("key");

  if (!key) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing API key" },
      { status: 401 },
    );
  }

  const poiLayers = poiLayersRaw as unknown as LayerSpecification[];
  // 3. 반환할 JSON 데이터 정의 (예시 데이터)
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
      ...poiLayers,
    ],
  };

  // 4. JSON 응답 반환
  return NextResponse.json(style, {
    status: 200,
    headers: {
      // 필요 시 CORS나 캐시 설정을 추가할 수 있습니다.
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
