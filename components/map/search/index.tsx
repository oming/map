// components/map/search/index.tsx
"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import { LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useGeoSearch } from "@/hooks/use-geo-search";
import { useSearchMapLayers } from "@/hooks/use-search-map-layers";
import type { Map as MaplibreMap } from "maplibre-gl";

import { SearchInput } from "./search-input";
import { ResultList } from "./result-list";
import { SearchPager } from "./search-pager";
import { SearchError } from "./search-error";

export function Search({ map = null }: { map?: MaplibreMap | null }) {
  const [open, setOpen] = useState(false);
  const [draftQuery, setDraftQuery] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchBbox, setSearchBbox] = useState<string | undefined>(undefined);
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
    totalCount: places.totalCount + addresses.totalCount,
    onBBoxChange: setSearchBbox,
    onToggleOpen: setOpen,
  });

  const hasResults = places.items.length > 0 || addresses.items.length > 0;
  const activeData = activeTab === "place" ? places : addresses;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = draftQuery.trim();
    setSearchQuery(q);
    setSearchBbox(undefined);
    setOpen(true);
    clearSelection();
  };

  const handleClear = () => {
    setDraftQuery("");
    setSearchQuery("");
    setSearchBbox(undefined);
    setOpen(false);
    clearSelection();
  };

  // network error 포함: activeData.error는 API 응답 에러 + SWR 네트워크 에러 모두 포함
  const error: Error | undefined = activeData.error ?? undefined;

  return (
    <>
      <SearchInput
        draftQuery={draftQuery}
        onDraftChange={setDraftQuery}
        onSubmit={handleSubmit}
        onClear={handleClear}
      />

      {searchQuery && (
        <div className="mt-2 overflow-hidden rounded-lg bg-background text-foreground shadow-lg">
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
                    검색 결과: 총 {places.totalCount + addresses.totalCount}건
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setOpen((v) => !v)}
                >
                  {open ? "접기" : "펼치기"}
                </Button>
              </div>

              <Collapsible open={open}>
                <CollapsibleContent>
                  <Tabs
                    value={activeTab}
                    onValueChange={(v) =>
                      setActiveTab(v as "place" | "address")
                    }
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
                          onItemSelect={handleSelect}
                        />
                      </TabsContent>
                      <TabsContent value="address" className="m-0">
                        <ResultList
                          items={addresses.items}
                          emptyLabel="주소 검색 결과가 없습니다."
                          color="orange"
                          selectedItemId={selectedItemId ?? null}
                          onItemSelect={handleSelect}
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
        </div>
      )}

      {map &&
        showSearchThisArea &&
        createPortal(
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
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
