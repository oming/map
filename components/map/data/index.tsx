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
import { DetailPopup } from "./detail-popup";

function readActiveIds(): string[] {
  const raw = readHashParam("layers");
  if (!raw) return [];
  const knownIds = new Set(DATA_LAYERS.map((layer) => layer.id));
  return raw.split(",").filter((id) => knownIds.has(id));
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
  // 마커 클릭 시 항상 팝업부터 보여준다 — "상세보기"를 눌러야 true가 된다.
  // 새 피처를 선택할 때마다 이전 피처의 Sheet가 열려있던 상태는 신경 쓰지 않고 리셋한다.
  // (effect가 아니라 렌더 중에 조정 — https://react.dev/learn/you-might-not-need-an-effect)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [prevSelected, setPrevSelected] = useState(selected);
  if (selected !== prevSelected) {
    setPrevSelected(selected);
    setSheetOpen(false);
  }

  return (
    <>
      <LayerToggle
        layers={DATA_LAYERS}
        activeIds={activeIds}
        onToggle={toggleLayer}
      />
      <DetailPopup
        map={map}
        selected={sheetOpen ? null : selected}
        onOpenSheet={() => setSheetOpen(true)}
        onClose={clearSelected}
      />
      <DetailSheet
        selected={sheetOpen ? selected : null}
        onOpenChange={(open) => {
          if (!open) clearSelected();
        }}
        container={map?.getContainer()}
      />
    </>
  );
}
