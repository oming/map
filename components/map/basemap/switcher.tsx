"use client";

import { useEffect, useState } from "react";
import { Check, Layers } from "lucide-react";
import type { Map as MaplibreMap } from "maplibre-gl";

import {
  BASEMAP_IDS,
  BASEMAPS,
  DEFAULT_BASEMAP_ID,
  resolveBasemapId,
  type BasemapId,
} from "@/lib/map/basemaps";
import {
  readHashParam,
  subscribeHashChange,
  writeHashParam,
} from "@/lib/map/hash-state";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * ReactControl(top-right)로 마운트된다 — VWorldMap의 React 트리 밖이라 MapContext를
 * 못 쓴다(components/map/react-control.tsx). map은 onAdd에서 prop으로 주입받는다.
 */
export function BasemapSwitcher({
  map,
  initialId,
}: {
  map: MaplibreMap;
  initialId: BasemapId;
}) {
  const [current, setCurrent] = useState<BasemapId>(initialId);
  const [open, setOpen] = useState(false);

  // 뒤로/앞으로가기, 북마크 진입으로 해시가 바뀌는 경우만 구독한다.
  // writeHashParam(replaceState)은 hashchange를 쏘지 않으므로 루프 없음.
  useEffect(
    () =>
      subscribeHashChange(() => {
        const id = resolveBasemapId(readHashParam("base"));
        setCurrent(id);
        map.setStyle(BASEMAPS[id].styleUrl, { diff: false });
      }),
    [map],
  );

  const handleSelect = (id: BasemapId) => {
    setOpen(false);
    if (id === current) return;

    setCurrent(id);
    writeHashParam("base", id === DEFAULT_BASEMAP_ID ? null : id);
    map.setStyle(BASEMAPS[id].styleUrl, { diff: false });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="rounded-lg bg-background text-foreground shadow-lg"
            aria-label="배경지도 선택"
          />
        }
      >
        <Layers className="size-4 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        {BASEMAP_IDS.map((id) => {
          const def = BASEMAPS[id];
          const active = id === current;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSelect(id)}
              aria-label={def.label}
              aria-pressed={active}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                active && "bg-muted",
              )}
            >
              <span className="flex-1 min-w-0">
                <span className="block font-medium">{def.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {def.description}
                </span>
              </span>
              {active && <Check className="size-4 shrink-0" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
