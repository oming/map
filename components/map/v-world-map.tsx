"use client";

import { useEffect, useRef, useState } from "react";

import {
  isVWorldVectorTileUrl,
  VWORLD_API_KEY,
  VWORLD_VECTOR_MIN_ZOOM,
} from "@/lib/vworld/config";

// 한반도 전체가 보이는 기본 진입 뷰(신규 방문 시). 좌표 해시가 있는 URL은 이 값 대신 해시를 사용한다.
const INITIAL_VIEW_CENTER: [number, number] = [127.8, 36.5];
const INITIAL_VIEW_ZOOM = 7;

import { PbfReader } from "pbf";
import { VectorTile } from "@mapbox/vector-tile";
import {
  FullscreenControl,
  GeolocateControl,
  GlobeControl,
  Map,
  NavigationControl,
  Popup,
  ScaleControl,
  TerrainControl,
  addProtocol,
  setWorkerUrl,
  ErrorEvent,
} from "maplibre-gl";
import { Search } from "./search";
import { ReactControl } from "./react-control";
import { MapContext } from "./map-context";
import { fromVectorTileJs } from "@maplibre/vt-pbf";

setWorkerUrl("/maplibre-worker/maplibre-gl-worker.mjs");

const protocol = "reverse";

export default function VWorldMap({
  children,
}: {
  children?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapInstance) return;

    addProtocol(protocol, async (params, abortController) => {
      const url = params.url.replace(protocol + "://", "");

      return fetch(url)
        .then((response) => response.arrayBuffer())
        .then((data) => new VectorTile(new PbfReader(data)))
        .then((tile) => {
          const newTile: VectorTile = {
            layers: Object.entries(tile.layers).reduce(
              (acc, [layerId, layer]) => ({
                ...acc,
                [layerId]: {
                  ...layer,
                  name: "poi",
                  feature: (index: number) => {
                    const feature = layer.feature(index);
                    return feature;
                  },
                },
              }),
              {},
            ),
          };
          return newTile;
        })
        .then((tile) => fromVectorTileJs(tile).buffer)
        .then((data) => ({ data }));
    });

    const map = new Map({
      container: containerRef.current,
      style: `/vworld.json?key=${VWORLD_API_KEY}`,
      hash: true,
      center: INITIAL_VIEW_CENTER,
      zoom: INITIAL_VIEW_ZOOM,
      minZoom: VWORLD_VECTOR_MIN_ZOOM,
    });

    map.setTransformRequest((url, resourceType) => {
      if (isVWorldVectorTileUrl(url) && resourceType === "Tile") {
        return { url: protocol + "://" + url };
      }
      return undefined;
    });

    map.addControl(new NavigationControl(), "top-right");
    map.addControl(
      new GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
    );
    map.addControl(new FullscreenControl());
    map.addControl(
      new ScaleControl({
        maxWidth: 80,
        unit: "imperial",
      }),
    );
    map.addControl(new GlobeControl());

    map.addControl(
      new TerrainControl({
        source: "vworldPoi",
        exaggeration: 1,
      }),
    );

    const searchControl = new ReactControl(<Search />);
    map.addControl(searchControl, "top-left");

    map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point);

      const poi = features.find((feature) =>
        feature.layer.id.startsWith("poi-normal-"),
      );

      if (!poi) return;

      new Popup()
        .setLngLat(e.lngLat)
        .setHTML(`<pre>${JSON.stringify(poi.properties, null, 2)}</pre>`)
        .setMaxWidth("500px")
        .addTo(map);
    });

    map.on("error", (e: ErrorEvent) =>
      console.error("[MapLibre error]", e.error),
    );

    map.setMissingStyleImageResolver((id) => {
      console.warn("[스프라이트에 없는 cl_id]", id);
    });

    setMapInstance(map);
    return () => {
      map.remove();
      setMapInstance(null);
    };
  }, []);

  return (
    <MapContext.Provider value={{ map: mapInstance }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
        {children}
      </div>
    </MapContext.Provider>
  );
}
