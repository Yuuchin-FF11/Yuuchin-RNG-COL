param(
    [Parameter(Mandatory=$true)]
    [string]$TargetFile
)

if (-not (Test-Path $TargetFile)) {
    Write-Error "Error: Target file $TargetFile not found."
    exit 1
}

$basename = Split-Path $TargetFile -Leaf
Write-Host "Scanning target source code: $basename"

# Read file content
$sourceContent = Get-Content -Raw -Path $TargetFile -Encoding utf8

# Regex to detect image paths in quotes
$dq = [char]34
$sq = [char]39
$regex = "[$dq$sq]([^$dq$sq\s]+\.(?:png|jpg|jpeg|gif))[$dq$sq]"
$matches = [regex]::Matches($sourceContent, $regex)

$uniquePaths = @()
foreach ($m in $matches) {
    $path = $m.Groups[1].Value
    if ($uniquePaths -notcontains $path) {
        $uniquePaths += $path
    }
}

# Load .NET System.Drawing assembly for image info (Standard Windows component, no Python or Pillow required)
[Reflection.Assembly]::LoadWithPartialName("System.Drawing") | Out-Null

$results = @()
$sourceDir = Split-Path -Parent (Resolve-Path $TargetFile)

foreach ($path in $uniquePaths) {
    $resolvedPath = Join-Path $sourceDir $path
    if (-not (Test-Path $resolvedPath)) {
        $resolvedPath = Resolve-Path $path -ErrorAction SilentlyContinue
    }
    
    $exists = Test-Path $resolvedPath
    $width = $null
    $height = $null
    $type = "Unknown"
    $sizeBytes = $null
    
    if ($exists -and (Test-Path $resolvedPath -PathType Leaf)) {
        $sizeBytes = (Get-Item $resolvedPath).Length
        try {
            $fileStream = New-Object System.IO.FileStream($resolvedPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read)
            $img = [System.Drawing.Image]::FromStream($fileStream, $false, $false)
            $width = $img.Width
            $height = $img.Height
            $type = $img.RawFormat.ToString()
            $img.Dispose()
            $fileStream.Dispose()
        } catch {
            $type = "Parse Error"
            if ($null -ne $fileStream) { $fileStream.Dispose() }
        }
    }
    
    $results += [PSCustomObject]@{
        DetectedPath = $path
        ResolvedPath = $resolvedPath
        Exists       = $exists
        Width        = $width
        Height       = $height
        Type         = $type
        SizeBytes    = $sizeBytes
    }
}

# Generate Markdown Report
$reportPath = Join-Path $sourceDir "fact_report.md"
$reportLines = @()

$reportLines += "# [Fact Report] Resource scan results for $basename"
$reportLines += ""
$reportLines += "This report shows the physical reality (resolution, size) of detected image resources to prevent wrong assumptions."
$reportLines += ""
$reportLines += "| Detected Path | Status | Resolution (W x H) | Format | File Size (KB) |"
$reportLines += "| :--- | :---: | :--- | :--- | :--- |"

Write-Host "================================================================================"
Write-Host "[Fact Scan Results] $basename"
Write-Host "================================================================================"

foreach ($r in $results) {
    $statusSymbol = if ($r.Exists) { "OK (Exists)" } else { "MISSING (Not Found)" }
    $resStr = if ($r.Exists) { "$($r.Width) x $($r.Height) px" } else { "N/A" }
    $fmtStr = if ($r.Exists) { $r.Type } else { "N/A" }
    $sizeKb = if ($r.Exists) { "{0:N2} KB" -f ($r.SizeBytes / 1KB) } else { "N/A" }
    
    $reportLines += "| $($r.DetectedPath) | $statusSymbol | $resStr | $fmtStr | $sizeKb |"
    
    Write-Host "- Path: $($r.DetectedPath)"
    Write-Host "  Status: $statusSymbol"
    if ($r.Exists) {
        Write-Host "  Physical Size: $resStr | Format: $fmtStr | Capacity: $sizeKb"
    }
    Write-Host "--------------------------------------------------"
}

$reportLines += ""
$reportLines += "## [Instructions to Prevent Guessing]"
$reportLines += "- Double check if the rendered size in your HTML/JS code matches the physical dimensions above."
$reportLines += "- If status is 'MISSING', verify the path spelling or asset existence."
$reportLines += ""

$reportLines | Out-File -FilePath $reportPath -Encoding utf8 -Force

Write-Host ""
Write-Host "[Finished] Detailed report generated: $reportPath"
