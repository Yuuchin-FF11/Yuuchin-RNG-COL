function Fix-UpdatesHtml {
    param ([string]$Path)
    if (-not (Test-Path $Path)) {
        Write-Host "Error: $Path not found." -ForegroundColor Red
        return
    }
    
    $content = [System.IO.File]::ReadAllText((Resolve-Path $Path), [System.Text.Encoding]::UTF8)
    
    # 1. li の開始タグを flex-wrap: wrap から align-items: flex-start へ直接文字列置換
    $content = $content.Replace("display: flex; flex-wrap: wrap;", "display: flex; align-items: flex-start;")
    
    # 2. 日付 span に flex-shrink: 0; を直接文字列置換
    $content = $content.Replace("min-width: 100px;`"", "min-width: 100px; flex-shrink: 0;`"")
    $content = $content.Replace("min-width: 100px;`">", "min-width: 100px; flex-shrink: 0;`">")
    
    # 3. リンクやテキストを <div style="flex: 1;"> で包む (デリゲート不要なキャプチャグループ置換)
    # パターン説明:
    # $1: li の style 属性の内部
    # $2: span の style 属性の内部
    # $3: 日付テキスト
    # $4: aタグやテキストなどの更新メッセージ本体
    $pattern = '(?s)<li style="([^"]*display:\s*flex;\s*align-items:\s*flex-start;[^"]*)">\s*<span style="([^"]*flex-shrink:\s*0;[^"]*)">(.*?)</span>\s*(.*?)\s*</li>'
    
    # すでに div style="flex: 1;" で包まれている場合は何もしないように、個別置換
    # (今回は clean state から実行するので一括置換で問題ありません)
    $replacement = '                        <li style="$1">`r`n                            <span style="$2">$3</span>`r`n                            <div style="flex: 1;">`r`n                                $4`r`n                            </div>`r`n                        </li>'
    
    $content = $content -replace $pattern, $replacement
    
    # 4. 万が一 div style="flex: 1;" が2重に包まれてしまった場合の正規化
    # (2重 div を 1重にするクリーンアップ)
    $content = $content -replace '(?s)<div style="flex:\s*1;">\s*<div style="flex:\s*1;">\s*(.*?)\s*</div>\s*</div>', '<div style="flex: 1;">`r`n                                $1`r`n                            </div>'
    
    [System.IO.File]::WriteAllText((Resolve-Path $Path), $content, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Successfully upgraded updates layout in $Path!" -ForegroundColor Green
}

Fix-UpdatesHtml -Path "index.html"
Fix-UpdatesHtml -Path "index_en.html"
