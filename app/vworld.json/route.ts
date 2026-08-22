import type { RasterSourceSpecification, StyleSpecification } from "maplibre-gl";
import { NextRequest, NextResponse } from "next/server";
import { POI_LAYERS } from "@/lib/vworld/poi-layers";
import {
  getVWorldRasterTileUrl,
  getVWorldVectorBackgroundUrl,
  getVWorldVectorTileUrl,
  VWORLD_RASTER_MAX_ZOOM,
  VWORLD_RASTER_MIN_ZOOM,
  VWORLD_VECTOR_MAX_ZOOM,
  VWORLD_VECTOR_MIN_ZOOM,
} from "@/lib/vworld/config";
import { SITE_URL } from "@/lib/site";
import { SLOT_OVERLAY_LAYER } from "@/lib/map/slot-overlay";

const VWORLD_ATTRIBUTION = `<a href="https://www.vworld.kr/" target="_blank">&copy; V-World</a>`;

function buildBaseSource(base: string): RasterSourceSpecification {
  if (base === "satellite") {
    return {
      type: "raster",
      tiles: [getVWorldRasterTileUrl("Satellite")],
      tileSize: 256,
      minzoom: VWORLD_RASTER_MIN_ZOOM,
      maxzoom: VWORLD_RASTER_MAX_ZOOM,
      attribution: VWORLD_ATTRIBUTION,
    };
  }
  return {
    type: "raster",
    tiles: [getVWorldVectorBackgroundUrl("Base")],
    tileSize: 256,
    minzoom: VWORLD_VECTOR_MIN_ZOOM,
    maxzoom: VWORLD_VECTOR_MAX_ZOOM,
    attribution: VWORLD_ATTRIBUTION,
  };
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");

  if (!key) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing API key" },
      { status: 401 },
    );
  }

  const base = request.nextUrl.searchParams.get("base") === "satellite"
    ? "satellite"
    : "vector";

  const style: StyleSpecification = {
    version: 8,
    name: base === "satellite" ? "V-World Satellite" : "V-World",
    sprite: `${SITE_URL}/sprite/sprite`,
    glyphs: `${SITE_URL}/font/{fontstack}/{range}.pbf`,
    sources: {
      vworldBase: buildBaseSource(base),
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
      {
        id: "vworld-base",
        type: "raster",
        source: "vworldBase",
        // 위성 항공사진은 옥상/구름이 밝아 #333 POI 라벨(흰 할로)이 묻힌다 —
        // 살짝 어둡고 채도를 낮춰 라벨 대비를 확보한다. 벡터 배경은 원래 그대로 둔다.
        ...(base === "satellite"
          ? {
              paint: {
                "raster-brightness-max": 0.82,
                "raster-saturation": -0.15,
              },
            }
          : {}),
      },
      ...POI_LAYERS,
      SLOT_OVERLAY_LAYER,
    ],
  };

  return NextResponse.json(style, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });
}
