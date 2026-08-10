// hooks/use-geo-search.ts
"use client";

import * as React from "react";
import useSWR from "swr";
import type {
  GeoSearchResponse,
  GeoSearchResponseError,
} from "@/app/api/geo-search/route";

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

  // 300ms debounce: 입력 중 연속 API 호출 방지
  const [debouncedQuery, setDebouncedQuery] = React.useState(query);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query) {
      setDebouncedQuery("");
      return;
    }
    timerRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const key = debouncedQuery
    ? `/api/geo-search?${new URLSearchParams({
        query: debouncedQuery,
        type,
        page: String(page),
        size: String(size),
        ...(bbox ? { bbox } : {}),
      })}`
    : null;

  const { data, error: swrError, isLoading } = useSWR<GeoSearchResponse>(
    key,
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  );

  // key가 null(검색어 없음)이면 keepPreviousData로 남아있는 이전 데이터를 무시하고
  // 명시적으로 빈 결과를 반환한다. 그렇지 않으면 검색어를 지워도 마지막 결과가 남는다.
  if (!key) {
    return {
      items: [],
      totalCount: 0,
      totalPages: 0,
      isLoading: false,
      error: undefined,
      hasError: false,
      responseError: undefined,
    };
  }

  const responseError: GeoSearchResponseError | undefined = data?.error;
  const error: Error | undefined = responseError
    ? new Error(responseError.text)
    : swrError;

  return {
    items: data?.items ?? [],
    totalCount: data?.totalCount ?? 0,
    totalPages: data?.totalPages ?? 0,
    isLoading,
    error,
    hasError: !!responseError,
    responseError,
  };
}
