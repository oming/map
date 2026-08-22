"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Popup, type Map as MaplibreMap } from "maplibre-gl";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveDetailFields } from "@/components/map/data/detail-fields";
import type { SelectedPoi } from "@/hooks/use-poi-selection";
import {
  POI_SUMMARY_SCHEMA,
  toPoiSummaryProperties,
} from "@/lib/vworld/poi-detail-schema";

/**
 * V-World 네이티브 POI 클릭 시 즉시 뜨는 요약 팝업. 몇 개 핵심 필드만 보여주고,
 * "상세보기"를 눌러야 PoiSheet(전체 필드)가 열린다.
 * `components/map/data/detail-popup.tsx`의 PopupContent와 동일한 레이아웃 패턴.
 */
function PopupContent({
  selected,
  onOpenSheet,
  onClose,
}: {
  selected: SelectedPoi;
  onOpenSheet: () => void;
  onClose: () => void;
}) {
  const properties = toPoiSummaryProperties(selected.properties);
  const title = String(properties[POI_SUMMARY_SCHEMA.titleKey] ?? "");
  const fields = resolveDetailFields(properties, POI_SUMMARY_SCHEMA);

  return (
    <div className="flex w-64 flex-col gap-1.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-heading font-medium text-foreground">{title}</p>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label="닫기"
          className="-mt-0.5 -mr-0.5"
        >
          <XIcon />
        </Button>
      </div>
      {fields.length > 0 && (
        <dl className="flex flex-col gap-0.5 text-xs">
          {fields.map((field) => (
            <div key={field.key} className="flex gap-1.5">
              <dt className="shrink-0 text-muted-foreground">{field.label}</dt>
              <dd className="text-foreground">{field.display}</dd>
            </div>
          ))}
        </dl>
      )}
      <Button variant="secondary" size="xs" onClick={onOpenSheet}>
        상세보기
      </Button>
    </div>
  );
}

/**
 * `detail-popup.tsx`의 DetailPopup과 동일한 생명주기 패턴 — Popup의 내장 closeOnClick
 * 대신 usePoiSelection의 outside-click 감지로만 닫히게 해 React 상태와 어긋나지
 * 않게 한다.
 */
export function PoiPopup({
  map,
  selected,
  onOpenSheet,
  onClose,
}: {
  map: MaplibreMap | null;
  selected: SelectedPoi | null;
  onOpenSheet: () => void;
  onClose: () => void;
}) {
  const popupRef = useRef<Popup | null>(null);
  const rootRef = useRef<Root | null>(null);

  useEffect(() => {
    return () => {
      const popup = popupRef.current;
      const root = rootRef.current;
      popupRef.current = null;
      rootRef.current = null;
      popup?.remove();
      // react-control.tsx와 동일한 이유: cleanup이 React 렌더 도중 동기 호출될 수
      // 있어 root.unmount()를 다음 태스크로 미룬다.
      setTimeout(() => root?.unmount(), 0);
    };
  }, []);

  useEffect(() => {
    if (!map || !selected) {
      const popup = popupRef.current;
      popupRef.current = null;
      popup?.remove();
      return;
    }

    if (!popupRef.current) {
      const container = document.createElement("div");
      rootRef.current = createRoot(container);
      popupRef.current = new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        maxWidth: "none",
      }).setDOMContent(container);
    }

    popupRef.current.setLngLat(selected.coordinates).addTo(map);
    rootRef.current?.render(
      <PopupContent
        selected={selected}
        onOpenSheet={onOpenSheet}
        onClose={onClose}
      />,
    );
  }, [map, selected, onOpenSheet, onClose]);

  return null;
}
