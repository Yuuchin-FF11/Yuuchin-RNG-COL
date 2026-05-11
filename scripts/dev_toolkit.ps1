function Check-HtmlTags($filePath) {
    Write-Host "Checking HTML: $filePath..." -ForegroundColor Cyan
    if (-not (Test-Path $filePath)) {
        Write-Error "File not found: $filePath"
        return $false
    }
    $content = Get-Content $filePath -Raw
    
    # 1. Remove comments
    $content = [regex]::Replace($content, "(?s)<!--.*?-->", "")
    
    # 2. Extract only valid HTML tags, but skip script/style content
    # We do this by replacing <script>...</script> with a placeholder that has no internal < >
    $content = [regex]::Replace($content, "(?s)<script.*?>.*?</script>", "<!--S-->")
    $content = [regex]::Replace($content, "(?s)<style.*?>.*?</style>", "<!--T-->")

    $stack = New-Object System.Collections.Generic.Stack[string]
    $selfClosing = @('area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype')
    
    # Match all tags
    $matches = [regex]::Matches($content, "<([a-zA-Z0-9]+)[^>]*>|<\/([a-zA-Z0-9]+)>")
    $errors = 0

    foreach ($m in $matches) {
        if ($m.Value.StartsWith("</")) {
            $tagName = $m.Groups[2].Value.ToLower()
            if ($selfClosing -contains $tagName) { continue }
            
            if ($stack.Count -eq 0) {
                Write-Host "X Unexpected closing tag </$tagName> near index $($m.Index)" -ForegroundColor Red
                $errors++
            } else {
                $lastTag = $stack.Pop()
                if ($lastTag -ne $tagName) {
                    Write-Host "X Mismatched tag: expected </$lastTag>, but found </$tagName> near index $($m.Index)" -ForegroundColor Red
                    $errors++
                }
            }
        } else {
            $tagName = $m.Groups[1].Value.ToLower()
            if ($selfClosing -contains $tagName) { continue }
            $stack.Push($tagName)
        }
    }

    while ($stack.Count -gt 0) {
        Write-Host "X Unclosed tag <$($stack.Pop())>" -ForegroundColor Red
        $errors++
    }

    if ($errors -eq 0) {
        Write-Host "✓ $filePath is clean!" -ForegroundColor Green
        return $true
    }
    return $false
}

function Check-MdLinks($dir) {
    Write-Host "Checking Markdown links in $dir..." -ForegroundColor Cyan
    if (-not (Test-Path $dir)) {
        Write-Error "Directory not found: $dir"
        return $false
    }
    $files = Get-ChildItem -Path $dir -Filter *.md
    $errors = 0

    foreach ($file in $files) {
        $content = Get-Content $file.FullName -Raw
        $matches = [regex]::Matches($content, 'article\.html\?file=([^)\"''\s>]+)')
        foreach ($m in $matches) {
            $link = $m.Groups[1].Value.Split('#')[0]
            $targetPath = Join-Path (Get-Location) $link
            if (-not (Test-Path $targetPath)) {
                Write-Host "X Broken link in $($file.Name): $link (file not found)" -ForegroundColor Red
                $errors++
            }
        }
    }

    if ($errors -eq 0) {
        Write-Host "✓ All internal links are valid!" -ForegroundColor Green
        return $true
    }
    return $false
}

$cmd = $args[0]
if ($cmd -eq "html") {
    $ok1 = Check-HtmlTags "index.html"
    $ok2 = Check-HtmlTags "article.html"
    if (-not ($ok1 -and $ok2)) { exit 1 }
} elseif ($cmd -eq "links") {
    $ok = Check-MdLinks "articles"
    if (-not $ok) { exit 1 }
} else {
    Write-Host "Usage: .\dev_toolkit.ps1 [html|links]"
}
