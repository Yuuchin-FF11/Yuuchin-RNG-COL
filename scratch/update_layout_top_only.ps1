# 1. index.html の一番上の項目をピンポイントで頑健に置換 (ASCII文字のみで全角日本語を一切排除)
if (Test-Path "index.html") {
    $content = [System.IO.File]::ReadAllText((Resolve-Path "index.html"), [System.Text.Encoding]::UTF8)
    
    $pattern = '(?s)(<li style="[^"]*display:\s*flex;\s*flex-wrap:\s*wrap;[^"]*">\s*<span style="[^"]*min-width:\s*100px;[^"]*">2026.06.01</span>\s*<a href="article.html\?file=articles/limit_break_guide.md"[^>]*>.*?</a><span class="new-badge">New</span>\s*</li>)'
    
    $m = [regex]::Match($content, $pattern)
    if ($m.Success) {
        $originalLi = $m.Value
        
        $spanStartIdx = $originalLi.IndexOf("<span")
        $spanEndIdx = $originalLi.IndexOf("</span>")
        $liEndIdx = $originalLi.IndexOf("</li>")
        
        $liTag = $originalLi.Substring(0, $spanStartIdx).Trim()
        $liTag = $liTag.Replace("flex-wrap: wrap;", "align-items: flex-start;")
        
        $spanTag = $originalLi.Substring($spanStartIdx, $spanEndIdx + 7 - $spanStartIdx).Trim()
        $spanTag = $spanTag.Replace("min-width: 100px;", "min-width: 100px; flex-shrink: 0;")
        
        $aContent = $originalLi.Substring($spanEndIdx + 7, $liEndIdx - ($spanEndIdx + 7)).Trim()
        
        $newLi = "                        " + $liTag + "`r`n" +
                 "                            " + $spanTag + "`r`n" +
                 "                            <div style=`"flex: 1;`">`r`n" +
                 "                                " + $aContent + "`r`n" +
                 "                            </div>`r`n" +
                 "                        </li>"
                 
        $content = $content.Replace($originalLi, $newLi)
        [System.IO.File]::WriteAllText((Resolve-Path "index.html"), $content, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "Successfully upgraded top-most update layout in index.html!" -ForegroundColor Green
    } else {
        Write-Host "Top-most entry in index.html already processed or not found." -ForegroundColor Yellow
    }
}

# 2. index_en.html の一番上の項目をピンポイントで頑健に置換 (ASCII文字のみ)
if (Test-Path "index_en.html") {
    $content = [System.IO.File]::ReadAllText((Resolve-Path "index_en.html"), [System.Text.Encoding]::UTF8)
    
    $pattern = '(?s)(<li style="[^"]*display:\s*flex;\s*flex-wrap:\s*wrap;[^"]*">\s*<span style="[^"]*min-width:\s*100px;[^"]*">2026.06.01</span>\s*<a href="article_en.html\?file=articles/limit_break_guide.md"[^>]*>.*?</a><span class="new-badge">New</span>\s*</li>)'
    
    $m = [regex]::Match($content, $pattern)
    if ($m.Success) {
        $originalLi = $m.Value
        
        $spanStartIdx = $originalLi.IndexOf("<span")
        $spanEndIdx = $originalLi.IndexOf("</span>")
        $liEndIdx = $originalLi.IndexOf("</li>")
        
        $liTag = $originalLi.Substring(0, $spanStartIdx).Trim()
        $liTag = $liTag.Replace("flex-wrap: wrap;", "align-items: flex-start;")
        
        $spanTag = $originalLi.Substring($spanStartIdx, $spanEndIdx + 7 - $spanStartIdx).Trim()
        $spanTag = $spanTag.Replace("min-width: 100px;", "min-width: 100px; flex-shrink: 0;")
        
        $aContent = $originalLi.Substring($spanEndIdx + 7, $liEndIdx - ($spanEndIdx + 7)).Trim()
        
        $newLi = "                        " + $liTag + "`r`n" +
                 "                            " + $spanTag + "`r`n" +
                 "                            <div style=`"flex: 1;`">`r`n" +
                 "                                " + $aContent + "`r`n" +
                 "                            </div>`r`n" +
                 "                        </li>"
                 
        $content = $content.Replace($originalLi, $newLi)
        [System.IO.File]::WriteAllText((Resolve-Path "index_en.html"), $content, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "Successfully upgraded top-most update layout in index_en.html!" -ForegroundColor Green
    } else {
        Write-Host "Top-most entry in index_en.html already processed or not found." -ForegroundColor Yellow
    }
}
