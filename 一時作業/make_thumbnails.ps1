Add-Type -AssemblyName System.Drawing

$baseDir = (Get-Location).Path
$utf8 = [System.Text.Encoding]::UTF8

# Decode Japanese strings from byte arrays to avoid encoding issues
$tempDirName = $utf8.GetString([byte[]](228, 184, 128, 230, 153, 130, 228, 189, 156, 230, 165, 173))
$inputName1 = $utf8.GetString([byte[]](227, 130, 189, 227, 131, 188, 227, 131, 134, 227, 130, 163, 239, 188, 149, 228, 186, 186, 46, 106, 112, 103)) # ソーティ５人.jpg
$inputName2 = $utf8.GetString([byte[]](227, 130, 189, 227, 131, 188, 227, 131, 134, 227, 130, 163, 229, 190, 140, 227, 130, 141, 229, 167, 191, 46, 106, 112, 103)) # ソーティ後ろ姿.jpg

$suffixA = $utf8.GetString([byte[]](95, 227, 130, 181, 227, 131, 160, 227, 131, 141, 95, 227, 131, 145, 227, 130, 191, 227, 131, 188, 227, 131, 179, 65, 46, 112, 110, 103)) # _サムネ_パターンA.png
$suffixB = $utf8.GetString([byte[]](95, 227, 130, 181, 227, 131, 160, 227, 131, 141, 95, 227, 131, 145, 227, 130, 191, 227, 131, 188, 227, 131, 179, 66, 46, 112, 110, 103)) # _サムネ_パターンB.png

# Output base names
$outBaseName1 = $utf8.GetString([byte[]](227, 130, 189, 227, 131, 188, 227, 131, 134, 227, 130, 163, 239, 188, 149, 228, 186, 186)) # ソーティ５人
$outBaseName2 = $utf8.GetString([byte[]](227, 130, 189, 227, 131, 188, 227, 131, 134, 227, 130, 163, 229, 190, 140, 227, 130, 141, 229, 167, 191)) # ソーティ後ろ姿

$titleText = $utf8.GetString([byte[]](231, 134, 159, 231, 183, 180, 227, 130, 179, 227, 131, 171, 227, 130, 187, 227, 130, 162, 227, 129, 171, 227, 130, 136, 227, 130, 139, 227, 130, 189, 227, 131, 188, 227, 131, 134, 227, 130, 163, 239, 188, 152, 227, 131, 156, 227, 130, 185)) # 熟練コルセアによるソーティ８ボス

$tempDir = Join-Path $baseDir $tempDirName
$bgPath = Join-Path $tempDir "cyber_neon_purple_bg.png"

$width = 1280
$height = 720

function DrawStyledText($g, $text, $x, $y, $emSize, $align) {
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $fontFamily = $null
    try {
        $fontFamily = [System.Drawing.FontFamily]::new("Meiryo")
    } catch {
        try {
            $fontFamily = [System.Drawing.FontFamily]::new("MS Gothic")
        } catch {
            $fontFamily = [System.Drawing.FontFamily]::GenericSansSerif
        }
    }
    
    $style = [int][System.Drawing.FontStyle]::Bold
    $origin = [System.Drawing.PointF]::new($x, $y)
    
    $sf = [System.Drawing.StringFormat]::new()
    $sf.Alignment = [System.Drawing.StringAlignment]::$align
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    
    $path.AddString($text, $fontFamily, $style, $emSize, $origin, $sf)
    
    # 1. Neon Glow
    for ($w = 24; $w -ge 12; $w -= 4) {
        $glowColor = [System.Drawing.Color]::FromArgb(40, 244, 63, 94)
        $penArgs = [object[]]($glowColor, [single]$w)
        $glowPen = New-Object System.Drawing.Pen -ArgumentList $penArgs
        $glowPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
        $g.DrawPath($glowPen, $path)
        $glowPen.Dispose()
    }
    
    # 2. Dark Outline
    $darkColor = [System.Drawing.Color]::FromArgb(255, 15, 23, 42)
    $penArgs = [object[]]($darkColor, [single]12.0)
    $borderPen = New-Object System.Drawing.Pen -ArgumentList $penArgs
    $borderPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPath($borderPen, $path)
    $borderPen.Dispose()
    
    # 3. Gold Gradient Fill
    $rect = $path.GetBounds()
    if ($rect.Width -gt 0 -and $rect.Height -gt 0) {
        $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
            $rect,
            [System.Drawing.Color]::FromArgb(255, 253, 224, 71),
            [System.Drawing.Color]::FromArgb(255, 234, 179, 8),
            [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
        )
        $g.FillPath($brush, $path)
        $brush.Dispose()
    } else {
        $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 250, 204, 21))
        $g.FillPath($brush, $path)
        $brush.Dispose()
    }
    
    $path.Dispose()
    $sf.Dispose()
    if ($fontFamily -and $fontFamily -ne [System.Drawing.FontFamily]::GenericSansSerif) {
        $fontFamily.Dispose()
    }
}

