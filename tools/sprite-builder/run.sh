#!/bin/bash
# V-World POI 스프라이트 전체 파이프라인 실행
# 1) V-World API에서 vectorStylePoi.js 다운로드
# 2) Node.js로 StyleJson() JSON 추출
# 3) Python으로 스프라이트 시트 생성 → /public/sprite/ 배치

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

echo "=== V-World POI Sprite Builder ==="
cd "$SCRIPT_DIR"

# --- 가상환경 자동 설정 (첫 실행 시에만 pip install 발생) ---
VENV_DIR="$SCRIPT_DIR/.venv"
if [ ! -d "$VENV_DIR" ]; then
  echo "🔧 가상환경 생성 중: $VENV_DIR"
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install -q -r "$SCRIPT_DIR/requirements.txt"
  echo "✅ 가상환경 준비 완료"
else
  echo "📦 가상환경 사용: $VENV_DIR"
fi

# 가상환경 Python으로 스크립트 실행 (내부에서 download → extract → build 모두 처리)
"$VENV_DIR/bin/python" build_sprite.py

echo "=== 완료 ==="
