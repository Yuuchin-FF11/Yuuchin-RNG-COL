@echo off
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8085" ^| findstr "LISTENING"') do taskkill /f /pid %%a 2>nul
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
start msedge.exe --lang=ja --autoplay-policy=no-user-gesture-required --app="http://localhost:8085/index.html" 2>nul || start http://localhost:8085/index.html
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File server.ps1
pause
