#!/usr/bin/env bash
# macOS ビルド (dmg: Intel + Apple Silicon)。macOS 上で実行してください。
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$(uname)" != "Darwin" ]; then
  echo "[ERROR] macOS 用ビルドは macOS 上でのみ実行できます。" >&2
  exit 1
fi
command -v node >/dev/null || { echo "[ERROR] Node.js が見つかりません (https://nodejs.org/)" >&2; exit 1; }

echo "[1/2] 依存パッケージをインストール中..."
npm install
echo "[2/2] ビルド中..."
# 署名・公証する場合は事前に環境変数を設定: CSC_LINK / CSC_KEY_PASSWORD / APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID
npm run dist:mac

echo "完了: dist/"
open dist 2>/dev/null || true
