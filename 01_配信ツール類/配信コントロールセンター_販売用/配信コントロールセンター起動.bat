@echo off
title Control Center Launcher

:: Change directory to where this batch file is located
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

echo ===================================================
echo   Starting Control Center...
echo ===================================================

:: Clean up old server processes on port 8085 to prevent conflicts
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 8085 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

:: Launch browser in secure standard mode (Local Reverse Proxy eliminates the need for security disabling)
echo Launching browser...
start msedge.exe --lang=ja --autoplay-policy=no-user-gesture-required --app="http://localhost:8085/index.html" 2>nul || start http://localhost:8085/index.html

:: Run local web server
echo Launching server...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File server.ps1

echo.
echo   Server stopped.
pause
