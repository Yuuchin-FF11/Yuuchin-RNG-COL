$items = @{
    'アケロンシールド' = 'A5A2A5B1A5EDA5F3A5B7A1BCA5EBA5C9'
    'プライズパウダー' = 'A5D7A5E9A5A4A5BZA5D1A5A6A5C0A1BC'
    'エミネンス・レコード' = 'A5A8A5DFA5CDA5F3A5B9A1A6A5ECA5B3A1BCA5C9'
    'ユニティ・コンコード' = 'A5E5A5CBA5C6A5A3A1A6A5B3A5F3A5B3A1BCA5C9'
    'クリスタル' = 'A5AFA5EAA5B9A5BFA5EB'
}

$results = @{}

foreach ($key in $items.Keys) {
    try {
        # Construct hex url query
        $hex = $items[$key]
        $encoded = ""
        for ($i = 0; $i -lt $hex.Length; $i += 2) {
            $encoded += "%" + $hex.Substring($i, 2)
        }
        
        $url = "https://wiki.ffo.jp/wiki.cgi?Command=Search&Wiki=FF11&q=$encoded"
        
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.UserAgent = "Mozilla/5.0"
        $req.AllowAutoRedirect = $true
        
        $res = $req.GetResponse()
        $resUrl = $res.ResponseUri.AbsoluteUri
        $res.Close()
        
        $results[$key] = $resUrl
    } catch {
        Write-Host "Error $key : $_" -ForegroundColor Red
    }
}

$results | ConvertTo-Json
