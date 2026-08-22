import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_TITLE,
    // 홈 화면 아이콘 아래 들어가는 짧은 이름 — 여기는 도메인 그대로가 낫다.
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    // app/icon.tsx의 generateImageMetadata가 만드는 라우트.
    // 상대 경로("icon/192")로 쓰면 manifest 위치가 바뀔 때 깨지므로 절대 경로로 둔다.
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
