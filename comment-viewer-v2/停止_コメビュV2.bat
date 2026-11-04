@echo off
title コメビュV2 停止ルーチン

echo コメビュV2 の関連プロセスを停止しています...

powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name = 'msedge.exe'\" | Where-Object { $_.CommandLine -like '*edge_comment_viewer_v2*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name = 'powershell.exe'\" | Where-Object { $_.CommandLine -like '*server.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name = 'python.exe'\" | Where-Object { $_.CommandLine -like '*mic_bridge.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

if exist "%~dp0current_port.txt" del /f /q "%~dp0current_port.txt"

echo コメビュV2 を正常に停止しました。
timeout /t 2 >nul
