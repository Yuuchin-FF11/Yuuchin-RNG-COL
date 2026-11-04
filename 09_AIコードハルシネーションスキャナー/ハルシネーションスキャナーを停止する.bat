@echo off
chcp 65001 > nul
echo AIコードハルシネーションスキャナー (ポート8081) を停止しています...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8081" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a > nul 2>&1
)
taskkill /f /im "AIハルシネーションスキャナー.exe" > nul 2>&1
echo 停止が完了しました。
timeout /t 2 > nul
