$targetExtensions = @("*.md", "*.html", "*.js", "*.css")
$directory = "."

Get-ChildItem -Path $directory -Recurse -Include $targetExtensions | ForEach-Object {
    $file = $_.FullName
    if ($file -match "\\\.git" -or $file -match "\\\.vscode" -or $file -match "\\\.agent") {
        return
    }
    
    try {
        # Read as UTF-8
        $content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
        
        if ($content -match "※※") {
            Write-Host "FOUND ※※ in: $file"
            $lines = $content -split "`r`n"
            if ($lines.Length -eq 1) { $lines = $content -split "`n" }
            for ($i=0; $i -lt $lines.Length; $i++) {
                if ($lines[$i] -match "※※") {
                    Write-Host "  Line $($i+1): $($lines[$i])"
                }
            }
        }
        
        if ($content -match "※[^※\r\n]+※") {
            Write-Host "FOUND wrapped ※ in: $file"
            $lines = $content -split "`r`n"
            if ($lines.Length -eq 1) { $lines = $content -split "`n" }
            for ($i=0; $i -lt $lines.Length; $i++) {
                if ($lines[$i] -match "※[^※\r\n]+※") {
                    Write-Host "  Line $($i+1): $($lines[$i])"
                }
            }
        }
    } catch {
        # Ignore errors
    }
}
