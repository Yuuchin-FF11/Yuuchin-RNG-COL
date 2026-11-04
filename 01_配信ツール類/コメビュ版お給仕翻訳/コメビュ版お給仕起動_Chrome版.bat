@echo off
if exist "%~dp0server.ps1" (
    cd /d "%~dp0"
) else if exist "%~dp0..\server.ps1" (
    cd /d "%~dp0.."
) else if exist "%~dp0..\..\server.ps1" (
    cd /d "%~dp0..\.."
) else (
    echo Error: server.ps1 not found!
    pause
    exit /b 1
)
echo Cleaning up old server processes on port 8080...
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -Command "Get-Process | Where-Object { $_.MainWindowTitle -like '*server.ps1*' } | Stop-Process -Force -ErrorAction SilentlyContinue"
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name = 'chrome.exe'\" | Where-Object { $_.CommandLine -like '*chrome_translation_app*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
start chrome.exe --lang=ja --disable-web-security --disable-site-isolation-trials --autoplay-policy=no-user-gesture-required --user-data-dir="%temp%\chrome_translation_app" --use-fake-ui-for-media-stream --app="http://localhost:8080/comment-viewer/admin.html"
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File server.ps1
pause
