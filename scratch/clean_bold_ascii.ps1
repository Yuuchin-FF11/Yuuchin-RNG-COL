$filePath = "articles/sortie_corsair_aminon.md"
if (-not (Test-Path $filePath)) {
    Write-Host "Error: File not found at $filePath"
    exit 1
}

$content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)

$leftQuote = [char]0x300C
$rightQuote = [char]0x300D

# 1. Table cell bold removal
$content = $content -replace '\|\s*\*\*([^*|]+)\*\*\s*\|', '| $1 |'
$content = $content -replace '\|\s*\*\*([^*|]+)\*\*\s*', '| $1 '
$content = $content -replace '\s*\*\*([^*|]+)\*\*\s*\|', ' $1 |'

# 2. List item header bold removal
$content = $content -replace '(?m)^(\s*)\*\s+\*\*([^*:\s]+)\*\*:', '$1*   $2:'

# 3. Bold nested with quotes
$content = $content -replace "\*\*${leftQuote}([^${rightQuote}]+)${rightQuote}\*\*", "${leftQuote}`$1${rightQuote}"
$content = $content -replace "${leftQuote}([^${rightQuote}]+)${rightQuote}\*\*", "${leftQuote}`$1${rightQuote}"
$content = $content -replace "\*\*${leftQuote}([^${rightQuote}]+)${rightQuote}", "${leftQuote}`$1${rightQuote}"

# 4. Standard bold to quotes
$content = $content -replace '\*\*([^*]+?)\*\*', "${leftQuote}`$1${rightQuote}"

# 5. Clean up any single double-asterisks left
$content = $content -replace '\*\*', ''

[System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)
Write-Host "Success"
