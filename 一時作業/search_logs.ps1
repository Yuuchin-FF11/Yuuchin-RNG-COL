Write-Host "Current Location: $((Get-Location).Path)"
$searchDir = "C:\Users\user\.gemini\antigravity\brain"
$keywordsFile = "一時作業\search_keywords.txt"
if (-not (Test-Path $keywordsFile)) {
    Write-Error "Keywords file not found: $keywordsFile"
    exit 1
}

# Read keywords using UTF8 encoding to avoid corruption
$keywords = Get-Content -Path $keywordsFile -Encoding UTF8
Write-Host "Searching in $searchDir..."

# Find all transcript jsonl files
$files = Get-ChildItem -Path $searchDir -Recurse -Filter "*transcript*.jsonl"
foreach ($f in $files) {
    $filePath = $f.FullName
    # Skip if file is currently open/locked or not readable
    try {
        $lines = Get-Content -Path $filePath -Encoding UTF8 -ErrorAction Stop
    } catch {
        continue
    }

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        foreach ($kw in $keywords) {
            if ($line.Contains($kw)) {
                try {
                    $data = ConvertFrom-Json $line -ErrorAction Stop
                    $content = $data.content
                    $source = $data.source
                    if ($content.Contains($kw)) {
                        $uuid = Split-Path (Split-Path (Split-Path $filePath -Parent) -Parent) -Leaf
                        Write-Host "File: $uuid / $($f.Name) (Line $($i+1))"
                        Write-Host "Keyword: $kw"
                        $idx = $content.IndexOf($kw)
                        $start = [Math]::Max(0, $idx - 100)
                        $len = [Math]::Min(250, $content.Length - $start)
                        Write-Host "Snippet: ...$($content.Substring($start, $len))...."
                        Write-Host ("-" * 60)
                    }
                } catch {
                    # Fallback to raw match if json parse fails
                    $uuid = Split-Path (Split-Path (Split-Path $filePath -Parent) -Parent) -Leaf
                    Write-Host "File: $uuid / $($f.Name) (Line $($i+1)) [Raw Match]"
                    Write-Host "Keyword: $kw"
                    $len = [Math]::Min(150, $line.Length)
                    Write-Host "Snippet: ...$($line.Substring(0, $len))..."
                    Write-Host ("-" * 60)
                }
            }
        }
    }
}
