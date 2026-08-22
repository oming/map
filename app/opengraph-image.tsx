import { ImageResponse } from "next/og";
import {
  OG_ACCENT,
  OG_BG,
  OG_DOT,
  OG_FG,
  OG_GRID,
  OG_MUTED,
  QwerPinMark,
} from "./_og/mark";

export const alt = "map.qwer.dev — 지도로 보는 대한민국 공공정보";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HEADLINE_1 = "지도로 보는";
const HEADLINE_2 = "대한민국 공공정보";
const SUBLINE = "공공 와이파이 · 공중화장실 · 문화축제";
const WORDMARK_ACCENT = "map";
const WORDMARK_REST = ".qwer.dev";

/**
 * next/og 기본 폰트는 라틴 전용이라 한글이 두부(□)로 나온다.
 * public/font의 NanumGothic은 MapLibre SDF 글리프 .pbf라 여기서 쓸 수 없으므로,
 * Google Fonts CSS API에 `&text=`로 **실제 쓸 글자만** 요청해 서브셋 TTF를 받아온다.
 *
 * User-Agent를 넘기지 않아야 woff2 대신 truetype/opentype을 돌려준다 — Satori는 woff2를 못 읽는다.
 * 빌드 타임 외부 네트워크 의존이므로 실패해도 빌드를 깨지 않고 null을 반환한다.
 */
async function loadKoreanFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&display=swap&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(cssUrl)).text();
    const match = css.match(
      /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/,
    );
    if (!match) throw new Error("CSS 응답에서 truetype/opentype URL을 찾지 못했다");

    const res = await fetch(match[1]);
    if (!res.ok) throw new Error(`폰트 파일 응답 ${res.status}`);
    return await res.arrayBuffer();
  } catch (e) {
    // 빌드를 깨뜨리지 않는다. 대신 OG 이미지에서 한글 줄이 빠졌다는 사실은 남긴다.
    console.warn(
      "[og] Noto Sans KR 로드 실패 — OG 이미지를 라틴 텍스트만으로 생성한다:",
      e,
    );
    return null;
  }
}

export default async function OpenGraphImage() {
  // 화면에 그리는 모든 글자를 한 번에 요청해야 한다. 워드마크를 빼면 한글 줄에 우연히 들어 있는
  // 라틴 글자(a, p, e, r…)만 Noto에서 나오고 나머지는 기본 폰트로 떨어져 자간/굵기가 뒤섞인다.
  const fontData = await loadKoreanFont(
    HEADLINE_1 + HEADLINE_2 + SUBLINE + WORDMARK_ACCENT + WORDMARK_REST,
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 100,
          background: OG_BG,
          color: OG_FG,
          // 반드시 스프레드로 키 자체를 없앤다. `fontFamily: undefined`를 넘기면 Satori가
          // undefined.split()을 호출하며 터지고, 빌드가 통째로 실패한다.
          ...(fontData ? { fontFamily: "Noto Sans KR" } : {}),
        }}
      >
        {/* 배경 격자(위에서 페이드) + 도트(아래에서 페이드) — qwer.dev 블로그 OG와 같은 트리트먼트.
            반드시 인라인 SVG의 <pattern>/<mask>로 그린다. CSS `backgroundSize` 타일링과
            `repeating-linear-gradient`는 Satori가 렌더하지 않아 배경이 통째로 사라진다(실측 확인). */}
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          <svg width={size.width} height={size.height}>
            <defs>
              <pattern
                id="grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M40 0H0V40"
                  fill="none"
                  stroke={OG_GRID}
                  strokeWidth="1"
                />
              </pattern>
              <pattern
                id="dots"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="1.5" fill={OG_DOT} />
              </pattern>
              <linearGradient id="fadeDown" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="white" />
                <stop offset="60%" stopColor="transparent" />
              </linearGradient>
              <linearGradient id="fadeUp" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="white" />
                <stop offset="60%" stopColor="transparent" />
              </linearGradient>
              <mask id="gridMask">
                <rect width="100%" height="100%" fill="url(#fadeDown)" />
              </mask>
              <mask id="dotsMask">
                <rect width="100%" height="100%" fill="url(#fadeUp)" />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="url(#grid)"
              mask="url(#gridMask)"
            />
            <rect
              width="100%"
              height="100%"
              fill="url(#dots)"
              mask="url(#dotsMask)"
            />
          </svg>
        </div>

        {/* 콘텐츠 */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 40,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <QwerPinMark size={96} />
            <div style={{ display: "flex", fontSize: 56, fontWeight: 700 }}>
              <span style={{ color: OG_ACCENT }}>{WORDMARK_ACCENT}</span>
              <span>{WORDMARK_REST}</span>
            </div>
          </div>

          {/* 폰트를 못 받아왔으면 한글 줄을 통째로 뺀다 (두부 방지). */}
          {fontData && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 76,
                fontWeight: 700,
                letterSpacing: "-0.04em",
                lineHeight: 1.25,
              }}
            >
              <span>{HEADLINE_1}</span>
              <span>{HEADLINE_2}</span>
            </div>
          )}

          {fontData && (
            <div style={{ fontSize: 30, color: OG_MUTED }}>{SUBLINE}</div>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [
            {
              name: "Noto Sans KR",
              data: fontData,
              weight: 700 as const,
              style: "normal" as const,
            },
          ]
        : undefined,
    },
  );
}
