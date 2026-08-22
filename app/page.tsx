import MapNoSSRComponent from "./map-no-ssr";
import { ServiceNotice } from "@/components/notice";
import { DataLayers } from "@/components/map/data";
import { PoiInfo } from "@/components/map/poi";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";

export default function Home() {
  return (
    <main style={{ width: "100dvw", height: "100dvh", margin: 0 }}>
      {/* 지도는 ssr:false라 서버 HTML이 사실상 비어 있다. 크롤러와 스크린리더가
          읽을 제목/설명을 시각적으로 숨긴 채로만 싣는다. */}
      <h1 className="sr-only">{SITE_TITLE}</h1>
      <p className="sr-only">{SITE_DESCRIPTION}</p>
      <MapNoSSRComponent>
        <DataLayers />
        <PoiInfo />
      </MapNoSSRComponent>
      <ServiceNotice />
    </main>
  );
}
