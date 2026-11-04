@echo off
chcp 65001 > nul
title AIデータ監査システム

echo ====================================================
echo   AIデータ監査システム 起動中...
echo ====================================================

:: 既存のポート8000使用プロセスを終了
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a > nul 2>&1
)

:: Pythonサーバーをバックグラウンド起動
start "" /b python "%~dp0auditor_server.py"

:: 起動待機
timeout /t 1 /nobreak > nul

:: ブラウザでUI画面を開く
start "" "%~dp0auditor_app.html"

echo.
echo サーバーが起動しました (http://localhost:8000)
echo このウィンドウを閉じるとサーバーが停止します。
echo 終了する場合は「AIデータ監査システム停止.bat」を実行してください。
echo.
pause
