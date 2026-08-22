"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SearchPagerProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function SearchPager({
  page,
  totalPages,
  onPageChange,
  isLoading,
}: SearchPagerProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 border-t py-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        disabled={page <= 1 || isLoading}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="text-xs text-muted-foreground">
        {page} / {totalPages}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        disabled={page >= totalPages || isLoading}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
