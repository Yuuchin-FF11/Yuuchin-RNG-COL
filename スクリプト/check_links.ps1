# FFXI Bismarck - Automated Link URL Validator (スクリプト/check_links.ps1)
# This script extracts all wiki.ffo.jp URLs from link_map.js and checks if they return 200 OK.
# UTF-8 Encoding safe (ASCII only to prevent Japanese encoding errors in Windows PowerShell).

$linkMapPath = Join-Path (Get-Location) "画像素材/js/link_map.js"
if (-not (Test-Path $linkMapPath)) {
    Write-Error "link_map.js not found at: $linkMapPath"
    exit 1
}

$content = Get-Content -Path $linkMapPath -Raw
# Extract all wiki.ffo.jp URLs
$matches = [regex]::Matches($content, 'https?://wiki\.ffo\.jp/html/\d+\.html')

$urls = @()
foreach ($m in $matches) {
    $url = $m.Value
    if ($urls -notcontains $url) {
        $urls += $url
    }
}

Write-Host "--------------------------------------------------------"
Write-Host "🔍 FFO Link Validator Starting (Total URLs to check: $($urls.Count))"
Write-Host "Checking each URL systematically with 200ms sleep..."
Write-Host "--------------------------------------------------------"

$failedCount = 0
$checkedCount = 0

foreach ($url in $urls) {
    $checkedCount++
    try {
        # Construct WebRequest
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.Method = "GET" # Using GET but closing stream immediately
        $req.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        $req.Timeout = 5000
        
        $res = $req.GetResponse()
        $statusCode = [int]$res.StatusCode
        $res.Close()
        
        if ($statusCode -eq 200) {
            # URL is valid
            # Write-Host "[OK] $url"
        } else {
            Write-Host "[FAIL] Status: $statusCode - URL: $url"
            $failedCount++
        }
    } catch {
        $ex = $_.Exception
        if ($ex -and $ex.Response) {
            $errStatus = [int]$ex.Response.StatusCode
            Write-Host "[FAIL] Status: $errStatus - URL: $url"
            $ex.Response.Close()
        } else {
            Write-Host "[ERROR] Connection failed: $url - $_"
        }
        $failedCount++
    }
    
    # Wait 200ms to be polite to the server
    Start-Sleep -Milliseconds 200
}

Write-Host "--------------------------------------------------------"
Write-Host "📊 Validation Summary: Checked $checkedCount URLs"
if ($failedCount -eq 0) {
    Write-Host "SUCCESS: All URLs are 100% valid and verified!"
    exit 0
} else {
    Write-Host "FAILURE: Detected $failedCount invalid/broken URLs!"
    exit 1
}
