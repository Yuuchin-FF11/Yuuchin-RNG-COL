@echo off
chcp 65001 >nul
title ローカルAI翻訳 プロトタイプ検証サーバー

echo ========================================================
echo   ローカルAI翻訳 プロトタイプ検証環境を起動しています...
echo   (Helsinki-NLP / Transformers.js / ONNX)
echo ========================================================
echo.

:: 既存のポート8090プロセスがあれば停止
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8090" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: PowerShell簡易Webサーバーをポート8090でバックグラウンド起動
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -Command "$listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://localhost:8090/'); $listener.Start(); while ($listener.IsListening) { $context = $listener.GetContext(); $req = $context.Request; $res = $context.Response; $path = $req.Url.LocalPath.TrimStart('/'); if ([string]::IsNullOrEmpty($path)) { $path = 'index.html' }; $filePath = Join-Path '%~dp0' $path; if (Test-Path $filePath -PathType Leaf) { $bytes = [System.IO.File]::ReadAllBytes($filePath); $ext = [System.IO.Path]::GetExtension($filePath).ToLower(); switch ($ext) { '.html' { $res.ContentType = 'text/html; charset=utf-8' } '.css' { $res.ContentType = 'text/css; charset=utf-8' } '.js' { $res.ContentType = 'application/javascript; charset=utf-8' } default { $res.ContentType = 'application/octet-stream' } } $res.ContentLength64 = $bytes.Length; $res.OutputStream.Write($bytes, 0, $bytes.Length); } else { $res.StatusCode = 404; $err = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found'); $res.OutputStream.Write($err, 0, $err.Length); } $res.OutputStream.Close(); }"

timeout /t 1 >nul

:: Edgeをアプリモードで起動（セキュリティを解除せずに通常の安全なブラウザ環境で起動可能）
start msedge --app="http://localhost:8090/index.html"

echo.
echo 検証画面がブラウザで起動しました。
echo このウィンドウを閉じると検証サーバーが終了します。
pause
