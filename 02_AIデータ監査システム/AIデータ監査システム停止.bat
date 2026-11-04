@echo off
chcp 65001 > nul
echo AIデータ監査システム (ポート8000) を停止しています...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a > nul 2>&1
)
echo 停止が完了しました。
timeout /t 2 > nul
