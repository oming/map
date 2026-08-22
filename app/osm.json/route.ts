import type { StyleSpecification } from "maplibre-gl";
import { NextResponse } from "next/server";
import { OSM_STYLE } from "@/lib/map/osm-style";
import { SLOT_OVERLAY_LAYER } from "@/lib/map/slot-overlay";
import { POI_LAYERS } from "@/lib/vworld/poi-layers";
import {
  getVWorldVectorTileUrl,
  SITE_URL,
  VWORLD_VECTOR_MAX_ZOOM,
  VWORLD_VECTOR_MIN_ZOOM,
} from "@/lib/vworld/config";

export async function GET() {
  const style: StyleSpecification = {
    ...OSM_STYLE,
    sprite: [
      // sprite id는 반드시 "basics"여야 한다 — OSM 스타일의 icon-image가 전부
      // "basics:icon-*" 프리픽스를 쓴다(tools/osm-style-builder/README.md 참고).
      { id: "basics", url: `${SITE_URL}/sprite-osm/basics/sprites` },
      // id를 "default"로 주면 MapLibre가 프리픽스 없이 해석한다 — POI_LAYERS의
      // icon-image 값(예: "cl_001")이 app/vworld.json과 동일하게 그대로 통한다.
      { id: "default", url: `${SITE_URL}/sprite/sprite` },
    ],
    glyphs: `${SITE_URL}/font/{fontstack}/{range}.pbf`,
    sources: {
      ...OSM_STYLE.sources,
      // OSM 자체 POI는 VersaTiles colorful 설계상 거의 안 보인다(opacity 낮음, 라벨 없음).
      // 대신 이 앱이 이미 갖고 있는 V-World POI(vworld.json과 동일한 소스/레이어)를 얹는다.
      vworldPoi: {
        type: "vector",
        tiles: [getVWorldVectorTileUrl("poi")],
        minzoom: VWORLD_VECTOR_MIN_ZOOM,
        maxzoom: VWORLD_VECTOR_MAX_ZOOM,
      },
    },
    layers: [...OSM_STYLE.layers, ...POI_LAYERS, SLOT_OVERLAY_LAYER],
  };

  return NextResponse.json(style, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
