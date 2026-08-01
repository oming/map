"""
브이월드 getStyle(StyleJson) 데이터 → MapLibre 스프라이트(sprite.png + sprite.json) 생성

사용 순서:
  1) node extract_style.js  (아래 별도 안내)  →  style_data.json 생성
     (StyleJson() JS 객체를 안전하게 실행해서 JSON으로 뽑아내는 단계.
      정규식으로 직접 파싱하지 않는 이유: 이 객체는 키가 따옴표 없는
      JS 리터럴이라, 문자열 안에 중첩된 따옴표/이스케이프까지 있으면
      정규식이 깨지기 쉽다. JS 엔진(node)이 직접 실행해서 파싱하게
      하는 게 훨씬 안전하다.)
  2) python3 build_sprite.py  →  sprite.png, sprite.json 생성

#### 중단 #### 필요 패키지: pip install Pillow --break-system-packages
# 1. 프로젝트 전용 가상환경 생성 (.venv라는 이름)
python3 -m venv .venv

# 2. 가상환경 활성화
source .venv/bin/activate

# 3. 안전하게 설치 (이때는 --break-system-packages 옵션이 필요 없음)
pip install Pillow
"""

import base64
import io
import json
from pathlib import Path

import cairosvg
from PIL import Image

STYLE_DATA_PATH = Path("style_data.json")
OUTPUT_PNG_PATH = Path("sprite.png")
OUTPUT_JSON_PATH = Path("sprite.json")

PADDING = 1  # 아이콘 사이 여백(px) — 렌더링 시 이웃 아이콘이 살짝 비치는 걸 방지


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


def pack_sprite(icons: dict[str, Image.Image], max_width: int = 2048):
    """단순 셸프(shelf) 패킹: 높이 내림차순으로 정렬해 왼쪽→오른쪽으로 채우고,
    한 줄이 max_width를 넘으면 다음 줄로 내려감."""
    items = sorted(icons.items(), key=lambda kv: kv[1].height, reverse=True)

    positions: dict[str, tuple[int, int, int, int]] = {}
    x_cursor = 0
    y_cursor = 0
    row_height = 0
    canvas_width = 0

    for cl_id, img in items:
        w, h = img.width, img.height
        if x_cursor + w > max_width:
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
            "pixelRatio": 1,
        }

    return canvas, sprite_json


def main():
    with open(STYLE_DATA_PATH, encoding="utf-8") as f:
        style_data = json.load(f)

    print(f"전체 cl_id 개수: {len(style_data)}")
    icons = load_icons(style_data)

    if not icons:
        print("추출된 아이콘이 없습니다. style_data.json 구조를 확인해주세요.")
        return

    canvas, sprite_json = pack_sprite(icons)
    canvas.save(OUTPUT_PNG_PATH)
    with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(sprite_json, f, ensure_ascii=False, indent=2)

    print(f"완료: {OUTPUT_PNG_PATH} ({canvas.width}x{canvas.height}), {OUTPUT_JSON_PATH}")


if __name__ == "__main__":
    main()
