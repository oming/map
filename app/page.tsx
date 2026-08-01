// import VWorldMap from "@/components/map/VWorldMap";
import MapNoSSRComponent from "./map-no-ssr";

export default function Home() {
  return (
    <main style={{ width: "100vw", height: "100vh", margin: 0 }}>
      <MapNoSSRComponent />
      {/* <VWorldMap /> */}
    </main>
  );
}
