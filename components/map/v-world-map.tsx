"use client";

import { useEffect, useRef, useState } from "react";

import { VWORLD_API_KEY, VWORLD_VECTOR_MIN_ZOOM } from "@/lib/vworld/config";

const SEOUL_CITY_HALL: [number, number] = [126.978, 37.5665];

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
  Marker,
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
      // console.log("addProtocol url", url);

      return fetch(url)
        .then((response) => response.arrayBuffer())
        .then((data) => new VectorTile(new PbfReader(data)))
        .then((tile) => {
          const rows = Object.entries(tile.layers).flatMap(
            ([layerName, layer]) =>
              Array.from({ length: layer.length }, (_, i) => ({
                layerName,
                featureIndex: i,
                ...layer.feature(i).properties,
              })),
          );
          // console.log("before tile", tile);
          // console.log(JSON.stringify(rows, null, 2));
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
      // .then((tile) => fromVectorTileJs(tile))
      // .then((data) => {
      //   const tile = new VectorTile(new PbfReader(data));

      //   // const rows = Object.entries(tile.layers).flatMap(
      //   //   ([layerName, layer]) =>
      //   //     Array.from({ length: layer.length }, (_, i) => ({
      //   //       layerName,
      //   //       featureIndex: i,
      //   //       ...layer.feature(i).properties,
      //   //     })),
      //   // );

      //   // console.log("after tile", tile);
      //   // console.log(JSON.stringify(rows, null, 2));
      //   return { data: fromVectorTileJs(tile).buffer };
      // })
    });

    const map = new Map({
      container: containerRef.current,
      style: `/vworld.json?key=${VWORLD_API_KEY}`,
      hash: true,
      center: SEOUL_CITY_HALL,
      zoom: 14,
      minZoom: VWORLD_VECTOR_MIN_ZOOM,
      // maxZoom: VWORLD_VECTOR_MAX_ZOOM,
      // transformRequest: (url, resourceType) => {
      //   // console.log("transformRequest", { url, resourceType });
      //   if (
      //     url.startsWith("https://api.vworld.kr/req/wmts/vector/getTile/") &&
      //     resourceType === "Tile"
      //   ) {
      //     return { url: protocol + "://" + url };
      //   }
      //   return undefined;
      // },
    });

    map.setTransformRequest((url, resourceType) => {
      // console.log("setTransformRequest", { url, resourceType });
      if (
        url.startsWith("https://api.vworld.kr/req/wmts/vector/getTile/") &&
        resourceType === "Tile"
      ) {
        // console.log("gogogo");
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

    const marker = new Marker().setLngLat(SEOUL_CITY_HALL).addTo(map);

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
