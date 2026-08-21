"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Popup, type Map as MaplibreMap } from "maplibre-gl";
import { ExternalLink, XIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SelectedFeature } from "@/hooks/use-data-layers";
import { resolveDetailFields } from "./detail-fields";

const POPUP_FIELD_LIMIT = 3;

function PopupContent({
  selected,
  onOpenSheet,
  onClose,
}: {
  selected: SelectedFeature;
  onOpenSheet: () => void;
  onClose: () => void;
}) {
  const { layer, properties } = selected;
  const title = String(properties[layer.detail.titleKey] ?? "");
  const fields = layer.detail.popupFields
    ? resolveDetailFields(properties, layer.detail, {
        onlyKeys: layer.detail.popupFields,
      })
    : resolveDetailFields(properties, layer.detail).slice(0, POPUP_FIELD_LIMIT);

  return (
    <div className="flex w-56 flex-col gap-1.5 text-sm">
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
      {layer.detail.links && layer.detail.links.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {layer.detail.links.map((link) => (
            <a
              key={link.label}
              href={link.href(properties)}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "xs" }),
              )}
            >
              {link.label}
              <ExternalLink />
            </a>
          ))}
        </div>
      )}
      <Button variant="secondary" size="xs" onClick={onOpenSheet}>
        상세보기
      </Button>
    </div>
  );
}

/**
 * 마커 클릭 시 즉시 뜨는 가벼운 팝업. selected가 있고 anchor 좌표가 있을 때만
 * 보이며, "상세보기"를 눌러야 DetailSheet(전체 필드)가 열린다. Popup의 내장
 * closeOnClick/closeButton은 끄고 React 상태(selected)로만 표시 여부를 제어한다 —
 * 새 마커 클릭 시 이전 팝업이 내장 close 이벤트로 먼저 상태를 지워버리는 경합을
 * 피하기 위해서다.
 */
export function DetailPopup({
  map,
  selected,
  onOpenSheet,
  onClose,
}: {
  map: MaplibreMap | null;
  selected: SelectedFeature | null;
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
    if (!map || !selected?.coordinates) {
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
