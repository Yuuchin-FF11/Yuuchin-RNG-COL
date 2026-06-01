$filePath = "articles/sortie_corsair_aminon.md"
$content = [System.IO.File]::ReadAllText((Resolve-Path $filePath), [System.Text.Encoding]::UTF8)

# 1. ソーティ（Sortie） -> ソーティ
$content = $content.Replace("ソーティ（Sortie）", "ソーティ")

# 2. Aminon (Hard Mode / 強バージョン) -> アミノン（強バージョン）
$content = $content.Replace("Aminon (Hard Mode / 強バージョン)", "アミノン（強バージョン）")

# 3. Aminon (Hard Mode) -> アミノン（強バージョン）
$content = $content.Replace("Aminon (Hard Mode)", "アミノン（強バージョン）")

# 4. アミノン（Aminon） -> アミノン
$content = $content.Replace("アミノン（Aminon）", "アミノン")

# 5. コルセア（COR） -> コルセア
$content = $content.Replace("コルセア（COR）", "コルセア")

# 6. その他の Aminon -> アミノン (大文字小文字無視の置換)
$content = [System.Text.RegularExpressions.Regex]::Replace($content, "Aminon", "アミノン", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

# 保存 (BOMなしUTF8)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $filePath), $content, $utf8NoBom)

Write-Host "Replacement complete for Japanese article via PowerShell!"
