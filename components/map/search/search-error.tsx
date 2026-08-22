"use client";

import { Spinner } from "@/components/ui/spinner";

interface SearchErrorProps {
  /** 활성 탭이 로딩 중인가? (전체 로딩 아님) */
  activeTabLoading: boolean;
  hasResults: boolean;
  error?: Error | undefined;
}

export function SearchError({
  activeTabLoading,
  hasResults,
  error,
}: SearchErrorProps) {
  if (activeTabLoading && !hasResults) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Spinner /> 검색 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-10 text-center text-sm text-red-500">
        {error.message}
      </div>
    );
  }

  if (hasResults) return null;

  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      검색 결과가 없습니다.
    </div>
  );
}