function CreateThumbnailsForImage($inputPath, $outputPathA, $outputPathB) {
    if (-not (Test-Path $inputPath)) {
        Write-Error "Input not found: $inputPath"
        return
    }
    
    # --- Pattern A: Background As-Is ---
    Write-Host "Creating Pattern A for $inputPath..."
    $img = [System.Drawing.Image]::FromFile($inputPath)
    $bmpA = [System.Drawing.Bitmap]::new($width, $height)
    $gA = [System.Drawing.Graphics]::FromImage($bmpA)
    
    $gA.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $gA.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gA.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    $srcW = $img.Width
    $srcH = $img.Height
    $targetAspect = 1280 / 720
    $srcAspect = $srcW / $srcH
    
    $drawW = 0
    $drawH = 0
    $sx = 0
    $sy = 0
    
    if ($srcAspect -gt $targetAspect) {
        $drawH = $srcH
        $drawW = [int]($srcH * $targetAspect)
        $sx = [int](($srcW - $drawW) / 2)
        $sy = 0
    } else {
        $drawW = $srcW
        $drawH = [int]($srcW / $targetAspect)
        $sx = 0
        $sy = [int](($srcH - $drawH) / 2)
    }
    
    $gA.DrawImage($img, [System.Drawing.Rectangle]::new(0, 0, $width, $height), [System.Drawing.Rectangle]::new($sx, $sy, $drawW, $drawH), [System.Drawing.GraphicsUnit]::Pixel)
    
    # Render Text near the top ceiling (font size 56 for longer title)
    DrawStyledText $gA $titleText 640 90 56 "Center"
    
    $bmpA.Save($outputPathA, [System.Drawing.Imaging.ImageFormat]::Png)
    $gA.Dispose()
    $bmpA.Dispose()
    Write-Host "Pattern A Success"
    
    # --- Pattern B: Composite on Neon Background ---
    if (Test-Path $bgPath) {
        Write-Host "Creating Pattern B for $inputPath..."
        $bg = [System.Drawing.Image]::FromFile($bgPath)
        $bmpB = [System.Drawing.Bitmap]::new($width, $height)
        $gB = [System.Drawing.Graphics]::FromImage($bmpB)
        
        $gB.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $gB.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $gB.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        
        $gB.DrawImage($bg, 0, 0, $width, $height)
        
        # Frame dimensions
        $cx = 640; $cy = 300; $cw = 780; $ch = 420
        
        $framePath = [System.Drawing.Drawing2D.GraphicsPath]::new()
        $framePath.StartFigure() | Out-Null
        $cut = 50
        $pts = @(
            [System.Drawing.PointF]::new($cx - $cw/2 + $cut, $cy - $ch/2),
            [System.Drawing.PointF]::new($cx + $cw/2 - $cut, $cy - $ch/2),
            [System.Drawing.PointF]::new($cx + $cw/2, $cy - $ch/2 + $cut),
            [System.Drawing.PointF]::new($cx + $cw/2, $cy + $ch/2 - $cut),
            [System.Drawing.PointF]::new($cx + $cw/2 - $cut, $cy + $ch/2),
            [System.Drawing.PointF]::new($cx - $cw/2 + $cut, $cy + $ch/2),
            [System.Drawing.PointF]::new($cx - $cw/2, $cy + $ch/2 - $cut),
            [System.Drawing.PointF]::new($cx - $cw/2, $cy - $ch/2 + $cut)
        )
        $framePath.AddPolygon($pts) | Out-Null
        
        $gB.Save() | Out-Null
        $gB.SetClip($framePath)
        
        $cropW = $srcW
        $cropH = [int]($srcW * ($ch / $cw))
        if ($cropH -gt $srcH) {
            $cropH = $srcH
            $cropW = [int]($srcH * ($cw / $ch))
        }
        $cropX = [int](($srcW - $cropW) / 2)
        $cropY = [int](($srcH - $cropH) * 0.75)
        if ($cropY -lt 0) { $cropY = 0 }
        if ($cropY + $cropH -gt $srcH) { $cropY = $srcH - $cropH }
        
        $gB.DrawImage($img, [System.Drawing.Rectangle]::new($cx - $cw/2, $cy - $ch/2, $cw, $ch), [System.Drawing.Rectangle]::new($cropX, $cropY, $cropW, $cropH), [System.Drawing.GraphicsUnit]::Pixel)
        
        $gB.ResetClip()
        
        # Royal Gold Border
        $goldColor = [System.Drawing.Color]::FromArgb(255, 234, 179, 8)
        $penArgsB = [object[]]($goldColor, [single]10.0)
        $framePen = New-Object System.Drawing.Pen -ArgumentList $penArgsB
        $framePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
        $gB.DrawPolygon($framePen, $pts) | Out-Null
        $framePen.Dispose()
        
        # Render Text at the bottom (font size 56 for longer title)
        DrawStyledText $gB $titleText 640 590 56 "Center"
        
        $bmpB.Save($outputPathB, [System.Drawing.Imaging.ImageFormat]::Png)
        
        $gB.Dispose()
        $bmpB.Dispose()
        $bg.Dispose()
        $framePath.Dispose()
        Write-Host "Pattern B Success"
    }
    
    $img.Dispose()
}

# Run for Image 1 (ソーティ５人)
$inPath1 = Join-Path $tempDir $inputName1
$outPath1A = Join-Path $tempDir ($outBaseName1 + $suffixA)
$outPath1B = Join-Path $tempDir ($outBaseName1 + $suffixB)
CreateThumbnailsForImage $inPath1 $outPath1A $outPath1B

# Run for Image 2 (ソーティ後ろ姿)
$inPath2 = Join-Path $tempDir $inputName2
$outPath2A = Join-Path $tempDir ($outBaseName2 + $suffixA)
$outPath2B = Join-Path $tempDir ($outBaseName2 + $suffixB)
CreateThumbnailsForImage $inPath2 $outPath2A $outPath2B
