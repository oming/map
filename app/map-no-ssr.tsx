"use client";

import dynamic from "next/dynamic";

// SSR을 끄고 브라우저에서만 로드하도록 설정
const MapNoSSR = dynamic(() => import("@/components/map/v-world-map"), {
  ssr: false,
  loading: () => <div>loadding...</div>,
});

export default function MapNoSSRComponent() {
  return <MapNoSSR />;
}
