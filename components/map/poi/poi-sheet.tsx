"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { DetailFields } from "@/components/map/data/detail-fields";
import type { SelectedPoi } from "@/hooks/use-poi-selection";
import {
  POI_FULL_DETAIL_SCHEMA,
  POI_FULL_DETAIL_SCHEMA_DEV,
  toPoiFullDisplayProperties,
} from "@/lib/vworld/poi-detail-schema";

// 개발 환경에서는 코드/id/줌레벨까지 전부 노출해 V-World가 실제로 내려주는 필드를
// 원본 그대로(대/중/소/세분류도 각자 행으로) 확인할 수 있게 한다. 프로덕션은 분류를
// 브레드크럼 한 행으로 합치고 내부 코드/id/줌레벨은 숨긴다.
const IS_DEV = process.env.NODE_ENV !== "production";
const SHEET_SCHEMA = IS_DEV ? POI_FULL_DETAIL_SCHEMA_DEV : POI_FULL_DETAIL_SCHEMA;

export function PoiSheet({
  selected,
  onOpenChange,
  container,
}: {
  selected: SelectedPoi | null;
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
                {String(selected.properties[SHEET_SCHEMA.titleKey] ?? "")}
              </SheetTitle>
              <SheetDescription>V-World POI 상세정보</SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto p-4">
              <DetailFields
                properties={
                  IS_DEV
                    ? selected.properties
                    : toPoiFullDisplayProperties(selected.properties)
                }
                schema={SHEET_SCHEMA}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                출처: V-World(국토교통부)
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
