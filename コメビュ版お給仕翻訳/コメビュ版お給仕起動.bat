@echo off
cd /d "%~dp0.."
echo Cleaning up old server processes on port 8080...
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -Command "Get-Process -Name powershell -ErrorAction SilentlyContinue | ForEach-Object { if ((Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -eq $_.Id })) { Stop-Process -Id $_.Id -Force } }; Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"
start msedge.exe --disable-web-security --disable-site-isolation-trials --user-data-dir="%temp%\edge_translation_app" --use-fake-ui-for-media-stream "http://localhost:8080/comment-viewer/admin.html"
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File server.ps1
pause
