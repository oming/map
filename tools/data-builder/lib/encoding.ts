import iconv from "iconv-lite";

/**
 * BOM 제거 → UTF-8 디코드 시도 → U+FFFD(치환 문자)가 나타나면 CP949로 재디코드.
 * 공공데이터포털 원본 CSV는 보통 CP949/EUC-KR이므로 naked toString("utf8")로는
 * 조용히 깨진다 — 항상 이 함수를 거칠 것.
 */
export function decodeCsvBuffer(buf: Buffer): string {
  let bytes = buf;
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    bytes = bytes.subarray(3);
  }

  const utf8Text = bytes.toString("utf8");
  if (!utf8Text.includes("�")) {
    return utf8Text;
  }

  return iconv.decode(bytes, "cp949");
}
