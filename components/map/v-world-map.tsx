"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PbfReader } from "pbf";
import { VectorTile } from "@mapbox/vector-tile";
import { fromVectorTileJs } from "@maplibre/vt-pbf";
import {
  FullscreenControl,
  GeolocateControl,
  Map,
  NavigationControl,
  ScaleControl,
  addProtocol,
  setWorkerUrl,
  ErrorEvent,
} from "maplibre-gl";

import {
  isVWorldVectorTileUrl,
  VWORLD_VECTOR_MIN_ZOOM,
} from "@/lib/vworld/config";
import { BASEMAPS, resolveBasemapId } from "@/lib/map/basemaps";
import { migrateLegacyHash, readHashParam } from "@/lib/map/hash-state";
import { attachClickRouter } from "@/lib/map/click-router";

import { Search } from "./search";
import { BasemapSwitcher } from "./basemap/switcher";
import { ReactControl } from "./react-control";
import { MapContext } from "./map-context";

setWorkerUrl("/maplibre-gl-worker.mjs");

// 한반도 전체가 보이는 기본 진입 뷰(신규 방문 시). 좌표 해시가 있는 URL은 이 값 대신 해시를 사용한다.
const INITIAL_VIEW_CENTER: [number, number] = [127.8, 36.5];
const INITIAL_VIEW_ZOOM = 7;

const REVERSE_PROTOCOL = "reverse";

/**
 * V-World 벡터타일 응답을 가로채 레이어 이름을 전부 "poi"로 바꿔 다시 인코딩한다.
 * V-World는 타일마다 레이어 이름이 제각각인데 스타일(data/poi-layers.json)은 단일
 * source-layer를 기대하기 때문이다.
 */
function registerReverseProtocol(): void {
  addProtocol(REVERSE_PROTOCOL, async (params) => {
    const url = params.url.replace(REVERSE_PROTOCOL + "://", "");

    return fetch(url)
      .then((response) => response.arrayBuffer())
      .then((buffer) => new VectorTile(new PbfReader(buffer)))
      .then((tile) => {
        const renamedTile: VectorTile = {
          layers: Object.entries(tile.layers).reduce(
            (renamed, [layerId, layer]) => ({
              ...renamed,
              [layerId]: {
                ...layer,
                name: "poi",
                // 이 래퍼는 no-op처럼 보이지만 지우면 안 된다 — 위 스프레드는 own
                // enumerable 속성만 복사하므로 프로토타입 메서드인 feature()가
                // 사라지고, fromVectorTileJs가 피처를 못 읽어 타일이 빈 채로 나온다.
                feature: (index: number) => layer.feature(index),
              },
            }),
            {},
          ),
        };
        return renamedTile;
      })
      .then((tile) => fromVectorTileJs(tile).buffer)
      .then((data) => ({ data }));
  });
}

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

    // addProtocol은 MapLibre 전역 레지스트리라 map 인스턴스에 묶이지 않는다. 언마운트 시
    // removeProtocol을 부르지 않는 이유는, 같은 프로토콜을 재등록해도 덮어쓰기라 무해하고
    // 해제 타이밍을 잘못 잡으면 아직 살아 있는 타일 요청이 깨지기 때문이다.
    registerReverseProtocol();

    const initialBasemapId = resolveBasemapId(readHashParam("base"));

    const map = new Map({
      container: containerRef.current,
      style: BASEMAPS[initialBasemapId].styleUrl,
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
        return { url: REVERSE_PROTOCOL + "://" + url };
      }
      return undefined;
    });

    // NavigationControl보다 먼저 등록해 top-right 컨트롤 스택 최상단에 오게 한다.
    map.addControl(
      new ReactControl(BasemapSwitcher, { initialId: initialBasemapId }),
      "top-right",
    );
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
        unit: "metric",
      }),
    );

    map.addControl(new ReactControl(Search, {}), "top-left");

    const detachClickRouter = attachClickRouter(map);

    // setStyle(베이스맵 전환) 시작 시점. 'styledataloading'은 Style.loadURL/loadJSON
    // 진입에서만 발화하고 addLayer/addSource로는 발화하지 않는다. 여기서 false로 내려야
    // useDataLayers가 옛 스타일이 살아 있는 동안 dl-* 레이어를 정리하고, 이어지는
    // 'style.load'에서 새 스타일에 다시 붙인다(lib/map/layer-lifecycle.ts의 try/catch가
    // 전환 도중 예외를 방어하지만, 이 순서 덕분에 teardown이 항상 유효한 스타일 위에서 일어난다).
    map.on("styledataloading", () => setStyleReady(false));
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
