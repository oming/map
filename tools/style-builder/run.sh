#!/bin/bash
# V-World POI 스타일 레이아웃 자동 추출 파이프라인
# 1) V-World API에서 vectorStylePoi.js 다운로드
# 2) Node.js로 MapLibre symbol layer JSON 추출 → data/poi-layers.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && cd .. && pwd)"

# API 키 확인: env var → .env.local에서 자동 읽기
if [ -z "$VWORLD_API_KEY" ] && [ -f "$PROJECT_ROOT/.env.local" ]; then
  read_key=$(grep '^VWORLD_API_KEY=' "$PROJECT_ROOT/.env.local" | head -1 | cut -d'=' -f2- | tr -d '"')
  if [ -n "$read_key" ]; then
    export VWORLD_API_KEY="$read_key"
  fi
fi

if [ -z "$VWORLD_API_KEY" ]; then
  echo "⚠ VWORLD_API_KEY가 설정되지 않았습니다."
  echo "  .env.local에 NEXT_PUBLIC_VWORLD_API_KEY 또는 VWORLD_API_KEY가 있는지 확인하세요."
  exit 1
fi

cd "$SCRIPT_DIR"
TMPDIR=$(mktemp -d)
trap "rm -rf '$TMPDIR'" EXIT

echo "=== V-World POI Style Builder ==="
echo "[1/2] V-World API에서 스타일 파일 다운로드 중..."

# V-World API에서 vectorStylePoi.js 다운로드
STYLE_URL="https://api.vworld.kr/req/wmts/vector/getStyle/${VWORLD_API_KEY}/vectorStylePoi"
if ! curl -fSL "$STYLE_URL" -o "$TMPDIR/vectorStylePoi.js"; then
  echo "⚠ V-World API 다운로드 실패"
  exit 1
fi

# sprite.json 경로 (sprite-builder에서 생성된 기존 파일)
SPRITE_JSON="$PROJECT_ROOT/public/sprite/sprite.json"

echo "[2/2] MapLibre symbol layer 추출 중..."
node extract-vworld-poi-style.js "$TMPDIR/vectorStylePoi.js" "$SPRITE_JSON" "$TMPDIR/out"

# 결과물을 data/poi-layers.json으로 복사
if [ -f "$TMPDIR/out/poi-layers.json" ]; then
  mkdir -p "$PROJECT_ROOT/data"
  cp "$TMPDIR/out/poi-layers.json" "$PROJECT_ROOT/data/poi-layers.json"
  echo "→ $PROJECT_ROOT/data/poi-layers.json 저장 완료"
else
  echo "⚠ poi-layers.json 생성 실패"
  exit 1
fi

echo "=== 완료 ==="
