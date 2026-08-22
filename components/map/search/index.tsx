// components/map/search/index.tsx
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

/** ReactControl이 MapLibre 컨트롤로 마운트한다 — map은 onAdd 시점에 주입되므로 항상 존재한다. */
export function Search({ map }: { map: MaplibreMap }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [draftQuery, setDraftQuery] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchBbox, setSearchBbox] = useState<string | undefined>(undefined);
  // true면 searchBbox가 "현재 위치 기준 자동 필터"임을 뜻한다(명시적 "이 위치에서
  // 검색"과 구분) — 이 경우에만 0건일 때 자동으로 전국 검색으로 폴백한다.
  const [biasApplied, setBiasApplied] = useState(false);
  const [isNationwideFallback, setIsNationwideFallback] = useState(false);
  const [activeTab, setActiveTab] = useState<"place" | "address">("place");

  const [placePage, setPlacePage] = useState(1);
  const [addressPage, setAddressPage] = useState(1);

  // 검색어가 바뀌면(새 검색 제출/초기화) 페이지네이션을 리셋한다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlacePage(1);
    setAddressPage(1);
  }, [searchQuery]);

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

  // 현재 위치 기준 자동 필터(biasApplied)로 검색했는데 결과가 0건이면,
  // bbox 없이 전국 재검색으로 자동 폴백한다. "이 위치에서 검색"(명시적 스코프)
  // 경로는 biasApplied가 false이므로 대상에서 제외된다.
  useEffect(() => {
    if (!searchQuery || !biasApplied) return;
    if (places.isLoading || addresses.isLoading) return;
    if (places.error || addresses.error) return;
    if (totalCount > 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchBbox(undefined);
    setBiasApplied(false);
    setIsNationwideFallback(true);
  }, [
    searchQuery,
    biasApplied,
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
    onBBoxChange: (bbox) => {
      setSearchBbox(bbox);
      setBiasApplied(false);
    },
  });

  const handleItemSelect = (
    item: Parameters<typeof handleSelect>[0],
    label: string,
  ) => {
    handleSelect(item, label);
    if (isMobile) setMobileOpen(false);
  };

  const hasResults = places.items.length > 0 || addresses.items.length > 0;
  const activeData = activeTab === "place" ? places : addresses;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = draftQuery.trim();
    setSearchQuery(q);
    setSearchBbox(viewportBBoxWithMinRadius(map.getBounds()));
    setBiasApplied(true);
    setIsNationwideFallback(false);
    setOpen(true);
    clearSelection();
  };

  const handleClear = () => {
    setDraftQuery("");
    setSearchQuery("");
    setSearchBbox(undefined);
    setBiasApplied(false);
    setIsNationwideFallback(false);
    setOpen(false);
    clearSelection();
  };

  // network error 포함: activeData.error는 API 응답 에러 + SWR 네트워크 에러 모두 포함
  const error: Error | undefined = activeData.error ?? undefined;

  const resultsBody = searchQuery && (
    <>
      <SearchError
        activeTabLoading={activeData.isLoading}
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

          {isNationwideFallback && (
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
