"use client";

import { Toggle } from "@/components/ui/toggle";
import type { DataLayerDef } from "@/lib/map/datasets/types";

export function LayerToggle({
  layers,
  activeIds,
  onToggle,
}: {
  layers: DataLayerDef[];
  activeIds: string[];
  onToggle: (id: string) => void;
}) {
  if (layers.length === 0) return null;

  return (
    // 검색의 "이 위치에서 검색" 알약이 하단 중앙(bottom-center)을 이미 쓰고 있고
    // 서로 다른 React 루트라 서로의 존재를 모른다 — 겹치지 않도록 하단 좌측(MapLibre
    // ScaleControl 위)에 둔다.
    <div className="pointer-events-auto absolute bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-3 flex flex-wrap gap-1.5 rounded-lg border border-border bg-popover/95 p-1.5 shadow-lg supports-backdrop-filter:backdrop-blur-xs">
      {layers.map((layer) => (
        <Toggle
          key={layer.id}
          pressed={activeIds.includes(layer.id)}
          onPressedChange={() => onToggle(layer.id)}
          variant="outline"
          size="sm"
        >
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: layer.color }}
          />
          {layer.label}
        </Toggle>
      ))}
    </div>
  );
}
