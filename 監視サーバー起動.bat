@echo off
title ファクト・スキャナー 監視サーバー

echo ===================================================
echo   ファクト・スキャナー 自動監視サーバーを起動します...
echo ===================================================
echo.

:: ポート8080の重複プロセス強制終了
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080 ^| findstr LISTENING') do (
    taskkill /f /pid %%a > nul 2>&1
)

:: Pythonの実行パスを自動検出
set PYTHON_CMD=python
where python > nul 2>&1
if %errorlevel% equ 0 goto :start_server

:: AppData内の標準パスを探索
for /d %%d in ("%USERPROFILE%\AppData\Local\Programs\Python\Python*") do (
    if exist "%%d\python.exe" (
        set PYTHON_CMD="%%d\python.exe"
        goto :start_server
    )
)

:: その他の標準パスを探索
if exist "C:\Python310\python.exe" (
    set PYTHON_CMD="C:\Python310\python.exe"
    goto :start_server
)
if exist "C:\Python39\python.exe" (
    set PYTHON_CMD="C:\Python39\python.exe"
    goto :start_server
)

echo 【警告】環境変数 PATH に Python が見つかりません。
echo 通常の python コマンドでの起動を試みますが、起動しない場合は
echo Python 3 をインストールし、環境変数 PATH に追加してください。
echo.

:start_server
:: Pythonサーバーを起動
start "" %PYTHON_CMD% fact_monitor.py

:: 起動待機
timeout /t 2 /nobreak > nul

:: ブラウザで開く
start http://localhost:8080/

echo.
echo ---------------------------------------------------
echo   自動監視サーバーが起動しました。
echo   このウィンドウを閉じると、自動監視が停止します。
echo ---------------------------------------------------
pause
