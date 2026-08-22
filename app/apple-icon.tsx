import { ImageResponse } from "next/og";
import { QwerPinMark } from "./_og/mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // 일반 아이콘과 달리 여기만 불투명 흰 배경을 준다 — iOS는 투명 픽셀을
          // 검게 합성하므로 투명 배경이면 홈 화면에서 까만 타일로 나온다.
          // 모서리는 iOS가 알아서 깎으므로 borderRadius를 주지 않는다(주면 깎인 바깥이 검게 남는다).
          background: "#ffffff",
        }}
      >
        <QwerPinMark size={size.width} />
      </div>
    ),
    size,
  );
}
