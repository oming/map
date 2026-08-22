"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import { LocateFixed, Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGeoSearch } from "@/hooks/use-geo-search";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSearchMapLayers } from "@/hooks/use-search-map-layers";
import { viewportBBoxWithMinRadius } from "@/lib/geo-utils";
import { cn } from "@/lib/utils";
import type { Map as MaplibreMap } from "maplibre-gl";

import { SearchInput } from "./search-input";
import { ResultList } from "./result-list";
import { SearchPager } from "./search-pager";
import { SearchError } from "./search-error";

/**
 * 검색 범위. 어떤 bbox를 API에 넘길지와 "0건이면 전국으로 되돌릴지"가 함께 결정되므로
 * 두 값을 따로 두지 않고 하나의 상태로 관리한다.
 */
type SearchScope =
  /** 범위 제한 없음 — 검색 전 초기 상태이거나, 자동 필터로 0건이라 되돌린 뒤. */
  | { kind: "nationwide" }
  /** 제출 시점의 지도 뷰를 자동으로 적용한 필터. 0건이면 전국으로 되돌린다. */
  | { kind: "viewport-bias"; bbox: string }
  /** 사용자가 "이 위치에서 검색"으로 직접 지정한 범위. 0건이어도 되돌리지 않는다. */
  | { kind: "explicit-area"; bbox: string };

const NATIONWIDE_SCOPE: SearchScope = { kind: "nationwide" };

