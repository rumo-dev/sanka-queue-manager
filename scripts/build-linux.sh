#!/usr/bin/env bash
# Linux ビルド (AppImage)。Linux 上 (または WSL/Docker) で実行してください。
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$(uname)" != "Linux" ]; then
  echo "[ERROR] Linux 用ビルドは Linux 上で実行してください。" >&2
  exit 1
fi
command -v node >/dev/null || { echo "[ERROR] Node.js が見つかりません (https://nodejs.org/)" >&2; exit 1; }

echo "[1/2] 依存パッケージをインストール中..."
npm install
echo "[2/2] ビルド中..."
npm run dist:linux

echo "完了: dist/"
