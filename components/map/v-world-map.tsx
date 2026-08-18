"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  isVWorldVectorTileUrl,
  VWORLD_API_KEY,
  VWORLD_VECTOR_MIN_ZOOM,
} from "@/lib/vworld/config";
import { migrateLegacyHash } from "@/lib/map/hash-state";
import { attachClickRouter, registerClickRoutes } from "@/lib/map/click-router";
import poiLayersRaw from "@/data/poi-layers.json";

const POI_DEBUG_LAYER_IDS = (poiLayersRaw as { id: string }[]).map(
  (l) => l.id,
);

// 한반도 전체가 보이는 기본 진입 뷰(신규 방문 시). 좌표 해시가 있는 URL은 이 값 대신 해시를 사용한다.
const INITIAL_VIEW_CENTER: [number, number] = [127.8, 36.5];
const INITIAL_VIEW_ZOOM = 7;

import { PbfReader } from "pbf";
import { VectorTile } from "@mapbox/vector-tile";
import {
  FullscreenControl,
  GeolocateControl,
  Map,
  NavigationControl,
  Popup,
  ScaleControl,
  addProtocol,
  setWorkerUrl,
  ErrorEvent,
} from "maplibre-gl";
import { Search } from "./search";
import { ReactControl } from "./react-control";
import { MapContext } from "./map-context";
import { fromVectorTileJs } from "@maplibre/vt-pbf";

setWorkerUrl("/maplibre-gl-worker.mjs");

const protocol = "reverse";

export default function VWorldMap({
  children,
}: {
  children?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const [styleReady, setStyleReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapInstance) return;

    // new Map() 이전에 실행 — 구버전 '#zoom/lat/lng' 링크를 '#map=zoom/lat/lng'로 옮긴다.
    migrateLegacyHash();

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
      hash: "map",
      center: INITIAL_VIEW_CENTER,
      zoom: INITIAL_VIEW_ZOOM,
      minZoom: VWORLD_VECTOR_MIN_ZOOM,
      // https://api.vworld.kr/req/wmts/1.0.0/{API_KEY}/WMTSCapabilities.xml 한반도 여백 좌표 범위 참여
      maxBounds: [
        [112.5, 27.059125784374068],
        [140.625, 45.089035564831036],
      ],
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

    const searchControl = new ReactControl(<Search />);
    map.addControl(searchControl, "top-left");

    const detachClickRouter = attachClickRouter(map);

    // 기존 전역 디버그 팝업 — 단일 클릭 라우터의 최하위 우선순위 분기로 이관.
    // 개발 환경에서만 등록되고, 앞으로 추가되는 데이터 레이어/검색 라우트가 항상 우선한다.
    let unregisterDebugRoute: (() => void) | undefined;
    if (process.env.NODE_ENV !== "production") {
      unregisterDebugRoute = registerClickRoutes(
        POI_DEBUG_LAYER_IDS,
        1000,
        (feature, e) => {
          new Popup()
            .setLngLat(e.lngLat)
            .setHTML(`<pre>${JSON.stringify(feature.properties, null, 2)}</pre>`)
            .setMaxWidth("500px")
            .addTo(map);
        },
      );
    }

    map.on("style.load", () => setStyleReady(true));
    map.on("remove", () => setStyleReady(false));

    map.on("error", (e: ErrorEvent) =>
      console.error("[MapLibre error]", e.error),
    );

    map.setMissingStyleImageResolver((id) => {
      console.warn("[스프라이트에 없는 cl_id]", id);
    });

    setMapInstance(map);
    return () => {
      detachClickRouter();
      unregisterDebugRoute?.();
      map.remove();
      setMapInstance(null);
    };
  }, []);

  return (
    <MapContext.Provider value={{ map: mapInstance, styleReady }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {mapInstance &&
        createPortal(
          <div className="pointer-events-none absolute inset-0 z-[3]">
            {children}
          </div>,
          mapInstance.getContainer(),
        )}
    </MapContext.Provider>
  );
}
