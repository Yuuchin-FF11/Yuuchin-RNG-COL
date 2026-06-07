@echo off
cd /d "%~dp0.."
start msedge.exe --disable-web-security --disable-site-isolation-trials --user-data-dir="%temp%\edge_translation_app" --use-fake-ui-for-media-stream --app="http://localhost:8080/comment-viewer/admin.html"
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File server.ps1
pause
