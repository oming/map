import type { StyleSpecification } from "maplibre-gl";
import { NextResponse } from "next/server";
import { OSM_STYLE } from "@/lib/map/osm-style";
import { SLOT_OVERLAY_LAYER } from "@/lib/map/slot-overlay";
import { SITE_URL } from "@/lib/vworld/config";

export async function GET() {
  const style: StyleSpecification = {
    ...OSM_STYLE,
    // sprite id는 반드시 "basics"여야 한다 — 원본 스타일의 icon-image가 전부
    // "basics:icon-*" 프리픽스를 쓴다(tools/osm-style-builder/README.md 참고).
    sprite: [{ id: "basics", url: `${SITE_URL}/sprite-osm/basics/sprites` }],
    glyphs: `${SITE_URL}/font/{fontstack}/{range}.pbf`,
    layers: [...OSM_STYLE.layers, SLOT_OVERLAY_LAYER],
  };

  return NextResponse.json(style, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
