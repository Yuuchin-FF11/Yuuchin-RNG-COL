@echo off
title AutoPost30 Launcher

cd /d "%~dp0"

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Python found. Starting local server...
    python server.py
) else (
    echo Python not found. Opening browser directly...
    start "" "index.html"
)

pause