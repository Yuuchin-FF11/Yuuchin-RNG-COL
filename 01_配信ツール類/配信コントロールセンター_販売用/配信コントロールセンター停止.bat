@echo off
title Control Center Stopper

echo ===================================================
echo   Stopping Control Center...
echo ===================================================

:: Stop processes listening on port 8085 using PowerShell for safety
powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 8085 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo   Server stopped successfully.
echo ===================================================
timeout /t 3
