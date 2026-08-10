// components/map/search/search-input.tsx
"use client";

import * as React from "react";
import { Search as SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ButtonGroup } from "@/components/ui/button-group";

interface SearchInputProps {
  draftQuery: string;
  onDraftChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
}

export function SearchInput({
  draftQuery,
  onDraftChange,
  onSubmit,
  onClear,
}: SearchInputProps) {
  return (
    <div className="w-[380px] max-w-[calc(100vw-2rem)]">
      <ButtonGroup>
        <form onSubmit={onSubmit} className="flex-1">
          <InputGroup className="rounded-lg bg-background text-foreground shadow-lg">
            <InputGroupInput
              placeholder="장소나 주소를 입력하세요..."
              value={draftQuery}
              onChange={(e) => onDraftChange(e.target.value)}
            />
            <InputGroupAddon>
              <SearchIcon className="size-4 text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>
        </form>
        {draftQuery && (
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
