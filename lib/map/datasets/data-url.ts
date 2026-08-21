import manifest from "./data-manifest.json";

/**
 * data-builder(tools/data-builder/lib/output.ts)가 생성한 콘텐츠 해시 파일명
 * (/data/<id>.<hash>.geojson)을 가리키는 URL을 만든다.
 *
 * next.config.ts가 /data/:path*를 immutable(1년) 캐시로 설정해두므로, 파일명이
 * 고정돼 있으면 data-builder를 재실행해 내용이 바뀌어도 브라우저가 옛 데이터를
 * 계속 쓴다 — 매니페스트의 해시를 URL에 넣어야 재빌드마다 안전하게 갱신된다.
 */
export function dataUrl(id: string): string {
  const hash = (manifest as Record<string, string>)[id];
  if (!hash) {
    throw new Error(
      `lib/map/datasets/data-manifest.json에 "${id}" 항목이 없습니다 — ` +
        `tools/data-builder를 먼저 실행하세요.`,
    );
  }
  return `/data/${id}.${hash}.geojson`;
}
