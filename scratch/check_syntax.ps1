$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    (Join-Path $PSScriptRoot '..\fact_monitor.ps1'),
    [ref]$tokens,
    [ref]$parseErrors
)

if ($parseErrors.Count -gt 0) {
    Write-Host "Parse errors found: $($parseErrors.Count)"
    foreach ($err in $parseErrors) {
        Write-Host "  Line $($err.Extent.StartLineNumber): $($err.Message)"
    }
} else {
    Write-Host "No syntax errors found."
}
