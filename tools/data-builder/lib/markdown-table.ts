const LINK_RE = /\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/;
const BR_PLACEHOLDER_RE = /^<br\s*\/?>$/i;

export interface RestaurantRow {
  rank: number;
  name: string;
  roadAddress: string;
  naverUrl: string;
  phone: string;
  category: string;
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isMeaningful(cell: string): boolean {
  return cell !== "" && !BR_PLACEHOLDER_RE.test(cell);
}

/** 네이버 지도 검색 링크 표시 텍스트는 "경기도 수원시"가 빠진 불완전 주소다 —
 * URL의 `/v5/search/<encoded>` 부분을 디코딩해야 지오코딩 가능한 전체 주소가 나온다. */
function decodeNaverSearchAddress(url: string): string {
  const marker = "/v5/search/";
  const idx = url.indexOf(marker);
  const encoded = idx === -1 ? url : url.slice(idx + marker.length);
  try {
    return decodeURIComponent(encoded).trim();
  } catch {
    return encoded.trim();
  }
}

/**
 * 표의 컬럼 위치를 신뢰하지 않는다 — 원본 90번 행(와우정육식당)처럼 소재지 셀이
 * 비고 `<br />`로 밀리고 나머지 컬럼이 한 칸씩 뒤로 밀린 행이 실제로 존재한다.
 * 대신 각 셀의 내용을 패턴(네이버 지도 링크 / tel: 링크)으로 식별한다.
 */
export function parseRestaurantMarkdownTable(text: string): RestaurantRow[] {
  const rows: RestaurantRow[] = [];

  for (const line of text.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = splitRow(line);
    const rank = Number(cells[0]);
    if (!Number.isInteger(rank) || rank <= 0) continue; // 헤더/구분선 스킵

    const name = cells[1] ?? "";
    let roadAddress = "";
    let naverUrl = "";
    let phone = "";
    const usedIndexes = new Set([0, 1]);

    cells.forEach((cell, index) => {
      const match = cell.match(LINK_RE);
      if (!match) return;
      const href = match[2];
      if (href.startsWith("tel:")) {
        phone = href.slice("tel:".length);
        usedIndexes.add(index);
      } else if (href.includes("map.naver.com")) {
        naverUrl = href;
        roadAddress = decodeNaverSearchAddress(href);
        usedIndexes.add(index);
      }
    });

    let category = "";
    for (let i = 0; i < cells.length; i++) {
      if (usedIndexes.has(i)) continue;
      if (isMeaningful(cells[i])) {
        category = cells[i];
        break;
      }
    }

    rows.push({ rank, name, roadAddress, naverUrl, phone, category });
  }

  return rows;
}
