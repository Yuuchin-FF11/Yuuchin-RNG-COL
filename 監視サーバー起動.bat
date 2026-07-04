@echo off
cd /d %~dp0
title ファクト・スキャナー 監視サーバー

echo ===================================================
echo   ファクト・スキャナー 自動監視サーバーを起動します...
echo   (PowerShellを使用するため、Python不要で動きます)
echo ===================================================
echo.

:: ポート8080の重複プロセス強制終了
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080 ^| findstr LISTENING') do (
    taskkill /f /pid %%a > nul 2>&1
)

:: PowerShellサーバーを非同期で起動
start /b "" powershell -ExecutionPolicy Bypass -File fact_monitor.ps1 > fact_monitor.log 2>&1

:: 起動待機 (2秒)
timeout /t 2 /nobreak > nul

:: ブラウザで開く
start http://localhost:8080/

echo.
echo ---------------------------------------------------
echo   自動監視サーバーが起動しました。
echo   もしブラウザでエラーが出る場合は、「fact_monitor.log」
echo   ファイルを確認し、AIに内容を伝えてください。
echo ---------------------------------------------------
pause