/** ReactControl이 MapLibre 컨트롤로 마운트한다 — map은 onAdd 시점에 주입되므로 항상 존재한다. */
export function Search({ map }: { map: MaplibreMap }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [draftQuery, setDraftQuery] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>(NATIONWIDE_SCOPE);
  const [showNationwideNotice, setShowNationwideNotice] = useState(false);
  const [activeTab, setActiveTab] = useState<"place" | "address">("place");

  const [placePage, setPlacePage] = useState(1);
  const [addressPage, setAddressPage] = useState(1);

  const searchBbox = scope.kind === "nationwide" ? undefined : scope.bbox;

  const places = useGeoSearch({
    query: searchQuery,
    type: "place",
    page: placePage,
    bbox: searchBbox,
  });
  const addresses = useGeoSearch({
    query: searchQuery,
    type: "address",
    page: addressPage,
    bbox: searchBbox,
  });

  const totalCount = places.totalCount + addresses.totalCount;

  // 제출 시 자동으로 적용한 뷰 기준 필터로 0건이면 전국 재검색으로 되돌린다.
  // 응답이 도착해야 판정할 수 있어 effect로 둔다.
  useEffect(() => {
    if (!searchQuery || scope.kind !== "viewport-bias") return;
    if (places.isLoading || addresses.isLoading) return;
    if (places.error || addresses.error) return;
    if (totalCount > 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScope(NATIONWIDE_SCOPE);
    setShowNationwideNotice(true);
  }, [
    searchQuery,
    scope.kind,
    places.isLoading,
    addresses.isLoading,
    places.error,
    addresses.error,
    totalCount,
  ]);

  const {
    selectedItemId,
    handleSelect,
    clearSelection,
    handleSearchThisArea,
    showSearchThisArea,
  } = useSearchMapLayers({
    map,
    activeTab,
    placesItems: places.items,
    addressesItems: addresses.items,
    searchQuery,
    onBBoxChange: (bbox) =>
      setScope(bbox ? { kind: "explicit-area", bbox } : NATIONWIDE_SCOPE),
  });

  const handleItemSelect = (
    item: Parameters<typeof handleSelect>[0],
    label: string,
  ) => {
    handleSelect(item, label);
    if (isMobile) setMobileOpen(false);
  };

  const hasResults = places.items.length > 0 || addresses.items.length > 0;
  const activeTabResult = activeTab === "place" ? places : addresses;

  // 새 검색어로 넘어가면 두 탭 모두 첫 페이지부터 다시 본다. searchQuery가 바뀌는
  // 곳이 아래 두 핸들러뿐이라 effect 없이 여기서 함께 리셋한다.
  const resetPagination = () => {
    setPlacePage(1);
    setAddressPage(1);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSearchQuery(draftQuery.trim());
    setScope({
      kind: "viewport-bias",
      bbox: viewportBBoxWithMinRadius(map.getBounds()),
    });
    setShowNationwideNotice(false);
    resetPagination();
    setOpen(true);
    clearSelection();
  };

  const handleClear = () => {
    setDraftQuery("");
    setSearchQuery("");
    setScope(NATIONWIDE_SCOPE);
    setShowNationwideNotice(false);
    resetPagination();
    setOpen(false);
    clearSelection();
  };

  // network error 포함: activeTabResult.error는 API 응답 에러 + SWR 네트워크 에러 모두 포함
  const error: Error | undefined = activeTabResult.error ?? undefined;

  const resultsBody = searchQuery && (
    <>
      <SearchError
        activeTabLoading={activeTabResult.isLoading}
        hasResults={hasResults}
        error={error}
      />

      {hasResults && (
        <>
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <div className="min-w-0 truncate text-sm">
              <span className="font-medium">{searchQuery}</span>
              <span className="text-muted-foreground">
                {" "}
                검색 결과: 총 {totalCount}건
              </span>
            </div>
            {!isMobile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => setOpen((v) => !v)}
              >
                {open ? "접기" : "펼치기"}
              </Button>
            )}
          </div>

          {showNationwideNotice && (
            <div className="border-b px-3 py-1.5 text-xs text-muted-foreground">
              현재 위치 근처에 결과가 없어 전국 검색 결과를 표시합니다.
            </div>
          )}

          <Collapsible open={isMobile ? true : open}>
            <CollapsibleContent>
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as "place" | "address")}
                className="flex max-h-[60vh] flex-col p-2"
              >
                <TabsList variant="default" className="w-full">
                  <TabsTrigger value="place" className="flex-1">
                    장소 ({places.totalCount}건)
                  </TabsTrigger>
                  <TabsTrigger value="address" className="flex-1">
                    주소 ({addresses.totalCount}건)
                  </TabsTrigger>
                </TabsList>

                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  <TabsContent value="place" className="m-0">
                    <ResultList
                      items={places.items}
                      emptyLabel="장소 검색 결과가 없습니다."
                      color="blue"
                      selectedItemId={selectedItemId ?? null}
                      onItemSelect={handleItemSelect}
                    />
                  </TabsContent>
                  <TabsContent value="address" className="m-0">
                    <ResultList
                      items={addresses.items}
                      emptyLabel="주소 검색 결과가 없습니다."
                      color="orange"
                      selectedItemId={selectedItemId ?? null}
                      onItemSelect={handleItemSelect}
                    />
                  </TabsContent>
                </div>

                {activeTab === "place" && (
                  <SearchPager
                    page={placePage}
                    totalPages={places.totalPages}
                    onPageChange={setPlacePage}
                    isLoading={places.isLoading}
                  />
                )}
                {activeTab === "address" && (
                  <SearchPager
                    page={addressPage}
                    totalPages={addresses.totalPages}
                    onPageChange={setAddressPage}
                    isLoading={addresses.isLoading}
                  />
                )}
              </Tabs>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </>
  );

  return (
    <>
      {isMobile ? (
        <Drawer
          open={mobileOpen}
          onOpenChange={setMobileOpen}
          swipeDirection="up"
          showSwipeHandle
        >
          <DrawerTrigger
            render={
              <Button
                type="button"
                size={searchQuery ? "default" : "icon"}
                variant="ghost"
                className={cn(
                  searchQuery && "max-w-[70vw]",
                  "rounded-lg bg-background text-foreground shadow-lg",
                )}
                aria-label="검색"
              />
            }
          >
            <SearchIcon className="size-4 shrink-0 stroke-3" />
            {searchQuery && <span className="truncate">{searchQuery}</span>}
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>검색</DrawerTitle>
              <DrawerDescription>검색을 할 수 있습니다.</DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <SearchInput
                className="w-full"
                draftQuery={draftQuery}
                autoFocus
                onDraftChange={setDraftQuery}
                onSubmit={handleSubmit}
                onClear={handleClear}
                showClearButton={!!searchQuery}
              />
              {searchQuery && (
                <div className="mt-2 overflow-hidden rounded-lg bg-background text-foreground">
                  {resultsBody}
                </div>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <>
          <SearchInput
            draftQuery={draftQuery}
            onDraftChange={setDraftQuery}
            onSubmit={handleSubmit}
            onClear={handleClear}
            showClearButton={!!searchQuery}
          />

          {searchQuery && (
            <div className="mt-2 overflow-hidden rounded-lg bg-background text-foreground">
              {resultsBody}
            </div>
          )}
        </>
      )}

      {showSearchThisArea &&
        createPortal(
          <div className="pointer-events-none absolute inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-10 flex justify-center">
            <Button
              type="button"
              size="lg"
              className="pointer-events-auto gap-1.5 rounded-full shadow-lg"
              onClick={handleSearchThisArea}
            >
              <LocateFixed className="size-4" />이 위치에서 검색
            </Button>
          </div>,
          map.getContainer(),
        )}
    </>
  );
}
