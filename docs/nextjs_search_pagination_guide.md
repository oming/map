# Next.js App Router: URL Search Params 기반 검색 및 페이지네이션 (Search & Pagination)

## 1. 개요 및 설계 원칙

본 개발 프롬프트/가이드는 **Next.js App Router 환경에서 URL Search Params를 상태 관리의 단일 진실 원천(Single Source of Truth)으로 사용**하여 검색 및 페이지네이션 기능을 구현하는 표준 방식을 정의합니다.

### 왜 클라이언트 State 대신 URL Search Params를 사용하는가?
1. **북마크 및 공유 가능 (Bookmarkable & Shareable):** 검색어 및 페이지 상태가 URL에 포함되어 있어 사용자가 링크를 공유하거나 저장하기 용이함.
2. **서버 사이드 렌더링(SSR) 최적화:** 서버 컴포넌트에서 URL 파라미터를 직접 읽어 초기 데이터를 렌더링하므로 클라이언트-서버 간 상태 동기화 이슈 저하.
3. **디바운스(Debounce) 적용 가능:** 입력 스트림을 제어하여 불필요한 서버 데이터 요청 최소화.

---

## 2. 주요 Hooks 및 Props 사양

| 구분 | 구분자/이름 | 역할 및 용도 | 사용되는 위치 |
| :--- | :--- | :--- | :--- |
| **Client Hooks** | `useSearchParams()` | 현재 URL의 쿼리 스트링(Search Params) 읽기 | Client Component (`Search`, `Pagination`) |
| | `usePathname()` | 현재 라우트 경로(Path) 읽기 (`/dashboard/invoices`) | Client Component |
| | `useRouter()` | 프로그래밍 방식의 페이지 이동 및 URL 교체 (`replace`) | Client Component |
| **Server Props** | `searchParams` | Page 컴포넌트의 async props로 전달되는 URL 파라미터 | Server Component (`Page`) |

---

## 3. 핵심 구현 가이드라인

### A. 디바운싱(Debounce) 처리된 검색 컴포넌트 (`Search.tsx`)
- **역할:** 사용자 입력을 감지하여 일정 시간(300ms) 입력 대기 후 URL `query` 파라미터를 업데이트.
- **페이지 초기화:** 검색어 변경 시 `page` 파라미터를 `1`로 리셋.
- **제어/비제어 컴포넌트:** Client State 대신 `defaultValue`로 `searchParams.get('query')` 값을 전달하여 URL과 sync 설정.

```tsx
// app/ui/search.tsx
'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';

export default function Search({ placeholder }: { placeholder: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const handleSearch = useDebouncedCallback((term: string) => {
    const params = new URLSearchParams(searchParams);
    
    // 검색어 변경 시 페이지 번호 1로 리셋
    params.set('page', '1');

    if (term) {
      params.set('query', term);
    } else {
      params.delete('query');
    }

    replace(`${pathname}?${params.toString()}`);
  }, 300);

  return (
    <div className="relative flex flex-1 shrink-0">
      <input
        className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
        placeholder={placeholder}
        onChange={(e) => handleSearch(e.target.value)}
        defaultValue={searchParams.get('query')?.toString()}
      />
    </div>
  );
}
```

---

### B. 메인 페이지 컴포넌트 (`page.tsx`)
- **역할:** Next.js Server Component로서 `searchParams` Prop을 읽고 데이터 쿼리 및 Suspense와 연동.

```tsx
// app/dashboard/invoices/page.tsx
import { Suspense } from 'react';
import Table from '@/app/ui/invoices/table';
import Search from '@/app/ui/search';
import Pagination from '@/app/ui/invoices/pagination';
import { InvoicesTableSkeleton } from '@/app/ui/skeletons';
import { fetchInvoicesPages } from '@/app/lib/data';

export default async function Page(props: {
  searchParams?: Promise<{
    query?: string;
    page?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams?.query || '';
  const currentPage = Number(searchParams?.page) || 1;

  // 총 페이지 수 조회 (서버 데이터베이스 호출)
  const totalPages = await fetchInvoicesPages(query);

  return (
    <div className="w-full">
      <div className="mt-4 flex items-center justify-between gap-2 md:mt-8">
        <Search placeholder="Search invoices..." />
      </div>

      {/* query나 currentPage가 변경될 때마다 Suspense 재실행 */}
      <Suspense key={query + currentPage} fallback={<InvoicesTableSkeleton />}>
        <Table query={query} currentPage={currentPage} />
      </Suspense>

      <div className="mt-5 flex w-full justify-center">
        <Pagination totalPages={totalPages} />
      </div>
    </div>
  );
}
```

---

### C. 페이지네이션 컴포넌트 (`pagination.tsx`)
- **역할:** 클릭한 페이지 번호에 맞게 URL `page` 파라미터를 생성하고 이동 링크 제공.

```tsx
// app/ui/invoices/pagination.tsx
'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function Pagination({ totalPages }: { totalPages: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPage = Number(searchParams.get('page')) || 1;

  const createPageURL = (pageNumber: number | string) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div className="inline-flex">
      {/* Example Pagination Button Link Usage */}
      {/* <Link href={createPageURL(page)} /> */}
    </div>
  );
}
```

---

## 4. 프롬프트 활용 규칙 및 체크리스트 (Checklist for LLM / Developer)

개발 프롬프트 작성 시 다음 규칙을 포함시켜 활용합니다.

- [ ] **State 관리:** 클라이언트 `useState`로 검색어 및 페이지 번호를 관리하지 말고, 모든 상태는 **URL Search Params** 기반으로 연동할 것.
- [ ] **디바운스:** 검색 입력(`onChange`)에는 반드시 `use-debounce` (또는 커스텀 디바운스 함수)를 적용하여 최소 `300ms` 지연을 둘 것.
- [ ] **검색 시 페이지 리셋:** 새로운 검색어가 입력되면 `page=1`로 리셋할 것.
- [ ] **서버-클라이언트 역할 분리:**
  - `searchParams`를 읽어 DB를 조회하는 컴포넌트는 **Server Component**로 구성.
  - 사용자 입력을 받아서 URL을 변경하는 컴포넌트(`Search`, `Pagination`)는 `'use client'` 지시어 및 `next/navigation` Hooks 사용.
- [ ] **Suspense Key 연동:** Server Component의 `<Suspense>`는 `key={query + currentPage}`를 부여하여 파라미터 변경 시 Skeleton fallback이 정상 작동하도록 구성할 것.
