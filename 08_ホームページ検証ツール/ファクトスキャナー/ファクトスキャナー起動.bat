@echo off
chcp 65001 > nul
title ファクト・スキャナー (Fact Scanner)

echo ====================================================
echo   ファクト・スキャナー (Fact Scanner) 起動中...
echo ====================================================

:: 既存のポート8080使用プロセスを終了
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a > nul 2>&1
)

:: Pythonサーバーをバックグラウンド起動
start "" /b python "%~dp0fact_monitor.py"

:: 起動待機
timeout /t 1 /nobreak > nul

:: ブラウザで開く
start http://localhost:8080

echo.
echo サーバーが正常に起動しました (http://localhost:8080)
echo このウィンドウを閉じると監視が終了します。
echo 終了する場合は、このウィンドウで Ctrl + C を押すか「ファクトスキャナー停止.bat」を実行してください。
echo.
pause
