import MapNoSSRComponent from "./map-no-ssr";
import { ServiceNotice } from "@/components/notice";
import { DataLayers } from "@/components/map/data";
import { PoiInfo } from "@/components/map/poi";

export default function Home() {
  return (
    <main style={{ width: "100dvw", height: "100dvh", margin: 0 }}>
      <MapNoSSRComponent>
        <DataLayers />
        <PoiInfo />
      </MapNoSSRComponent>
      <ServiceNotice />
    </main>
  );
}
