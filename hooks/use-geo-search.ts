// hooks/use-geo-search.ts
"use client";

import useSWR from "swr";
import type { GeoSearchResponse } from "@/app/api/geo-search/route";

const fetcher = (url: string): Promise<GeoSearchResponse> =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("검색 요청에 실패했습니다.");
    return res.json();
  });

export function useGeoSearch(params: {
  query: string;
  type: "place" | "address";
  page: number;
  bbox?: string;
  size?: number;
}) {
  const { query, type, page, bbox, size = 10 } = params;

  const key = query
    ? `/api/geo-search?${new URLSearchParams({
        query,
        type,
        page: String(page),
        size: String(size),
        ...(bbox ? { bbox } : {}),
      })}`
    : null;

  const { data, error, isLoading } = useSWR<GeoSearchResponse>(key, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  // key가 null(검색어 없음)이면 keepPreviousData로 남아있는 이전 데이터를 무시하고
  // 명시적으로 빈 결과를 반환한다. 그렇지 않으면 검색어를 지워도 마지막 결과가 남는다.
  if (!key) {
    return {
      items: [],
      totalCount: 0,
      totalPages: 0,
      isLoading: false,
      error: undefined,
    };
  }

  return {
    items: data?.items ?? [],
    totalCount: data?.totalCount ?? 0,
    totalPages: data?.totalPages ?? 0,
    isLoading,
    error,
  };
}
