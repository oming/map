"""
브이월드 getStyle(StyleJson) 데이터 → MapLibre 스프라이트(sprite.png + sprite.json) 생성

자동 파이프라인 (V-World API 통합):
  1) V-World API에서 vectorStylePoi.js 다운로드
  2) node extract_style.js 로 StyleJson() JSON 추출 (subprocess)
  3) Python으로 base64 아이콘 디코딩 + 스프라이트 패킹 → /public/sprite/ 배치

필요 패키지: pip install Pillow cairosvg
"""

import base64
import io
import json
import os
import subprocess
import tempfile
import urllib.request
from pathlib import Path

import cairosvg
from PIL import Image

PADDING = 1  # 아이콘 사이 여백(px) — 렌더링 시 이웃 아이콘이 살짝 비치는 걸 방지

# V-World API 스타일 파일 다운로드 URL 템플릿
VWORLD_STYLE_URL_TEMPLATE = (
    "https://api.vworld.kr/req/wmts/vector/getStyle/{api_key}/vectorStylePoi"
)


def download_style_file(api_key: str, output_path: str = "vectorStylePoi.js") -> bool:
    """V-World API에서 vectorStylePoi.js를 다운로드합니다.

    Args:
        api_key: V-World API 키
        output_path: 다운로드 파일 저장 경로

    Returns:
        True if success, False otherwise
    """
    url = VWORLD_STYLE_URL_TEMPLATE.format(api_key=api_key)
    try:
        print(f"[1/3] V-World API에서 스타일 파일 다운로드: {url}")
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
        Path(output_path).write_bytes(data)
        print(f"  → {output_path} 저장 완료 ({len(data)} bytes)")
        return True
    except Exception as e:
        print(f"  ⚠ 다운로드 실패: {e}")
        return False


def load_icons(style_data: dict) -> dict[str, Image.Image]:
    """cl_id별 symbolImageCn(base64 data URI)을 디코딩해서 PIL 이미지로 변환.
    symbolImageCn이 없는 항목(라벨 전용 스타일)은 건너뜀."""
    icons: dict[str, Image.Image] = {}
    skipped = []

    for cl_id, style in style_data.items():
        symbol_style = style.get("symbolStyle") or {}
        data_uri = symbol_style.get("symbolImageCn")
        if not data_uri:
            skipped.append(cl_id)
            continue

        # data:image/png;base64,XXXX 또는 data:image/svg+xml;base64,XXXX 형태
        try:
            header, b64data = data_uri.split(",", 1)
            raw_bytes = base64.b64decode(b64data)

            if "svg" in header:
                # 극소수 항목이 SVG로 되어 있음 (PNG가 아님) — 래스터로 변환 후 사용
                raw_bytes = cairosvg.svg2png(bytestring=raw_bytes)

            img = Image.open(io.BytesIO(raw_bytes)).convert("RGBA")
            icons[cl_id] = img
        except Exception as e:
            print(f"  ⚠ {cl_id} 디코딩 실패: {e}")

    print(f"아이콘 추출 완료: {len(icons)}개 (아이콘 없음/스킵: {len(skipped)}개)")
    return icons


MAX_WIDTH = 4096  # MapLibre 텍스처 최대 크기(2048) × pixelRatio=2


def pack_sprite(icons: dict[str, Image.Image]):
    """단순 셸프(shelf) 패킹: 높이 내림차순으로 정렬해 왼쪽→오른쪽으로 채우고,
    한 줄이 MAX_WIDTH를 넘으면 다음 줄로 내려감.

    2x 스프라이트를 직접 빌드하므로, 1x 기준 2048px(MapLibre 표준)에 해당하는
    4096px까지 캔버스 너비를 허용합니다.
    """
    items = sorted(icons.items(), key=lambda kv: kv[1].height, reverse=True)

    positions: dict[str, tuple[int, int, int, int]] = {}
    x_cursor = 0
    y_cursor = 0
    row_height = 0
    canvas_width = 0

    for cl_id, img in items:
        w, h = img.width, img.height
        if x_cursor + w > MAX_WIDTH:
            # 다음 줄로
            x_cursor = 0
            y_cursor += row_height + PADDING
            row_height = 0

        positions[cl_id] = (x_cursor, y_cursor, w, h)
        canvas_width = max(canvas_width, x_cursor + w)
        row_height = max(row_height, h)
        x_cursor += w + PADDING

    canvas_height = y_cursor + row_height

    canvas = Image.new("RGBA", (canvas_width, canvas_height), (0, 0, 0, 0))
    sprite_json: dict[str, dict] = {}

    for cl_id, (x, y, w, h) in positions.items():
        canvas.paste(icons[cl_id], (x, y), icons[cl_id])
        sprite_json[cl_id] = {
            "width": w,
            "height": h,
            "x": x,
            "y": y,
            "pixelRatio": 2,
        }

    return canvas, sprite_json


