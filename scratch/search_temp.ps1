Add-Type -AssemblyName System.Web

$items = @('アケロンシールド', 'プライズパウダー', 'エミネンス・レコード', 'ユニティ・コンコード', 'クリスタル')
$results = @{}

foreach ($item in $items) {
    try {
        # Encode in EUC-JP
        $eucJp = [System.Text.Encoding]::GetEncoding("euc-jp")
        $encoded = [System.Web.HttpUtility]::UrlEncode($item, $eucJp)
        $url = "https://wiki.ffo.jp/wiki.cgi?Command=Search&Wiki=FF11&q=$encoded"
        
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.UserAgent = "Mozilla/5.0"
        $req.AllowAutoRedirect = $true
        
        $res = $req.GetResponse()
        $resUrl = $res.ResponseUri.AbsoluteUri
        
        if ($resUrl -match 'html/\d+\.html') {
            $results[$item] = $resUrl
        } else {
            # Read response stream to search for matches
            $stream = $res.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream, $eucJp)
            $html = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
            
            if ($html -match 'href="(/html/\d+\.html)">([^<]*' + [regex]::Escape($item) + '[^<]*)</a>') {
                $results[$item] = "https://wiki.ffo.jp" + $Matches[1]
            }
        }
        $res.Close()
    } catch {
        Write-Host "Error $item : $_" -ForegroundColor Red
    }
}

$results | ConvertTo-Json
