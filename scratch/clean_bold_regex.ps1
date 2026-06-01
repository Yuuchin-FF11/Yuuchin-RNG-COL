$filePath = "c:\Users\user\OneDrive\デスクトップ\HP\articles\sortie_corsair_aminon.md"
$content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)

# 1. Table cell bold removal: | **サポ竜 (DRG)** | -> | サポ竜 (DRG) |
$content = $content -replace '\|\s*\*\*([^*|]+)\*\*\s*\|', '| $1 |'
$content = $content -replace '\|\s*\*\*([^*|]+)\*\*\s*', '| $1 '
$content = $content -replace '\s*\*\*([^*|]+)\*\*\s*\|', ' $1 |'

# 2. List item header bold removal: *   **項目**: -> *   項目:
$content = $content -replace '(?m)^(\s*)\*\s+\*\*([^*:\s]+)\*\*:', '$1*   $2:'

# 3. Bold nested with quotes: **「...」** -> 「...」
$content = $content -replace '\*\*「([^」]+)」\*\*', '「$1」'
$content = $content -replace '「([^」]+)」\*\*', '「$1」'
$content = $content -replace '\*\*「([^」]+)」', '「$1」'

# 4. Standard bold to quotes: **text** -> 「text」
$content = $content -replace '\*\*([^*]+?)\*\*', '「$1」'

# 5. Clean up any single double-asterisks left
$content = $content -replace '\*\*', ''

[System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)
Write-Host "Success"
