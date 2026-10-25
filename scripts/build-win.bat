@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0\.."
echo === Windows ビルド (NSISインストーラー + ポータブル版) ===

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js が見つかりません。https://nodejs.org/ から LTS 版をインストールしてください。
  pause
  exit /b 1
)

echo [1/2] 依存パッケージをインストール中...
call npm install
if errorlevel 1 goto :fail

echo [2/2] ビルド中...
call npm run dist:win
if errorlevel 1 goto :fail

echo.
echo 完了しました。dist フォルダを開きます。
explorer "%~dp0\..\dist"
pause
exit /b 0

:fail
echo.
echo [ERROR] ビルドに失敗しました。上のメッセージを確認してください。
pause
exit /b 1
