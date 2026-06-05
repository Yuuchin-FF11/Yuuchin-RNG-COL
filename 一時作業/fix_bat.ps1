$folder = [string][char]0x30B3 + [char]0x30E1 + [char]0x30D3 + [char]0x30E5 + [char]0x7248 + [char]0x304A + [char]0x7D66 + [char]0x4ED5 + [char]0x7FFB + [char]0x8A33
$adminJp = [string][char]0x7BA1 + [char]0x7406 + [char]0x753B + [char]0x9762 + ".html"
$overlayJp = [string][char]0x30AA + [char]0x30FC + [char]0x30D0 + [char]0x30FC + [char]0x30EC + [char]0x30A4 + ".html"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$parentDir = Split-Path -Parent $scriptDir

# 1. Create Junction for English path mapping
$junctionPath = Join-Path $parentDir "comment-viewer"
if (-not (Test-Path $junctionPath)) {
    $targetPath = Join-Path $parentDir $folder
    cmd.exe /c "mklink /j `"$junctionPath`" `"$targetPath`""
}

# 2. Copy files to English names for compatibility
$adminJpPath = Join-Path $parentDir (Join-Path $folder $adminJp)
$adminEnPath = Join-Path $parentDir (Join-Path $folder "admin.html")
if (Test-Path $adminJpPath) {
    Copy-Item -Path $adminJpPath -Destination $adminEnPath -Force
}

$overlayJpPath = Join-Path $parentDir (Join-Path $folder $overlayJp)
$overlayEnPath = Join-Path $parentDir (Join-Path $folder "overlay.html")
if (Test-Path $overlayJpPath) {
    Copy-Item -Path $overlayJpPath -Destination $overlayEnPath -Force
}

# 3. Write ASCII-only batch file
$bat = [string][char]0x30B3 + [char]0x30E1 + [char]0x30D3 + [char]0x30E5 + [char]0x7248 + [char]0x304A + [char]0x7D66 + [char]0x4ED5 + [char]0x8D77 + [char]0x52D5 + ".bat"
$batPath = Join-Path $parentDir (Join-Path $folder $bat)

$content = @(
    '@echo off',
    'cd /d "%~dp0.."',
    'start msedge.exe --disable-web-security --disable-site-isolation-trials --user-data-dir="%temp%\edge_translation_app" --use-fake-ui-for-media-stream "http://localhost:8080/comment-viewer/admin.html"',
    'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File server.ps1',
    'pause'
)

[System.IO.File]::WriteAllLines($batPath, $content, [System.Text.Encoding]::GetEncoding("shift-jis"))
