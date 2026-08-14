// components/map/search/search-input.tsx
"use client";

import * as React from "react";
import { Search as SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ButtonGroup } from "@/components/ui/button-group";

interface SearchInputProps {
  draftQuery: string;
  onDraftChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
  showClearButton: boolean;
  className?: string;
}

export function SearchInput({
  draftQuery,
  onDraftChange,
  onSubmit,
  onClear,
  showClearButton,
  className,
}: SearchInputProps) {
  return (
    <div className={cn("w-[380px] max-w-[calc(100vw-2rem)]", className)}>
      <ButtonGroup className="w-full">
        <form onSubmit={onSubmit} className="flex-1">
          <InputGroup className="rounded-lg bg-background text-foreground shadow-lg">
            <InputGroupAddon align="inline-start">
              <SearchIcon className="text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="장소나 주소를 입력하세요..."
              value={draftQuery}
              onChange={(e) => onDraftChange(e.target.value)}
            />
            {draftQuery && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="submit"
                  variant="secondary"
                  aria-label="검색"
                >
                  Search
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </form>
        {showClearButton && (
          <ButtonGroup>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onClear}
            >
              <span className="sr-only">검색 닫기</span>
              <XIcon className="size-4" />
            </Button>
          </ButtonGroup>
        )}
      </ButtonGroup>
    </div>
  );
}
