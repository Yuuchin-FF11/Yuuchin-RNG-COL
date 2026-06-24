$sourceFile = "C:\Users\user\.gemini\antigravity\brain\fe80634e-ff74-4cac-8f4f-a7762c479d76\.system_generated\logs\transcript.jsonl"
$targetFile = "scratch\decoded.txt"

$txt = [System.IO.File]::ReadAllText($sourceFile, [System.Text.Encoding]::UTF8)
$lines = $txt -split "`n"
$output = @()

foreach ($line in $lines) {
    if ($line -like '*"type":"USER_INPUT"*') {
        try {
            $json = ConvertFrom-Json $line
            $output += "=== USER INPUT ==="
            $output += $json.content
            $output += ""
        } catch {
            $output += "=== USER INPUT (Parse Error) ==="
            # Just output the line to see
            $output += $line
            $output += ""
        }
    }
}

[System.IO.File]::WriteAllLines($targetFile, $output, [System.Text.Encoding]::UTF8)
Write-Output "Done"
