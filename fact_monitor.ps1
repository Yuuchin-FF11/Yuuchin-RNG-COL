# ポート8080で接続待ちする HttpListener を作成
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8080/")

# 重複起動などによるエラー対策
try {
    $listener.Start()
} catch {
    Write-Host "[ERROR] Port 8080 is already in use. Please check if another instance is running."
    exit
}

# 監視対象ファイルのパスと更新日時を格納するハッシュテーブル
$watchedFiles = @{}
$monitorDir = Get-Location

# 除外ディレクトリ
$excludeDirs = @('.git', '.agent', '.agents', '.vscode', 'scratch')
# 除外ファイル
$excludeFiles = @('fact_monitor.py', 'fact_monitor.ps1', 'fact_scanner.py', 'fact_report.md', 'STATUS_REPORT.md', 'ファクトスキャナー起動.html')

function Scan-Files {
    $state = @{}
    # 再帰的にファイルを走査
    $files = Get-ChildItem -Path $monitorDir -Recurse -File -Include *.html, *.css, *.js
    foreach ($file in $files) {
        # 除外ディレクトリに含まれているかチェック
        $skip = $false
        foreach ($excludeDir in $excludeDirs) {
            if ($file.FullName -like "*\$excludeDir\*") {
                $skip = $true
                break
            }
        }
        if ($skip) { continue }
        if ($excludeFiles -contains $file.Name) { continue }
        
        # LastWriteTimeのTicks（タイムスタンプ）を保存
        $state[$file.FullName] = [double]$file.LastWriteTime.Ticks
    }
    return $state
}

# 初期状態のロード
$watchedFiles = Scan-Files
Write-Host "[INFO] Watcher initialized. Monitoring $($watchedFiles.Count) files."
Write-Host "[INFO] Server started successfully at http://localhost:8080/"

# メインループ
while ($listener.IsListening) {
    try {
        # リクエストの待機
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        # CORSおよびヘッダーの設定
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        
        $urlPath = $request.Url.AbsolutePath
        
        if ($urlPath -eq "/api/status") {
            # クエリパラメータ last_check の取得
            $lastCheck = 0.0
            if ($request.QueryString["last_check"]) {
                [double]::TryParse($request.QueryString["last_check"], [ref]$lastCheck) | Out-Null
            }
            
            $currentState = Scan-Files
            $modified = $false
            $targetFileName = ""
            $codeContent = ""
            
            # 最新のタイムスタンプを取得
            $maxMtime = $lastCheck
            if ($currentState.Count -gt 0) {
                $maxMtime = ($currentState.Values | Measure-Object -Maximum).Maximum
            }
            
            # 差分チェック
            # 初回（lastCheck == 0）は同期のみ行う
            if ($lastCheck -gt 0.0 -and $maxMtime -gt $lastCheck) {
                foreach ($path in $currentState.Keys) {
                    if ($currentState[$path] -gt $lastCheck) {
                        $modified = $true
                        $targetFileName = Split-Path $path -Leaf
                        # 安全な読み込み（UTF-8）
                        $codeContent = Get-Content -Path $path -Raw -Encoding utf8
                        break
                    }
                }
            }
            
            # 状態更新
            $watchedFiles = $currentState
            
            # レスポンスJSONの作成
            $responseData = @{
                connected = $true
                modified = $modified
                target_file_name = $targetFileName
                code_content = $codeContent
                monitoring_path = (Split-Path $monitorDir -Leaf)
                last_check = [double]$maxMtime
            }
            
            # JSONに変換してレスポンス出力
            $json = ConvertTo-Json $responseData
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
            
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.OutputStream.Close()
            
        } elseif ($urlPath -eq "/" -or $urlPath -eq "") {
            # ファクトスキャナー起動.html の配信
            $htmlPath = Join-Path $monitorDir "ファクトスキャナー起動.html"
            if (Test-Path $htmlPath) {
                $buffer = [System.IO.File]::ReadAllBytes($htmlPath)
                $response.ContentType = "text/html; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.OutputStream.Close()
            } else {
                $response.StatusCode = 404
                $response.Close()
            }
        } else {
            # その他の静的ファイル配信（アセットのプレビュー表示用）
            $filePath = Join-Path $monitorDir $urlPath.Replace("/", "\").TrimStart("\")
            if (Test-Path $filePath -PathType Leaf) {
                $buffer = [System.IO.File]::ReadAllBytes($filePath)
                
                # 拡張子からContentTypeを判定
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = "application/octet-stream"
                if ($ext -eq ".png") { $contentType = "image/png" }
                elif ($ext -eq ".jpg" -or $ext -eq ".jpeg") { $contentType = "image/jpeg" }
                elif ($ext -eq ".gif") { $contentType = "image/gif" }
                elif ($ext -eq ".css") { $contentType = "text/css" }
                elif ($ext -eq ".js") { $contentType = "application/javascript" }
                
                $response.ContentType = $contentType
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.OutputStream.Close()
            } else {
                $response.StatusCode = 404
                $response.Close()
            }
        }
    } catch {
        # エラーハンドリング
        if ($null -ne $response) {
            try {
                $response.StatusCode = 500
                $response.Close()
            } catch {}
        }
    }
}
