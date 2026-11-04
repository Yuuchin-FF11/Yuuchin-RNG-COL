@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo ===================================================
echo   YouTube 部分ダウンロードお給仕ツール 🐾
echo ===================================================
echo.

rem ツールの存在チェックと自動ダウンロード
if not exist "yt-dlp.exe" (
    echo [お給仕] yt-dlp.exe が見つかりません。自動ダウンロードを開始します...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile 'yt-dlp.exe'"
    if exist "yt-dlp.exe" (
        echo [お給仕] yt-dlp.exe のダウンロードが完了いたしました！
    ) else (
        echo [警告] yt-dlp.exe のダウンロードに失敗いたしました。
        pause
        exit /b
    )
)

if not exist "ffmpeg.exe" (
    echo [お給仕] ffmpeg.exe が見つかりません。自動ダウンロードを開始します（約50MB）...
    echo ※少しお時間がかかる場合がございます。少々お待ちくださいませ🐾
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip' -OutFile 'ffmpeg.zip'"
    if exist "ffmpeg.zip" (
        echo [お給仕] ファイルを解凍して配置しております...
        powershell -Command "Expand-Archive -Path 'ffmpeg.zip' -DestinationPath 'ffmpeg_temp' -Force; Get-ChildItem 'ffmpeg_temp' -Recurse -Filter 'ffmpeg.exe' | Move-Item -Destination '.' -Force; Get-ChildItem 'ffmpeg_temp' -Recurse -Filter 'ffprobe.exe' | Move-Item -Destination '.' -Force; Remove-Item 'ffmpeg_temp' -Recurse -Force; Remove-Item 'ffmpeg.zip' -Force"
        echo [お給仕] ffmpeg の配置が完了いたしました！
    ) else (
        echo [警告] ffmpeg のダウンロードに失敗いたしました。
        pause
        exit /b
    )
)

echo.
echo ===================================================
echo [お給仕] 準備が完了いたしました！
echo ダウンロードしたい情報を入力してください。
echo ===================================================
echo.

set /p URL="◆ YouTube動画のURLを入力してください: "
set /p START_TIME="◆ 開始時間を入力してください (例 01:23:45 または 45:30): "
set /p END_TIME="◆ 終了時間を入力してください (例 02:10:15 または 55:00): "
set /p OUT_NAME="◆ 保存するファイル名を入力してください (例 切り抜き1): "

echo.
echo [お給仕] ダウンロード処理を開始いたします。少々お待ちくださいませ🐾
echo.

rem 部分ダウンロード実行コマンド
yt-dlp -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]" --download-sections "*%START_TIME%-%END_TIME%" --force-keyframes-at-cuts "%URL%" -o "%OUT_NAME%.mp4"

if %ERRORLEVEL% equ 0 (
    echo.
    echo ===================================================
    echo [お給仕] ダウンロードが完了いたしました！
    echo 保存ファイル: %OUT_NAME%.mp4
    echo ===================================================
    explorer.exe /select,"%OUT_NAME%.mp4"
) else (
    echo.
    echo [警告] ダウンロード中にエラーが発生いたしました。
    echo 入力されたURLや時間指定（開始・終了時間）が正しいかご確認ください。
)

echo.
pause
