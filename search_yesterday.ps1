$utf8 = [System.Text.Encoding]::UTF8
$searchDir = "C:\Users\user\.gemini\antigravity\brain"
$outFile = "search_yesterday_results.txt"

# UTF-8 byte arrays for Japanese keywords to avoid encoding issues in PowerShell
$kwBikkuri = $utf8.GetString([byte[]](227, 131, 147, 227, 130, 183, 227, 131, 133, 227, 131, 170)) # ビックリ
$kwKen = $utf8.GetString([byte[]](229, 137, 163)) # 剣
$kwAka = $utf8.GetString([byte[]](232, 181, 164)) # 赤
$kwSeigen = $utf8.GetString([byte[]](229, 136, 182, 233, 153, 144)) # 制限
$kwReset = $utf8.GetString([byte[]](227, 131, 170, 227, 130, 187, 227, 130, 162, 227, 131, 136)) # リセット
$kwAkama = $utf8.GetString([byte[]](232, 181, 164, 233, 173, 148)) # 赤魔
$kwKnight = $utf8.GetString([byte[]](227, 131, 138, 227, 130, 164, 227, 131, 136)) # ナイト

$keywords = @($kwBikkuri, $kwKen, $kwAka, $kwSeigen, $kwReset, $kwAkama, $kwKnight, "bikkuriman", "Bikkuriman", "sword", "red")

Write-Host "Searching..."
$results = [System.Collections.Generic.List[string]]::new()

$files = Get-ChildItem -Path $searchDir -Recurse -Filter "*transcript*.jsonl"
foreach ($f in $files) {
    # Only check files modified in the last 3 days
    if ($f.LastWriteTime -lt (Get-Date).AddDays(-3)) {
        continue
    }

    $filePath = $f.FullName
    try {
        # Read as Raw bytes or UTF8 to prevent corruption
        $lines = [System.IO.File]::ReadAllLines($filePath, $utf8)
    } catch {
        continue
    }

    $uuid = Split-Path (Split-Path (Split-Path $filePath -Parent) -Parent) -Leaf
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        foreach ($kw in $keywords) {
            if ($line.Contains($kw)) {
                try {
                    $data = ConvertFrom-Json $line -ErrorAction Stop
                    $content = $data.content
                    $source = $data.source
                    if ($content.Contains($kw)) {
                        $idx = $content.IndexOf($kw)
                        $start = [Math]::Max(0, $idx - 80)
                        $len = [Math]::Min(200, $content.Length - $start)
                        $snippet = $content.Substring($start, $len).Replace("`n", " ").Replace("`r", " ")
                        $matchStr = "File: $uuid / $($f.Name) (Line $($i+1)) [Source: $source]`r`nKeyword: $kw`r`nSnippet: ...$snippet...`r`n" + ("=" * 80)
                        $results.Add($matchStr)
                    }
                } catch {
                    $len = [Math]::Min(150, $line.Length)
                    $snippet = $line.Substring(0, $len).Replace("`n", " ").Replace("`r", " ")
                    $matchStr = "File: $uuid / $($f.Name) (Line $($i+1)) [Raw Match]`r`nKeyword: $kw`r`nSnippet: ...$snippet...`r`n" + ("=" * 80)
                    $results.Add($matchStr)
                }
                break # Avoid duplicate hits for same line
            }
        }
    }
}

[System.IO.File]::WriteAllLines($outFile, $results, $utf8)
Write-Host "Done! Saved to $outFile"
