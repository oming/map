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
      <PopoverContent align="end" className="w-auto p-2">
        <div className="grid grid-cols-3 gap-2">
          {BASEMAP_IDS.map((id) => {
            const def = BASEMAPS[id];
            const active = id === current;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelect(id)}
                title={def.description}
                aria-label={`${def.label} — ${def.description}`}
                aria-pressed={active}
                className="group flex w-18 flex-col gap-1 text-center"
              >
                <span
                  className={cn(
                    "relative block overflow-hidden rounded-md ring-1 ring-border transition group-hover:ring-foreground/30",
                    active && "ring-2 ring-primary group-hover:ring-primary",
                  )}
                >
                  {/* 캡처 이미지는 144x144 정사각 — aspect-square로 비율을 고정한다.
                      이미 표시 크기에 맞춰 만든 16KB 고정 자산이라 next/image의
                      최적화가 얻는 게 없고 Vercel 이미지 사용량만 발생한다. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={def.thumbnail}
                    alt=""
                    width={144}
                    height={144}
                    className="aspect-square w-full object-cover"
                  />
                  {active && (
                    <span className="absolute inset-0 flex items-center justify-center bg-primary/25">
                      <Check className="size-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "block truncate text-xs",
                    active
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {def.label}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
