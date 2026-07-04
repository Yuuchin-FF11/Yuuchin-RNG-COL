$filePath = Join-Path $PSScriptRoot '..\fact_monitor.ps1'
$content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
# LF only -> CRLF
$content = $content.Replace("`r`n", "`n").Replace("`n", "`r`n")
[System.IO.File]::WriteAllText($filePath, $content, (New-Object System.Text.UTF8Encoding $true))
Write-Host "Converted to CRLF with UTF-8 BOM."

# Re-check parse
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($filePath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -gt 0) {
    Write-Host "Parse errors found: $($parseErrors.Count)"
    foreach ($err in $parseErrors) {
        Write-Host "  Line $($err.Extent.StartLineNumber): $($err.Message)"
    }
} else {
    Write-Host "No syntax errors found!"
}
