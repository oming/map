// components/map/search/result-list.tsx
"use client";

import type { GeoSearchItem } from "@/app/api/geo-search/route";
import { indexToLabel } from "@/lib/geo-utils";
import { cn } from "@/lib/utils";

interface ResultListProps {
  items: GeoSearchItem[];
  emptyLabel: string;
  color: "blue" | "orange";
  selectedItemId: string | null;
  onItemSelect: (item: GeoSearchItem, label: string) => void;
}

export function ResultList({
  items,
  emptyLabel,
  color,
  selectedItemId,
  onItemSelect,
}: ResultListProps) {
  if (items.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }
  return (
    <ul className="space-y-0.5">
      {items.map((item, idx) => {
        const label = indexToLabel(idx);
        const isSelected = item.id === selectedItemId;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onItemSelect(item, label)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                isSelected ? "bg-accent ring-1 ring-primary/40" : "hover:bg-accent",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white",
                  color === "blue" ? "bg-blue-500" : "bg-orange-500",
                )}
              >
                {label}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">
                  {item.title}
                </span>
                {item.subtitle && (
                  <span className="truncate text-xs text-muted-foreground">
                    {item.subtitle}
                  </span>
                )}
                {(item.category || item.zipcode) && (
                  <span className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
                    {item.category}
                    {item.category && item.zipcode && " · "}
                    {item.zipcode && `우편 ${item.zipcode}`}
                  </span>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
