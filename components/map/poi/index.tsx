"use client";

import { useState } from "react";
import { useMap } from "@/components/map/map-context";
import { usePoiSelection } from "@/hooks/use-poi-selection";
import { PoiPopup } from "./poi-popup";
import { PoiSheet } from "./poi-sheet";

/** VWorldMap의 children으로 마운트한다 — 지도 컨테이너에 포털되어 useMap()이 동작한다.
 *  V-World 네이티브 POI 클릭 정보(요약 팝업 + 상세보기 시트). `components/map/data/index.tsx`의
 *  DataLayers와 동일한 팝업/시트 전환 패턴을 쓴다. */
export function PoiInfo() {
  const map = useMap({ optional: true });
  const { selected, clearSelected } = usePoiSelection(map);

  // 마커 클릭 시 항상 팝업부터 보여준다 — "상세보기"를 눌러야 true가 된다.
  // 새 피처를 선택할 때마다 이전 피처의 Sheet가 열려있던 상태는 신경 쓰지 않고 리셋한다.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [prevSelected, setPrevSelected] = useState(selected);
  if (selected !== prevSelected) {
    setPrevSelected(selected);
    setSheetOpen(false);
  }

  return (
    <>
      <PoiPopup
        map={map}
        selected={sheetOpen ? null : selected}
        onOpenSheet={() => setSheetOpen(true)}
        onClose={clearSelected}
      />
      <PoiSheet
        selected={sheetOpen ? selected : null}
        onOpenChange={(open) => {
          if (!open) clearSelected();
        }}
        container={map?.getContainer()}
      />
    </>
  );
}
