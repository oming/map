import { ImageResponse } from "next/og";
import { QwerPinMark } from "./_og/mark";

export const contentType = "image/png";

/** app/manifest.ts의 icons[].src("/icon/192", "/icon/512")가 여기 id와 짝을 이룬다. */
export function generateImageMetadata() {
  return [
    { id: "192", size: { width: 192, height: 192 }, contentType },
    { id: "512", size: { width: 512, height: 512 }, contentType },
  ];
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const size = Number(await id);

  return new ImageResponse(
    (
      // 배경을 채우지 않는다 — qwer.dev 형제 앱 아이콘은 전부 투명 배경이고,
      // 마크 자체가 17% 내부 여백을 갖고 있어 그게 곧 숨 쉴 공간이다.
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <QwerPinMark size={size} />
      </div>
    ),
    { width: size, height: size },
  );
}
