@echo off
chcp 65001 > nul
echo ファクト・スキャナー (ポート8080) を停止しています...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a > nul 2>&1
)
echo 停止が完了しました。
timeout /t 2 > nul
