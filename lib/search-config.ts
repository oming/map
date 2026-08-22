/**
 * 검색 API가 한 페이지에 돌려주는 결과 수의 상한.
 *
 * lib/map/search-layers.ts가 라벨(A~Z, 27…)마다 핀 이미지를 하나씩 미리 등록하므로,
 * 이 값을 넘는 결과는 등록되지 않은 icon-image를 참조해 핀이 조용히 사라진다.
 * 페이지당 결과 수를 늘리려면 이 상수만 올리면 된다 — 핀 이미지도 함께 따라온다.
 *
 * 서버(app/api/geo-search)와 클라이언트(lib/map/search-layers)가 함께 쓰므로
 * "use client"를 붙이지 않는다.
 */
export const MAX_SEARCH_RESULT_SIZE = 30;
