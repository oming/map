/**
 * 앱 아이콘(app/icon.tsx, app/apple-icon.tsx)과 OG 이미지(app/opengraph-image.tsx)가
 * 공유하는 브랜드 마크 + OG 팔레트.
 *
 * QWER 로고(육각형 6조각 + 흰색 면 3장)를 그대로 가져오되, **아래 두 조각의 꼭짓점만**
 * 아래로 늘려 지도 마커로 읽히게 한 변형이다. 나머지 4조각과 흰색 면 3장은 원본
 * path 문자열 그대로다.
 *
 * 원본: /Users/anhyosang/Developer/qwer.dev/apps/web/public/logo.svg
 * (같은 마크가 qwer.dev의 packages/ui/src/components/qwer-logo.tsx에도 있다)
 * ⚠️ 두 저장소가 공유 패키지 없이 **복사**로 연결되어 있다 — 원본 로고가 바뀌면 여기도 수동으로 맞춰야 한다.
 *
 * `_og` 디렉터리는 언더스코어 프리픽스라 라우트로 잡히지 않는다(Next private folder).
 */

/**
 * 원본 육각형 아래 꼭짓점은 y≈450.75. 여기까지 늘려 핀 끝을 만든다.
 * 조금만 늘리면(≈500) 그냥 육각형으로 보이고 마커로 읽히지 않는다 — 전체 높이가
 * 폭의 1.4배쯤 되어야 핀 실루엣이 산다.
 */
const TIP_Y = 545;

/** 원본 실루엣 경계 — viewBox를 계산해 마크를 정사각형 안에 다시 가운데 맞추는 데 쓴다. */
const MIN_X = 87.38221;
const MAX_X = 424.63947;
const MIN_Y = 61.24841;

/** 마크가 정사각형 뷰포트에서 차지할 비율 (나머지는 상하좌우 여백). */
const FILL_RATIO = 0.86;

const CX = (MIN_X + MAX_X) / 2;
const CY = (MIN_Y + TIP_Y) / 2;
const VIEW = (TIP_Y - MIN_Y) / FILL_RATIO;
const VIEW_BOX = `${CX - VIEW / 2} ${CY - VIEW / 2} ${VIEW} ${VIEW}`;

/** qwer.dev OG(apps/web/app/og/route.tsx)와 동일한 팔레트 — 형제 앱과 결을 맞춘다. */
export const OG_BG = "#f8fafc"; // slate-50
export const OG_FG = "#0f172a"; // slate-900
export const OG_MUTED = "#475569"; // slate-600
export const OG_ACCENT = "#1d4ed8"; // blue-700 — 워드마크 강조
export const OG_GRID = "rgba(99,102,241,0.15)"; // indigo-500 15%
export const OG_DOT = "rgba(99,102,241,0.2)"; // indigo-500 20%

export function QwerPinMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox={VIEW_BOX} fill="none">
      <g>
        {/* 위쪽 4조각 — 원본 그대로 */}
        <path
          d="m424.45221,353.48099l-168.6973,-97.42838l168.6973,-97.42844l0,194.85684l0,-0.00003l0,0z"
          fill="#289541"
        />
        <path
          d="m424.63947,158.72382l-168.80522,97.4288l-0.02713,-194.90421l168.83235,97.4754z"
          fill="#f1c219"
        />
        <path
          d="m256.36749,61.24841l-0.02679,195.08063l-168.95849,-97.51694l168.98528,-97.56369z"
          fill="#f29418"
        />
        <path
          d="m87.38221,158.62418l168.93133,97.56357l-168.93133,97.5639l0,-195.12747l0,0z"
          fill="#ca0717"
        />

        {/* 아래 2조각 — 꼭짓점을 TIP_Y까지 늘린 핀 끝 */}
        <path d={`M256 256 L424.45221 353.48099 L256 ${TIP_Y} Z`} fill="#1c897a" />
        <path d={`M256 256 L256 ${TIP_Y} L87.38221 353.37701 Z`} fill="#a4014e" />

        {/* 흰색 면 3장 — 원본 그대로. 전부 y≈390 위에서 끝나므로 늘어난 끝부분은 원색으로 남는다. */}
        <path
          opacity="0.1"
          d="m87.36053,192.10899l168.55095,-122.62109l168.54073,122.62109l-64.37766,198.42226l-208.33662,0l-64.37738,-198.42226l-0.00001,0l-0.00001,0z"
          fill="#ffffff"
        />
        <path
          opacity="0.1"
          d="m102.26247,236.75505l153.78852,-153.78435l153.78018,153.78435l-153.78018,153.83766l-153.78852,-153.83766z"
          fill="#ffffff"
        />
        <path
          opacity="0.1"
          d="m170.96591,305.26746l85.08029,-148.8904l85.08151,148.8904l-170.1618,0z"
          fill="#ffffff"
        />
      </g>
    </svg>
  );
}
