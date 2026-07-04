$filePath = Join-Path $PSScriptRoot '..\fact_monitor.ps1'
$bytes = [System.IO.File]::ReadAllBytes($filePath)
Write-Host "First 4 bytes (hex): $($bytes[0].ToString('X2')) $($bytes[1].ToString('X2')) $($bytes[2].ToString('X2')) $($bytes[3].ToString('X2'))"
Write-Host "Total bytes: $($bytes.Length)"

# Check for BOM
if ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Write-Host "Encoding: UTF-8 with BOM"
} elseif ($bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
    Write-Host "Encoding: UTF-16 LE (Little Endian)"
} elseif ($bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
    Write-Host "Encoding: UTF-16 BE (Big Endian)"
} else {
    Write-Host "Encoding: UTF-8 without BOM (or other)"
}

# Also look for any lines with issues around try/catch
$content = Get-Content $filePath -Encoding UTF8
Write-Host "Line count: $($content.Count)"
Write-Host "Line 6: [$($content[5])]"
Write-Host "Line 7: [$($content[6])]"
Write-Host "Line 8: [$($content[7])]"

# Check for hidden characters
$rawContent = [System.IO.File]::ReadAllText($filePath)
$lineEnding = if ($rawContent.Contains("`r`n")) { "CRLF" } elseif ($rawContent.Contains("`n")) { "LF" } else { "Unknown" }
Write-Host "Line ending: $lineEnding"
