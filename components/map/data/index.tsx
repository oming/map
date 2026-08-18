"use client";

import { useEffect, useState } from "react";
import { useMap, useStyleReady } from "@/components/map/map-context";
import { DATA_LAYERS } from "@/lib/map/datasets";
import { useDataLayers } from "@/hooks/use-data-layers";
import {
  readHashParam,
  writeHashParam,
  subscribeHashChange,
} from "@/lib/map/hash-state";
import { LayerToggle } from "./layer-toggle";
import { DetailSheet } from "./detail-sheet";

function readActiveIds(): string[] {
  const raw = readHashParam("layers");
  if (!raw) return [];
  const known = new Set(DATA_LAYERS.map((l) => l.id));
  return raw.split(",").filter((id) => known.has(id));
}

/** VWorldMap의 children으로 마운트한다 — 지도 컨테이너에 포털되어 useMap()이 동작한다. */
export function DataLayers() {
  const map = useMap({ optional: true });
  const styleReady = useStyleReady();
  const [activeIds, setActiveIds] = useState<string[]>(() => readActiveIds());

  // 뒤로/앞으로가기, 북마크 진입으로 해시가 바뀌는 경우만 구독한다.
  // 우리 자신의 writeHashParam(replaceState)은 hashchange를 쏘지 않으므로 루프 없음.
  useEffect(() => subscribeHashChange(() => setActiveIds(readActiveIds())), []);

  const toggleLayer = (id: string) => {
    setActiveIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((activeId) => activeId !== id)
        : [...prev, id];
      writeHashParam("layers", next.join(","));
      return next;
    });
  };

  const { selected, clearSelected } = useDataLayers(
    map,
    styleReady,
    activeIds,
  );

  return (
    <>
      <LayerToggle
        layers={DATA_LAYERS}
        activeIds={activeIds}
        onToggle={toggleLayer}
      />
      <DetailSheet
        selected={selected}
        onOpenChange={(open) => {
          if (!open) clearSelected();
        }}
        container={map?.getContainer()}
      />
    </>
  );
}
