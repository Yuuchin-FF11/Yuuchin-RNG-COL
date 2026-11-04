@echo off
title コメビュV2 起動ランチャー

cd /d "%~dp0"

echo ====================================================
echo   配信者用コメビュ V2 (高速・軽量版) を起動しています
echo ====================================================

if exist "current_port.txt" del /f /q "current_port.txt"

powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name = 'msedge.exe'\" | Where-Object { $_.CommandLine -like '*edge_comment_viewer_v2*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name = 'python.exe'\" | Where-Object { $_.CommandLine -like '*mic_bridge.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo OS直結マイクブリッジを起動します...
start /b "" python "%~dp0mic_bridge.py"

echo ローカルサーバー待機を開始します...
start /b "" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"

set TARGET_PORT=8080
set WAIT_COUNT=0
:WAIT_PORT
if exist "current_port.txt" (
    set /p TARGET_PORT=<"current_port.txt"
    goto PORT_FOUND
)
timeout /t 1 /nobreak >nul
set /a WAIT_COUNT+=1
if %WAIT_COUNT% lss 5 goto WAIT_PORT

:PORT_FOUND
echo サーバー待機ポート: %TARGET_PORT%

echo Edge管理画面を起動します...
start msedge.exe --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --intensive-wake-up-throttling=disabled --lang=ja --disable-web-security --disable-site-isolation-trials --autoplay-policy=no-user-gesture-required --user-data-dir="%temp%\edge_comment_viewer_v2" --use-fake-ui-for-media-stream --app="http://localhost:%TARGET_PORT%/admin.html"

echo ====================================================
echo   コメビュV2 は正常に起動しました
echo   このウィンドウを閉じるとサーバーが停止します
echo ====================================================
pause

echo 関連プロセスを終了しています...
powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name = 'python.exe'\" | Where-Object { $_.CommandLine -like '*mic_bridge.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name = 'powershell.exe'\" | Where-Object { $_.CommandLine -like '*server.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