def main():
    # 1) API 키 확인: VWORLD_API_KEY → NEXT_PUBLIC_VWORLD_API_KEY 순으로 탐색
    api_key = (
        os.environ.get("VWORLD_API_KEY") or os.environ.get("NEXT_PUBLIC_VWORLD_API_KEY")
    )
    if not api_key:
        print("⚠ VWORLD_API_KEY 환경 변수가 설정되지 않았습니다.")
        print(
            "  export VWORLD_API_KEY=<your-key> 또는 .env.local 파일을 확인하세요."
        )
        return

    script_dir = Path(__file__).parent

    # 임시 디렉토리에서 파이프라인 실행 → 완료 시 자동 정리 (vectorStylePoi.js 잔여물 방지)
    with tempfile.TemporaryDirectory() as tmp:
        # 2) V-World API에서 스타일 파일 다운로드 (임시 디렉토리)
        style_js_path = os.path.join(tmp, "vectorStylePoi.js")
        if not download_style_file(api_key, style_js_path):
            return

        # 3) Node.js extract_style.js로 JSON 추출 (하위 프로세스 실행)
        extract_script = script_dir / "extract_style.js"
        if not extract_script.exists():
            print("⚠ extract_style.js를 찾을 수 없습니다.")
            return

        result = subprocess.run(
            ["node", str(extract_script), style_js_path],
            capture_output=True,
            text=True,
        )
    if result.returncode != 0:
        print(f"⚠ extract_style.js 실행 실패:\n{result.stderr}")
        return

    # extract_style.js가 stdout으로 JSON을 출력하므로 직접 파싱
    try:
        style_data = json.loads(result.stdout)
    except json.JSONDecodeError as e:
        print(f"⚠ extract_style.js 출력 파싱 실패:\n{e}")
        return

    # 4) 기존 스프라이트 빌딩 로직 (icon loading + packing + output)
    print(f"[2/3] 스타일 데이터 처리: 전체 cl_id {len(style_data)}개")
    icons = load_icons(style_data)

    if not icons:
        print("추출된 아이콘이 없습니다.")
        return

    canvas, sprite_json = pack_sprite(icons)

    # 5) 출력을 /public/sprite/에 직접 배치
    output_dir = script_dir.parent.parent / "public" / "sprite"
    output_dir.mkdir(parents=True, exist_ok=True)

    # 2x 스프라이트를 직접 빌드 → sprite@2x.png + sprite@2x.json (pixelRatio=2)
    sprite_at2x_png_path = output_dir / "sprite@2x.png"
    sprite_at2x_json_path = output_dir / "sprite@2x.json"

    canvas.save(sprite_at2x_png_path)
    with open(sprite_at2x_json_path, "w", encoding="utf-8") as f:
        json.dump(sprite_json, f, ensure_ascii=False, indent=2)

    # 1x 스프라이트: 2x 캔버스를 LANCZOS로 다운스케일 → sprite.png + sprite.json (pixelRatio=1)
    canvas_1x = canvas.resize(
        (canvas.width // 2, canvas.height // 2), Image.LANCZOS
    )
    sprite_png_path = output_dir / "sprite.png"
    sprite_json_path = output_dir / "sprite.json"

    canvas_1x.save(sprite_png_path)

    sprite_json_1x: dict[str, dict] = {}
    for cl_id, info in sprite_json.items():
        sprite_json_1x[cl_id] = {
            "width": info["width"] // 2,
            "height": info["height"] // 2,
            "x": info["x"] // 2,
            "y": info["y"] // 2,
            "pixelRatio": 1,
        }
    with open(sprite_json_path, "w", encoding="utf-8") as f:
        json.dump(sprite_json_1x, f, ensure_ascii=False, indent=2)

    print(f"[3/3] 스프라이트 생성 완료")
    print(
        f"  → {sprite_png_path} ({canvas_1x.width}x{canvas_1x.height}, pixelRatio=1)"
    )
    print(f"  → {sprite_json_path}")
    print(
        f"  → {sprite_at2x_png_path} ({canvas.width}x{canvas.height}, pixelRatio=2)"
    )
    print(f"  → {sprite_at2x_json_path}")


if __name__ == "__main__":
    main()
