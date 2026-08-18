// 한반도 여유 bbox (제주/독도 포함). 이 범위를 벗어나면 지오코딩 결과가 잘못됐을 가능성이 높다.
const KOREA_BBOX = { minLon: 124, maxLon: 132, minLat: 33, maxLat: 39 };

export function isInKoreaBBox(lon: number, lat: number): boolean {
  return (
    lon >= KOREA_BBOX.minLon &&
    lon <= KOREA_BBOX.maxLon &&
    lat >= KOREA_BBOX.minLat &&
    lat <= KOREA_BBOX.maxLat
  );
}

/** 좌표 5자리 절삭(~1.1m 정밀도) — brotli 용량을 줄이는 필수 단계. */
export function roundCoord(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

/** macOS에서 만든 파일은 한글이 NFD(자모 분해)로 저장돼 NanumGothic 글리프가 깨져 보인다. */
export function nfc(s: string): string {
  return s.normalize("NFC");
}
