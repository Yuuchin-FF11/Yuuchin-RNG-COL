$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Server started at http://localhost:$port/"
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $path = $request.Url.LocalPath.TrimStart('/')
        if ($path -eq "") { $path = "index.html" }
        
        # Prevent directory traversal
        $path = $path -replace '\.\.', ''
        
        $fullPath = Join-Path (Get-Location) $path
        Write-Host "Request path: '$path', Full path: '$fullPath'"
        $exists = Test-Path $fullPath -PathType Leaf
        Write-Host "File exists: $exists"
        
        if (Test-Path $fullPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
            $response.ContentLength64 = $bytes.Length
            
            # Simple MIME types
            if ($path.EndsWith(".html")) { $response.ContentType = "text/html; charset=UTF-8" }
            elseif ($path.EndsWith(".css")) { $response.ContentType = "text/css; charset=UTF-8" }
            elseif ($path.EndsWith(".js")) { $response.ContentType = "application/javascript; charset=UTF-8" }
            elseif ($path.EndsWith(".json")) { $response.ContentType = "application/json; charset=UTF-8" }
            elseif ($path.EndsWith(".md")) { $response.ContentType = "text/markdown; charset=UTF-8" }
            
            # Add CORS headers so we don't run into issues
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $err = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($err, 0, $err.Length)
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
}
