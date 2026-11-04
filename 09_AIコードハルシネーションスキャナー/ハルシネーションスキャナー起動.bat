@echo off
chcp 65001 > nul
title AIコードハルシネーションスキャナー

echo ====================================================
echo   AIコードハルシネーションスキャナー 起動中...
echo ====================================================

:: 既存のポート8081使用プロセスを終了
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8081" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a > nul 2>&1
)

:: EXEが存在する場合はEXEを起動、無ければPythonを起動
if exist "%~dp0AIハルシネーションスキャナー.exe" (
    start "" "%~dp0AIハルシネーションスキャナー.exe"
) else (
    start "" /b python "%~dp0hallucination_monitor.py"
)

:: 起動待機
timeout /t 1 /nobreak > nul

:: ブラウザでUI画面を開く
start "" "%~dp0AIハルシネーションスキャナー起動.html"

echo.
echo サーバーが起動しました (http://localhost:8081)
echo 終了する場合は「ハルシネーションスキャナーを停止する.bat」を実行してください。
echo.
pause
