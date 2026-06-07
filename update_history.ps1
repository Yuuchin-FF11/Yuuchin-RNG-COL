param (
    [string]$File,
    [string]$MsgJa,
    [string]$MsgEn
)

# 1. If MsgJa is empty, start interactive mode in English (safe ASCII only)
if (-not $MsgJa) {
    Write-Host "--- FFXI Bismarck HP Update History Auto-Updater ---" -ForegroundColor Cyan
    $File = Read-Host "1. Article file path (e.g., 記事/hunter_gastraphetes.md / Press Enter to skip)"
    $MsgJa = Read-Host "2. Update Message (Japanese - Required)"
    $MsgEn = Read-Host "3. Update Message (English - Press Enter to copy Japanese)"
    
    if (-not $MsgJa) {
        Write-Error "Error: Japanese update message is required."
        exit 1
    }
}

if (-not $MsgEn) {
    $MsgEn = $MsgJa
}

# 2. Update function
function Update-HistoryHtml {
    param (
        [string]$Path,
        [string]$TargetFile,
        [string]$Message,
        [bool]$IsEn
    )

    if (-not (Test-Path $Path)) {
        Write-Error "Error: $Path not found."
        return $false
    }

    # Read UTF-8 safely
    $content = [System.IO.File]::ReadAllText((Resolve-Path $Path), [System.Text.Encoding]::UTF8)

    # 2.1 Remove existing New badges
    $content = $content.Replace('<span class="new-badge">New</span>', '')

    # 2.2 Get today's date in YYYY.MM.DD
    $todayStr = (Get-Date).ToString("yyyy.MM.dd")

    # 2.3 Construct <li> element
    $articleLink = if ($IsEn) { "article_en.html" } else { "article.html" }
    
    $liElement = if ($TargetFile) {
        @"
                        <li style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: flex-start;">
                            <span style="color: var(--accent-color); font-weight: bold; margin-right: 1rem; min-width: 100px; flex-shrink: 0;">$todayStr</span>
                            <div style="flex: 1;">
                                <a href="$articleLink`?file=$TargetFile" style="color: inherit; text-decoration: none; transition: color 0.3s;" onmouseover="this.style.color='var(--accent-color)'" onmouseout="this.style.color='inherit'">$Message</a><span class="new-badge">New</span>
                            </div>
                        </li>
"@
    } else {
        @"
                        <li style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: flex-start;">
                            <span style="color: var(--accent-color); font-weight: bold; margin-right: 1rem; min-width: 100px; flex-shrink: 0;">$todayStr</span>
                            <div style="flex: 1;">
                                <span>$Message</span><span class="new-badge">New</span>
                            </div>
                        </li>
"@
    }

    # 2.4 Insert right below the What's New <ul> tag
    $ulPattern = '(<ul(?:\s+id="whats-new-list")?\s+style="list-style:\s*none;\s*padding:\s*1rem\s*0\.5rem;\s*margin:\s*0;">)'
    
    if ($content -match $ulPattern) {
        $replacement = "`$1`n$liElement"
        $regex = [regex]$ulPattern
        $content = $regex.Replace($content, $replacement, 1)
        
        # Clean redundant empty lines
        $content = [regex]::Replace($content, '(\r?\n\s*){3,}', "`r`n`r`n")
        
        # Write back UTF-8 (Without BOM)
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText((Resolve-Path $Path), $content, $utf8NoBom)
        
        Write-Host "Successfully updated $Path!" -ForegroundColor Green
        return $true
    } else {
        Write-Error "Error: What's New <ul> tag not found in $Path."
        return $false
    }
}

# 3. Update both Japanese and English indexes
Update-HistoryHtml -Path "index.html" -TargetFile $File -Message $MsgJa -IsEn $false
Update-HistoryHtml -Path "index_en.html" -TargetFile $File -Message $MsgEn -IsEn $true

Write-Host "Done: What's New section updated successfully!" -ForegroundColor Green
