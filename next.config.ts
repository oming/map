import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // reactStrictMode: false,

  // public/ 기본 캐시는 max-age=0 (Next.js 문서: file-conventions/public-folder).
  // headers()는 filesystem/public보다 먼저 검사되므로 여기서 덮어쓴다 — 파일명에
  // 버전을 넣지 않는 한 immutable은 위험하므로, 데이터 갱신 시 파일명을 바꾸는 것을 전제로 한다.
  async headers() {
    return [
      {
        source: "/data/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/maplibre-gl-worker.mjs",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
