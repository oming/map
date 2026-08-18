"use client";

// MapLibre Hash(hash:"map")가 쓰는 것과 같은 정규화를 그대로 재현한다.
// 다르면 우리가 쓴 다음 MapLibre가(또는 그 반대가) 다시 정규화하면서 URL이 눈에 띄게 튄다.
const LEGACY_HASH_RE =
  /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)(\/.*)?$/;

/**
 * `new Map()` 생성 **이전에** 호출한다.
 * 구버전 링크(`#13/37.5/127.0`)를 named hash(`#map=13/37.5/127.0`)로 옮긴다.
 * 그대로 두면 MapLibre가 `map` 키를 찾지 못해 위치를 무시하고, 이후 우리가 `map=`을
 * 새로 써도 원래 있던 좀비 세그먼트가 영구히 남는다.
 */
export function migrateLegacyHash(): void {
  if (typeof window === "undefined") return;
  const h = window.location.hash.slice(1);
  if (LEGACY_HASH_RE.test(h)) {
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}#map=${h}`,
    );
  }
}

function normalize(params: URLSearchParams): string {
  return (
    "#" +
    decodeURIComponent(params.toString())
      .replace(/=&/g, "&")
      .replace(/=$/g, "")
  );
}

/** 우리 소유 해시 파라미터 하나를 읽는다. MapLibre가 쓰는 `map` 키는 건드리지 않는다. */
export function readHashParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.hash.slice(1)).get(key);
}

/**
 * 우리 소유 해시 파라미터 하나를 쓴다. `value`가 빈 문자열이거나 null이면 키를 삭제한다.
 * 항상 이 함수를 통해서만 쓸 것 — `location.hash = ...`는 `hashchange`를 발화시켜
 * MapLibre의 `jumpTo()`를 트리거하고, 300ms 스로틀 때문에 패닝 중 지도가 뒤로 튄다.
 */
export function writeHashParam(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
  const hash = normalize(params);
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${window.location.search}${hash}`,
  );
}

/**
 * `hashchange` 구독 헬퍼. 우리 `writeHashParam`(replaceState)은 이 이벤트를 쏘지 않으므로
 * 자기 자신을 재유도하는 루프가 생기지 않는다 — 뒤로/앞으로가기, 북마크 진입만 잡힌다.
 */
export function subscribeHashChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
