import { Agent, get } from "node:https";
import type { OsmStyleJson } from "./types.js";

const VERSATILES_STYLE_URL =
  "https://tiles.versatiles.org/assets/styles/colorful/style.json";
const VERSATILES_SPRITE_BASE = "https://tiles.versatiles.org/assets/sprites/basics";
const SPRITE_FILENAMES = [
  "sprites.json",
  "sprites.png",
  "sprites@2x.json",
  "sprites@2x.png",
] as const;

// 이 실행 환경은 IPv6 경로가 막혀 있어 Node의 기본 Happy-Eyeballs 동시접속이
// ETIMEDOUT으로 죽는다(curl은 IPv4를 우선해 정상 동작). family:4를 강제해 우회한다.
const ipv4Agent = new Agent({ family: 4 });

function getBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    get(url, { agent: ipv4Agent }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`다운로드 실패: ${res.statusCode} ${res.statusMessage} (${url})`));
        res.resume();
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

export async function downloadStyle(): Promise<OsmStyleJson> {
  const buffer = await getBuffer(VERSATILES_STYLE_URL);
  return JSON.parse(buffer.toString("utf8")) as OsmStyleJson;
}

export interface DownloadedSprite {
  filename: string;
  buffer: Buffer;
}

export async function downloadSprites(): Promise<DownloadedSprite[]> {
  const results: DownloadedSprite[] = [];
  for (const filename of SPRITE_FILENAMES) {
    const url = `${VERSATILES_SPRITE_BASE}/${filename}`;
    const buffer = await getBuffer(url);
    results.push({ filename, buffer });
  }
  return results;
}
