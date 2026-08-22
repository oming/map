import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * 색인 대상 HTML 라우트는 "/" 하나뿐이다.
 * - /vworld.json, /osm.json, /api/geo-search는 JSON 응답이라 넣지 않는다.
 * - #map=, #base=, #layers= 같은 프래그먼트 변형도 넣지 않는다 — 크롤러가 무시한다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
