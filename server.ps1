$port = 8080
$listener = $null
$started = $false
$global:LatestChatData = $null

# 8080から8090番ポートまでで空いているポートを自動スキャンして起動します🐾
while (-not $started -and $port -le 8090) {
    try {
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://localhost:$port/")
        $listener.Start()
        $started = $true
    } catch {
        Write-Host "Port $port is already in use, trying next port..."
        $port++
    }
}

if (-not $started) {
    Write-Error "All ports between 8080 and 8090 are currently in use. Could not start server."
    exit
}

Write-Host "Server successfully started at http://localhost:$port/"



try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        # Disable Keep-Alive to prevent connection state issues
        $response.KeepAlive = $false
        
        # 安全なURLデコード（古い環境の文字化けバグを回避しつつクラッシュを防ぐフォールバック設計）🐾
        $rawPath = $request.RawUrl.Split('?')[0].TrimStart('/')
        $path = $rawPath
        try {
            $path = [System.Uri]::UnescapeDataString($rawPath)
        } catch {
            $path = $request.Url.LocalPath.TrimStart('/')
        }
        if ($path -eq "") { $path = "index.html" }
        
        # API エンドポイントの処理 (別プロセス間の超安定ハイブリッド同期用) 🐾
        if ($path -eq "api/chat") {
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
            
            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 200
                $response.Close()
                continue
            }
            
            if ($request.HttpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream)
                $body = $reader.ReadToEnd()
                $global:LatestChatData = $body
                
                $response.ContentType = "application/json"
                $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"status":"ok"}')
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                $response.Close()
                continue
            }
            
            if ($request.HttpMethod -eq "GET") {
                $response.ContentType = "application/json"
                $dataToSend = if ($global:LatestChatData) { $global:LatestChatData } else { "{}" }
                $resBytes = [System.Text.Encoding]::UTF8.GetBytes($dataToSend)
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                $response.Close()
                continue
            }
        }
        
        # Prevent directory traversal
        $path = $path -replace '\.\.', ''
        
        $fullPath = Join-Path (Get-Location) $path
        Write-Host "Request path: '$path', Full path: '$fullPath'"
        
        if (Test-Path $fullPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
            
            # Simple MIME types without explicit charset to prevent .NET internal byte mismatch
            if ($path.EndsWith(".html")) { $response.ContentType = "text/html" }
            elseif ($path.EndsWith(".css")) { $response.ContentType = "text/css" }
            elseif ($path.EndsWith(".js")) { $response.ContentType = "application/javascript" }
            elseif ($path.EndsWith(".json")) { $response.ContentType = "application/json" }
            elseif ($path.EndsWith(".md")) { $response.ContentType = "text/markdown" }
            
            # Add CORS headers so we don't run into issues
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            
            $response.ContentLength64 = $bytes.Length
            
            # Send bytes
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $err = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentLength64 = $err.Length
            $response.OutputStream.Write($err, 0, $err.Length)
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
}
