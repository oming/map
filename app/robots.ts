import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /api/geo-search는 V-World 검색 프록시라 색인 가치가 없다.
      // /vworld.json, /osm.json은 README가 재사용을 권장하는 공개 스타일 API이므로 막지 않는다.
      // 루트의 .html/.txt(네이버 사이트 확인 파일)도 막으면 안 된다.
      disallow: "/api/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
