@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Sanka Queue Manager - 起動

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js が見つかりません。https://nodejs.org/ から LTS 版をインストールしてください。
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo 初回起動の準備中です。依存パッケージをインストールします...
  call npm install
  if errorlevel 1 goto :fail
)

echo Sanka Queue Manager を起動します...
call npm start
set "APP_EXIT=%errorlevel%"
echo.
echo アプリが終了しました。終了コード: %APP_EXIT%
if not "%APP_EXIT%"=="0" echo エラー内容を確認してください。
pause
exit /b 0

:fail
echo.
echo [ERROR] 起動に失敗しました。上のメッセージを確認してください。
pause
exit /b 1
