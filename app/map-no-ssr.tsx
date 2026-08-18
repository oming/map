"use client";

import { Spinner } from "@/components/ui/spinner";
import dynamic from "next/dynamic";

// SSR을 끄고 브라우저에서만 로드하도록 설정
const MapNoSSR = dynamic(() => import("@/components/map/v-world-map"), {
  ssr: false,
  loading: () => (
    <div className="flex w-full h-full items-center justify-center gap-2 py-10 text-4xl font-extrabold text-muted-foreground">
      <Spinner className="size-10" /> Loading map...
    </div>
  ),
});

export default function MapNoSSRComponent({
  children,
}: {
  children?: React.ReactNode;
}) {
  return <MapNoSSR>{children}</MapNoSSR>;
}
