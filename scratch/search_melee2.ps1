$items = @(
    "ホクスボクアロー", "ホクスニピアス", "王将の指輪"
)

$results = @{}

# Load EUC-JP encoding
$eucJp = [System.Text.Encoding]::GetEncoding("euc-jp")
$cccBytes = [byte[]](0xB0, 0xA6)
$cccHex = ($cccBytes | ForEach-Object { "%{0:X2}" -f $_ }) -join ""

foreach ($item in $items) {
    try {
        # Encode item to EUC-JP bytes
        $itemBytes = $eucJp.GetBytes($item)
        $qfHex = ($itemBytes | ForEach-Object { "%{0:X2}" -f $_ }) -join ""
        
        $postStr = "CCC=$cccHex&Command=Search&qf=$qfHex&order=match&ffotype=title&type=title"
        $postBytes = [System.Text.Encoding]::ASCII.GetBytes($postStr)
        
        $url = "https://wiki.ffo.jp/search.cgi"
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.Method = "POST"
        $req.ContentType = "application/x-www-form-urlencoded"
        $req.AllowAutoRedirect = $false
        $req.Timeout = 10000
        
        $stream = $req.GetRequestStream()
        $stream.Write($postBytes, 0, $postBytes.Length)
        $stream.Close()
        
        try {
            $resp = $req.GetResponse()
            $loc = $resp.Headers['Location']
            $resp.Close()
            
            if ($loc) {
                if ($loc -like "/*") {
                    $results[$item] = "https://wiki.ffo.jp" + $loc
                } else {
                    $results[$item] = $loc
                }
            } else {
                $results[$item] = "No redirect Location header found"
            }
        } catch {
            $errResp = $_.Exception.Response
            if ($errResp) {
                $loc = $errResp.Headers['Location']
                $errResp.Close()
                if ($loc) {
                    if ($loc -like "/*") {
                        $results[$item] = "https://wiki.ffo.jp" + $loc
                    } else {
                        $results[$item] = $loc
                    }
                } else {
                    $results[$item] = "Error in response: $_"
                }
            } else {
                $results[$item] = "Error: $_"
            }
        }
    } catch {
        $results[$item] = "Encoding or request setup error: $_"
    }
}

$results | ConvertTo-Json
