"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import {
  getVWorldVectorBackgroundUrl,
  getVWorldVectorTileUrl,
  VWORLD_API_KEY,
  VWORLD_VECTOR_MAX_ZOOM,
  VWORLD_VECTOR_MIN_ZOOM,
} from "@/lib/vworld/config";

const SEOUL_CITY_HALL: [number, number] = [126.978, 37.5665];
import "@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css";

import { PbfReader } from "pbf";
import { VectorTile } from "@mapbox/vector-tile";
import { fromVectorTileJs as tileToProtobuf } from "vt-pbf";
import {
  FullscreenControl,
  GeolocateControl,
  GlobeControl,
  Map,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
  TerrainControl,
  addProtocol,
  setWorkerUrl,
} from "maplibre-gl";
import MaplibreGeocoder, {
  CarmenGeojsonFeature,
  MaplibreGeocoderApi,
} from "@maplibre/maplibre-gl-geocoder";
// setWorkerUrl(
//   new URL(
//     "maplibre-gl/dist/maplibre-gl-worker.mjs",
//     import.meta.url,
//   ).toString(),
// );
// setWorkerUrl(
//   new URL(
//     "maplibre-gl/dist/maplibre-gl-shared.mjs",
//     import.meta.url,
//   ).toString(),
// );

// setWorkerUrl("/maplibre-gl-worker.mjs");
setWorkerUrl("/maplibre-worker/maplibre-gl-worker.mjs");

const protocol = "reverse";

export default function VWorldMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // addProtocol(protocol, async (params, abortController) => {
    //   console.log("addProtocol", { params });
    //   const url = params.url.replace(protocol + "://", "");

    //   const t = await fetch(url);
    //   if (t.status == 200) {
    //     const buffer = await t.arrayBuffer();
    //     return { data: buffer };
    //   } else {
    //     throw new Error(`Tile fetch error: ${t.statusText}`);
    //   }
    // });

    addProtocol(protocol, (request) => {
      const url = request.url.replace(protocol + "://", "");
      console.log("addProtocol url", url);

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
          console.log("before tile", tile);
          console.log(JSON.stringify(rows, null, 2));
          return {
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
        })
        .then((tile) => tileToProtobuf(tile).buffer)
        .then((data) => {
          const tile = new VectorTile(new PbfReader(data));

          const rows = Object.entries(tile.layers).flatMap(
            ([layerName, layer]) =>
              Array.from({ length: layer.length }, (_, i) => ({
                layerName,
                featureIndex: i,
                ...layer.feature(i).properties,
              })),
          );

          console.log("after tile", tile);
          console.log(JSON.stringify(rows, null, 2));
          return { data };
        });
    });

    const map = new Map({
      container: containerRef.current,

      style: `/vworld.json?key=${VWORLD_API_KEY}`,

      center: SEOUL_CITY_HALL,
      zoom: 14,
      minZoom: VWORLD_VECTOR_MIN_ZOOM,
      // maxZoom: VWORLD_VECTOR_MAX_ZOOM,
      hash: true,
      transformRequest: (url, resourceType) => {
        console.log("transformRequest", { url, resourceType });
        if (
          url.startsWith("https://api.vworld.kr/req/wmts/vector/getTile/") &&
          resourceType === "Tile"
        ) {
          return { url: protocol + "://" + url };
        }
        return undefined;
      },
    });

    map.setTransformRequest((url, resourceType) => {
      console.log("setTransformRequest", { url, resourceType });
      if (
        url.startsWith("https://api.vworld.kr/req/wmts/vector/getTile/") &&
        resourceType === "Tile"
      ) {
        console.log("gogogo");
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

    map.addControl(
      new MaplibreGeocoder(
        {
          forwardGeocode: async (config) => {
            const features: CarmenGeojsonFeature[] = [];
            try {
              const request = `https://nominatim.openstreetmap.org/search?q=${
                config.query
              }&format=geojson&polygon_geojson=1&addressdetails=1`;
              const response = await fetch(request);
              const geojson = await response.json();
              for (const feature of geojson.features) {
                const center: [number, number] = [
                  feature.bbox[0] + (feature.bbox[2] - feature.bbox[0]) / 2,
                  feature.bbox[1] + (feature.bbox[3] - feature.bbox[1]) / 2,
                ];
                const point: CarmenGeojsonFeature = {
                  type: "Feature",
                  geometry: {
                    type: "Point",
                    coordinates: center,
                  },
                  place_name: feature.properties.display_name,
                  properties: feature.properties,
                  text: feature.properties.display_name,
                  place_type: ["place"],
                  center,
                };
                features.push(point);
              }
            } catch (e) {
              console.error(`Failed to forwardGeocode with error: ${e}`);
            }

            return {
              type: "FeatureCollection",
              features,
            };
          },
        },
        {
          limit: 1000,
          marker: true,
          showResultMarkers: true,
          maplibregl: maplibregl,
        },
      ),
      "top-left",
    );

    // map.on("mousemove", (e) => {
    //   const features = map.queryRenderedFeatures(e.point);
    //   console.log("mousemove features", features);

    //   // Limit the number of properties we're displaying for
    //   // legibility and performance
    //   const displayProperties = [
    //     "type",
    //     "properties",
    //     "id",
    //     "layer",
    //     "source",
    //     "sourceLayer",
    //     "state",
    //   ];

    //   const displayFeatures = features.map((feat) => {
    //     const displayFeat = {};
    //     displayProperties.forEach((prop) => {
    //       displayFeat[prop] = feat[prop];
    //     });
    //     return displayFeat;
    //   });

    //   const ele = document.getElementById("features");
    //   if (!ele) return;
    //   if (displayFeatures.length > 0) {
    //     ele.style.display = "block";
    //     ele.innerHTML = JSON.stringify(displayFeatures, null, 2);
    //   } else {
    //     ele.style.display = "none";
    //   }
    // });

    // map.on("click", "poi-normal-*", (e) => {
    //   const features = map.queryRenderedFeatures(e.point);
    //   const displayProperties = [
    //     "type",
    //     "properties",
    //     "id",
    //     "layer",
    //     "source",
    //     "sourceLayer",
    //     "state",
    //   ];

    //   const displayFeatures = features.map((feat) => {
    //     const displayFeat = {};
    //     displayProperties.forEach((prop) => {
    //       displayFeat[prop] = feat[prop];
    //     });
    //     return displayFeat;
    //   });

    //   console.log("kkkk");

    //   new Popup()
    //     .setLngLat(e.lngLat)
    //     .setHTML(JSON.stringify(displayFeatures, null, 2))
    //     .addTo(map);
    // });

    const marker = new Marker({ draggable: true })
      .setLngLat(SEOUL_CITY_HALL)
      .addTo(map);

    // function onDragEnd() {
    //   const lngLat = marker.getLngLat();
    //   coordinates.style.display = "block";
    //   coordinates.innerHTML = `Longitude: ${lngLat.lng}<br />Latitude: ${lngLat.lat}`;
    // }

    // marker.on("dragend", onDragEnd);

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

    map.on("error", (e) => console.error("[MapLibre error]", e.error));

    map.on("styleimagemissing", (e) => {
      console.warn("[스프라이트에 없는 cl_id]", e.id);
    });
    map.setMissingStyleImageResolver((id) => {
      console.warn("[스프라이트에 없는 cl_id]", id);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <pre
        id="features"
        className="hidden absolute top-0 right-0 bottom-0 w-1/2 overflow-auto bg-black/80 text-white"
      ></pre>
    </>
  );
}
