"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { DetailFields } from "./detail-fields";
import type { SelectedFeature } from "@/hooks/use-data-layers";

export function DetailSheet({
  selected,
  onOpenChange,
  container,
}: {
  selected: SelectedFeature | null;
  onOpenChange: (open: boolean) => void;
  container?: HTMLElement | null;
}) {
  return (
    <Sheet open={!!selected} onOpenChange={onOpenChange}>
      {/* 전체화면 중에도 보이려면 document.body가 아닌 map 컨테이너로 포털해야 한다. */}
      <SheetContent container={container}>
        {selected && (
          <>
            <SheetHeader className="sr-only">
              <SheetTitle>
                {String(
                  selected.properties[selected.layer.detail.titleKey] ?? "",
                )}
              </SheetTitle>
              <SheetDescription>{selected.layer.label}</SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto p-4">
              <DetailFields
                properties={selected.properties}
                schema={selected.layer.detail}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                출처: {selected.layer.attribution.name}
                {selected.layer.attribution.updatedAt &&
                  ` · ${selected.layer.attribution.updatedAt} 기준`}
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
