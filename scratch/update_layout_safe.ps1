function Fix-UpdatesHtmlSafe {
    param ([string]$Path)
    if (-not (Test-Path $Path)) {
        Write-Host "Error: $Path not found." -ForegroundColor Red
        return
    }
    
    $content = [System.IO.File]::ReadAllText((Resolve-Path $Path), [System.Text.Encoding]::UTF8)
    
    # 1. flex-wrap: wrap を align-items: flex-start に正規表現置換
    $content = $content -replace 'display:\s*flex;\s*flex-wrap:\s*wrap;', 'display: flex; align-items: flex-start;'
    
    # 2. 日付 span に flex-shrink: 0; を正規表現置換
    $content = $content -replace 'min-width:\s*100px;', 'min-width: 100px; flex-shrink: 0;'
    
    # 3. リンクやテキストを <div style="flex: 1;"> で包む (エスケープされたキャプチャグループ置換)
    # `$1` や `$2` などの `$` をバッククォートでエスケープすることで、PowerShell の変数展開を防ぎ、
    # かつ .NET Regex エンジンには `$1` としてそのまま渡して完璧に置換します。
    $pattern = '(?s)<li style="([^"]*display:\s*flex;\s*align-items:\s*flex-start;[^"]*)">\s*<span style="([^"]*flex-shrink:\s*0;[^"]*)">(.*?)</span>\s*(.*?)\s*</li>'
    
    $replacement = "                        <li style=`"`$1`">`r`n                            <span style=`"`$2`">`$3</span>`r`n                            <div style=`"flex: 1;`">`r`n                                `$4`r`n                            </div>`r`n                        </li>"
    
    $content = $content -replace $pattern, $replacement
    
    # 2重 div を防ぐクリーンアップ
    $content = $content -replace '(?s)<div style="flex:\s*1;">\s*<div style="flex:\s*1;">\s*(.*?)\s*</div>\s*</div>', '<div style="flex: 1;">`r`n                                `$1`r`n                            </div>'
    
    [System.IO.File]::WriteAllText((Resolve-Path $Path), $content, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Successfully upgraded updates layout in $Path!" -ForegroundColor Green
}

Fix-UpdatesHtmlSafe -Path "index.html"
Fix-UpdatesHtmlSafe -Path "index_en.html"
