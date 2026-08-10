# 검색 기능 코드 리뷰 — 수정 전 분석

> 커밋 `50b4c19` 기준. 수정 작업 시 참고용.

---

## 1. API 에러 상태가 UI에 표시되지 않음

### 위치

- `hooks/use-geo-search.ts:54` — SWR이 `error`를 반환하지만
- `components/map/search.tsx:310-311` — `places.error`, `addresses.error`를 전혀 참조하지 않음

### 문제

API 호출이 실패하면(네트워크 장애, 인증키 만료, 서버 오류 등) 사용자에게 "검색 결과가 없습니다"만 보인다. "결과 없음"과 "에러 발생"을 구분할 수 없어 UX가 나쁘고, 디버깅도 어렵다.

### 관련 코드

```ts
// use-geo-search.ts — error 반환은 하지만
return {
  items: data?.items ?? [],
  totalCount: data?.totalCount ?? 0,
  totalPages: data?.totalPages ?? 0,
  isLoading,
  error,  // ← 여기는 반환함
};

// search.tsx — 하지만 사용하지 않음
const hasResults = places.items.length > 0 || addresses.items.length > 0;
const isSearching = places.isLoading || addresses.isLoading;
// places.error, addresses.error → 어디에도 참조 안 함
```

### 수정 방향

- `useGeoSearch`의 반환값에 `hasError: boolean` 추가
- `search.tsx`에서 에러 발생 시 "검색 중 오류가 발생했습니다. 다시 시도해주세요." 메시지 표시
- API 라우트에서 에러 상세 정보(`error.code`, `error.text`)를 함께 반환하면 더 나은 에러 메시지 가능

### 상태: ✅ 완료 (커밋 `7dfd6cf`)

---

## 2. `v-world-map.tsx`에서 `setTransformRequest` 중복 호출

### 상태: ✅ 완료 (커밋 `03d395b`)

---

## 3. `ReactControl.onRemove`에서 unmount가 두 번 실행됨

### 상태: ✅ 완료 (커밋 `29391dc`)

---

## 4. API 라우트에서 `VWORLD_API_KEY` 없으면 서버 크래시

### 위치

- `app/api/geo-search/route.ts:4`

### 문제

`process.env.VWORLD_API_KEY!`에서 옵셔널 체이닝(`!`)을 사용해, `.env.local`에 키가 설정되지 않았을 때 서버 시작 시 `TypeError`로 크래시합니다.

### 관련 코드

```ts
const VWORLD_KEY = process.env.VWORLD_API_KEY!;  // ← !로 필수 선언
```

### 상태: ✅ 완료 (현재 수정 중 — `!` 제거 + 키 누락 시 warn + 빈 결과 반환)

---

## 5. `visibleBBox` 함수가 dead code

### 상태: ✅ 완료 (커밋 `c1a6404`에서 이미 제거됨)

### 관련 코드

```ts
// lib/geo-utils.ts — 정의만 있고 사용 안 함
export function visibleBBox(map: MaplibreMap, leftPaddingPx = 0): string {
  const canvas = map.getCanvas();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const sw = map.unproject([leftPaddingPx, height]);
  const ne = map.unproject([width, 0]);
  return `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
}
```

### 수정 방향

- 미사용 함수이므로 제거
- 또는 "이 위치에서 검색" 기능에 좌판 영역 패딩(검색 패널에 가려진 영역 제외)을 적용할 때 사용 예정이라면 주석 유지

---

## 6. 검색 입력에 debounce 부재

### 상태: ✅ 완료 (현재 수정 중 — `useGeoSearch` 내부 300ms debounce 적용)

### 구현

- `hooks/use-geo-search.ts`에 `debouncedQuery` state + `setTimeout` 300ms 추가
- `query` 변경 시 타이머 리셋, 300ms 후 `debouncedQuery` 업데이트 → SWR key 변경 → refetch
- 입력 중 연속 API 호출 방지

---

## 7. API `ERROR` 상태를 `NOT_FOUND`와 동일하게 처리

### 상태: ❌ 미완료

### 관련 코드

```ts
if (data?.response?.status !== "OK") return NextResponse.json(empty);
```

### 수정 방향

- `NOT_FOUND` → 빈 결과 (현재 동작 유지)
- `ERROR` → 에러 코드와 메시지를 함께 반환하여 클라이언트에서 구분 가능하게 처리
- API 라우트 응답 타입에 `error?: { code: string; text: string }` 필드 추가

---

## 8. 기타 참고 사항

### 8-1. `addProtocol`이 `useEffect` 내부에서 매 마운트마다 호출

`v-world-map.tsx:45-98`에서 `addProtocol`이 `useEffect([])`으로 마운트 시 한 번 호출됩니다. MapLibre의 `addProtocol`은 같은 프로토콜명으로 호출 시 이전 핸들러를 덮어쓰므로 기능적 문제는 없으나, component remount 시에도 다시 호출되는 점을 인지.

### 8-2. `useEffect` 의존성 배열의 안정성

`search.tsx:313-318`의 `ensureLayers` useEffect는 `[map]`에 의존합니다. `map` 인스턴스가 안정적이므로 문제없습니다.

### 8-3. `PIN_LABELS`와 `indexToLabel` 매칭

`search.tsx:54`에서 30개의 라벨을 미리 생성하고, `toResultsFeatureCollection`과 `renderList` 모두 현재 페이지의 `idx`를 사용해 동일한 라벨을 생성합니다. 현재 페이지 내에서는 매칭되나, 페이지네이션 시 라벨이 리셋됩니다.

### 8-4. `searchQuery` / `draftQuery` 이중 상태

`search.tsx:276-278`에서 `draftQuery`(raw input)와 `searchQuery`(trim된 제출값)를分开 관리합니다. 입력 중 실시간 검색이 아닌 폼 제출 방식이므로 의도된 동작입니다.
