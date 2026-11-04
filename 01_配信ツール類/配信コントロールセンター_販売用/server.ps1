# 二重起動防止のため、ポート8085を使用している古いプロセスを自動解放
Get-NetTCPConnection -LocalPort 8085 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}

$port = 8085
$listener = $null
$started = $false
$global:ChatQueue = @()

# Scan ports from 8085 to 8095 to find an available one
while (-not $started -and $port -le 8095) {
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
    Write-Error "All ports between 8085 and 8095 are currently in use. Could not start server."
    exit
}

Write-Host "Server successfully started at http://localhost:$port/"

# Auto launch default browser to open index.html disabled (handled by launcher batch)
# try {
#     Start-Process "http://localhost:$port/index.html"
# } catch {
#     Write-Host "Failed to launch browser automatically: " $_.Exception.Message
# }



try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        # Disable Keep-Alive to prevent connection state issues
        $response.KeepAlive = $false
        
        # Safe URL decode with fallback
        $rawPath = $request.RawUrl.Split('?')[0].TrimStart('/')
        $path = $rawPath
        try {
            $path = [System.Uri]::UnescapeDataString($rawPath)
        } catch {
            $path = $request.Url.LocalPath.TrimStart('/')
        }
        if ($path -eq "") { $path = "index.html" }
        
        # Proxy API for live broadcast detection (Avoids CORS issues)
        if ($path -eq "api/detect-live") {
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Access-Control-Allow-Methods", "GET, OPTIONS")
            
            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 200
                $response.Close()
                continue
            }
            
            $channelId = $request.QueryString["channelId"]
            if ([string]::IsNullOrEmpty($channelId)) {
                $response.StatusCode = 400
                $response.Close()
                continue
            }
            
            try {
                $url = "https://www.youtube.com/channel/$channelId/live"
                $userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edge/120.0.0.0"
                $webRes = Invoke-WebRequest -Uri $url -UserAgent $userAgent -TimeoutSec 10 -UseBasicParsing
                $html = $webRes.Content
                
                $response.ContentType = "text/html; charset=utf-8"
                $resBytes = [System.Text.Encoding]::UTF8.GetBytes($html)
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            } catch {
                $response.StatusCode = 500
                $resBytes = [System.Text.Encoding]::UTF8.GetBytes("Failed to fetch live page: " + $_.Exception.Message)
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            }
            $response.Close()
            continue
        }

        # Reverse Proxy for YouTube live chat (Embed-friendly, eliminates --disable-web-security)
        if ($path -like "youtube-proxy*") {
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Access-Control-Allow-Methods", "GET, OPTIONS")
            $response.Headers.Add("Access-Control-Allow-Headers", "*")
            
            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 200
                $response.Close()
                continue
            }
            
            # Extract target query and path
            $rawQuery = $request.Url.Query
            $targetSubPath = $path -replace '^youtube-proxy/?', ''
            if ([string]::IsNullOrEmpty($targetSubPath)) { $targetSubPath = "live_chat" }
            $targetUrl = "https://www.youtube.com/$targetSubPath$rawQuery"
            
            try {
                $userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edge/120.0.0.0"
                $ytReq = [System.Net.HttpWebRequest]::Create($targetUrl)
                $ytReq.UserAgent = $userAgent
                $ytReq.Headers.Add("Accept-Language", "ja,en-US;q=0.9,en;q=0.8")
                $ytReq.Timeout = 15000
                
                $ytRes = $ytReq.GetResponse()
                $resStream = $ytRes.GetResponseStream()
                
                $contentType = $ytRes.ContentType
                if ([string]::IsNullOrEmpty($contentType)) { $contentType = "text/html; charset=utf-8" }
                $response.ContentType = $contentType
                
                if ($contentType -like "*text/html*") {
                    $reader = New-Object System.IO.StreamReader($resStream, [System.Text.Encoding]::UTF8)
                    $html = $reader.ReadToEnd()
                    $reader.Close()
                    
                    # Inject <base> tag to resolve relative YouTube scripts and assets
                    $baseTag = '<base href="https://www.youtube.com/">'
                    if ($html -like "*<head>*") {
                        $html = $html -replace '<head>', "<head>`n$baseTag"
                    } else {
                        $html = "$baseTag$html"
                    }
                    
                    $resBytes = [System.Text.Encoding]::UTF8.GetBytes($html)
                    $response.ContentLength64 = $resBytes.Length
                    $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                } else {
                    $response.ContentLength64 = $ytRes.ContentLength
                    $resStream.CopyTo($response.OutputStream)
                }
                $ytRes.Close()
            } catch {
                $response.StatusCode = 500
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes("Proxy Error: " + $_.Exception.Message)
                $response.ContentLength64 = $errBytes.Length
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            }
            $response.Close()
            continue
        }

        # API Endpoint handling for cross-process synchronization
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
                
                # Add to queue and limit to last 50 items
                $global:ChatQueue += $body
                if ($global:ChatQueue.Count -gt 50) {
                    $global:ChatQueue = $global:ChatQueue[-50..-1]
                }
                
                $response.ContentType = "application/json"
                $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"status":"ok"}')
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                $response.Close()
                continue
            }
            
            if ($request.HttpMethod -eq "GET") {
                $response.ContentType = "application/json"
                # Return queue as a JSON array
                $jsonArray = "[" + ($global:ChatQueue -join ",") + "]"
                $resBytes = [System.Text.Encoding]::UTF8.GetBytes($jsonArray)
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
            $pathLower = $path.ToLower()
            if ($pathLower.EndsWith(".html")) { $response.ContentType = "text/html; charset=utf-8" }
            elseif ($pathLower.EndsWith(".css")) { $response.ContentType = "text/css; charset=utf-8" }
            elseif ($pathLower.EndsWith(".js")) { $response.ContentType = "application/javascript; charset=utf-8" }
            elseif ($pathLower.EndsWith(".json")) { $response.ContentType = "application/json; charset=utf-8" }
            elseif ($pathLower.EndsWith(".md")) { $response.ContentType = "text/markdown; charset=utf-8" }
            elseif ($pathLower.EndsWith(".mp3")) { $response.ContentType = "audio/mpeg" }
            elseif ($pathLower.EndsWith(".wav")) { $response.ContentType = "audio/wav" }
            elseif ($pathLower.EndsWith(".png")) { $response.ContentType = "image/png" }
            elseif ($pathLower.EndsWith(".jpg") -or $pathLower.EndsWith(".jpeg")) { $response.ContentType = "image/jpeg" }
            elseif ($pathLower.EndsWith(".gif")) { $response.ContentType = "image/gif" }
            
            # Add CORS headers so we don't run into issues
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            
            $response.ContentLength64 = $bytes.Length
            
            # Send bytes (Skip if it is a HEAD request to prevent HttpListener crash)
            if ($request.HttpMethod -ne "HEAD") {
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        } else {
            $response.StatusCode = 404
            $err = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentLength64 = $err.Length
            if ($request.HttpMethod -ne "HEAD") {
                $response.OutputStream.Write($err, 0, $err.Length)
            }
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
}
