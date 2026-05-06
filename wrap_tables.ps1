$path = 'c:\Users\user\OneDrive\デスクトップ\HP\articles\corsair_equip_beginner.md'
$content = Get-Content $path -Raw
$pattern = '(?m)^### 📊 合計ステータス目安（Max強化時）\r?\n((?:\|.*?\r?\n)+)'
$replacement = '<details>
<summary>📊 合計ステータス目安（クリックで開閉）</summary>

$1
</details>
'
$newContent = [regex]::Replace($content, $pattern, $replacement)
[IO.File]::WriteAllText($path, $newContent, [System.Text.Encoding]::UTF8)
echo 'Done'
