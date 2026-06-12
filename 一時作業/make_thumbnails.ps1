Add-Type -AssemblyName System.Drawing

$baseDir = (Get-Location).Path
$utf8 = [System.Text.Encoding]::UTF8

# Decode Japanese strings from byte arrays to avoid encoding issues
$tempDirName = $utf8.GetString([byte[]](228, 184, 128, 230, 153, 130, 228, 189, 156, 230, 165, 173))
$suffix = $utf8.GetString([byte[]](95, 227, 130, 181, 227, 131, 160, 227, 131, 141, 46, 112, 110, 103)) # _サムネ.png

$tempDir = Join-Path $baseDir $tempDirName
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

function CreateThumbnail($inputPath, $outputPath, $titleText, $fontSize, $subTitleText = $null) {
    if (-not (Test-Path $inputPath)) {
        Write-Error "Input not found: $inputPath"
        return
    }
    
    Write-Host "Creating thumbnail for $inputPath..."
    $img = [System.Drawing.Image]::FromFile($inputPath)
    $bmp = [System.Drawing.Bitmap]::new($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
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
    
    $g.DrawImage($img, [System.Drawing.Rectangle]::new(0, 0, $width, $height), [System.Drawing.Rectangle]::new($sx, $sy, $drawW, $drawH), [System.Drawing.GraphicsUnit]::Pixel)
    
    DrawStyledText $g $titleText 640 90 $fontSize "Center"
    
    if ($subTitleText) {
        DrawStyledText $g $subTitleText 640 610 40 "Center"
    }
    
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $img.Dispose()
    Write-Host "Success: $outputPath"
}

# --- 1. Midnight Sortie ---
$inputNameMid = $utf8.GetString([byte[]](230, 183, 177, 229, 164, 156, 227, 130, 189, 227, 131, 188, 227, 131, 134, 227, 130, 163, 46, 106, 112, 103)) # 深夜ソーティ.jpg
$outBaseMid = $utf8.GetString([byte[]](230, 183, 177, 229, 164, 156, 227, 130, 189, 227, 131, 188, 227, 131, 134, 227, 130, 163)) # 深夜ソーティ
$titleTextMid = $utf8.GetString([byte[]](227, 131, 147, 227, 130, 185, 233, 175, 150, 32, 32, 230, 183, 177, 229, 164, 156, 227, 130, 189, 227, 131, 188, 227, 131, 134, 227, 130, 163, 233, 131, 168)) # ビス鯖  深夜ソーティ部

$inPathMid = Join-Path $tempDir $inputNameMid
$outPathMid = Join-Path $tempDir ($outBaseMid + $suffix)
CreateThumbnail $inPathMid $outPathMid $titleTextMid 70

# --- 2. Sortie 5 People ---
$inputName1 = $utf8.GetString([byte[]](227, 130, 189, 227, 131, 188, 227, 131, 134, 227, 130, 163, 239, 188, 149, 228, 186, 186, 46, 106, 112, 103)) # ソーティ５人.jpg
$outBase1 = $utf8.GetString([byte[]](227, 130, 189, 227, 131, 188, 227, 131, 134, 227, 130, 163, 239, 188, 149, 228, 186, 186)) # ソーティ５人
$titleTextNew = $utf8.GetString([byte[]](231, 134, 159, 231, 183, 180, 227, 130, 179, 227, 131, 171, 227, 130, 187, 227, 130, 162, 227, 129, 171, 227, 130, 136, 227, 130, 139, 227, 130, 189, 227, 131, 188, 227, 131, 134, 227, 130, 163, 239, 188, 152, 227, 131, 156, 227, 130, 185)) # 熟練コルセアによるソーティ８ボス

$inPath1 = Join-Path $tempDir $inputName1
$outPath1 = Join-Path $tempDir ($outBase1 + $suffix)
CreateThumbnail $inPath1 $outPath1 $titleTextNew 56

# --- 3. Sortie Back View ---
$inputName2 = $utf8.GetString([byte[]](227, 130, 189, 227, 131, 188, 227, 131, 134, 227, 130, 163, 229, 190, 140, 227, 130, 141, 229, 167, 191, 46, 106, 112, 103)) # ソーティ後ろ姿.jpg
$outBase2 = $utf8.GetString([byte[]](227, 130, 189, 227, 131, 188, 227, 131, 134, 227, 130, 163, 229, 190, 140, 227, 130, 141, 229, 167, 191)) # ソーティ後ろ姿

$inPath2 = Join-Path $tempDir $inputName2
$outPath2 = Join-Path $tempDir ($outBase2 + $suffix)
CreateThumbnail $inPath2 $outPath2 $titleTextNew 56

# --- 4. Kamui Apollyon ---
$inputName3 = $utf8.GetString([byte[]](231, 165, 158, 229, 168, 129, 46, 106, 112, 103)) # 神威.jpg
$outBase3 = $utf8.GetString([byte[]](231, 165, 158, 229, 168, 129, 95, 227, 130, 162, 227, 131, 157, 227, 131, 170, 227, 130, 170, 227, 131, 179)) # 神威_アポリオン
$titleText3 = $utf8.GetString([byte[]](227, 130, 162, 227, 131, 157, 227, 131, 170, 227, 130, 170, 227, 131, 179, 239, 188, 161, 239, 188, 161, 227, 128, 128, 231, 165, 158, 229, 168, 129, 230, 150, 176, 239, 188, 162, 239, 188, 167, 239, 188, 173)) # アポリオンＡＡ　神威新ＢＧＭ

$inPath3 = Join-Path $tempDir $inputName3
$outPath3 = Join-Path $tempDir ($outBase3 + $suffix)
CreateThumbnail $inPath3 $outPath3 $titleText3 56

# --- 5. Kamui Temenos ---
$outBase4 = $utf8.GetString([byte[]](231, 165, 158, 229, 168, 129, 95, 227, 131, 134, 227, 131, 161, 227, 131, 138, 227, 130, 185)) # 神威_テメナス
$titleText4 = $utf8.GetString([byte[]](227, 131, 134, 227, 131, 161, 227, 131, 138, 227, 130, 185, 239, 188, 161, 239, 188, 161, 227, 128, 128, 231, 165, 158, 229, 168, 129, 230, 150, 176, 239, 188, 162, 239, 188, 167, 239, 188, 173)) # テメナスＡＡ　神威新ＢＧＭ

$outPath4 = Join-Path $tempDir ($outBase4 + $suffix)
CreateThumbnail $inPath3 $outPath4 $titleText4 56

# --- 6. Trove ---
$inputName5 = $utf8.GetString([byte[]](227, 131, 136, 227, 131, 173, 227, 131, 188, 227, 131, 150, 46, 106, 112, 103)) # トローブ.jpg
$outBase5 = $utf8.GetString([byte[]](227, 131, 136, 227, 131, 173, 227, 131, 188, 227, 131, 150)) # トローブ
$titleText5 = $utf8.GetString([byte[]](227, 131, 136, 227, 131, 173, 227, 131, 188, 227, 131, 150, 227, 130, 173, 227, 131, 163, 227, 131, 169, 231, 183, 143, 229, 139, 149, 229, 147, 161, 227, 129, 167, 231, 174, 177, 233, 150, 139, 227, 129, 145, 239, 188, 129)) # トローブキャラ総動員で箱開け！
$subText5 = $utf8.GetString([byte[]](239, 188, 185, 239, 189, 149, 239, 189, 149, 239, 189, 131, 239, 189, 136, 239, 189, 137, 239, 189, 142, 239, 188, 160, 227, 130, 191, 227, 131, 171, 231, 139, 169)) # Ｙｕｕｃｈｉｎ＠タル狩

$inPath5 = Join-Path $tempDir $inputName5
$outPath5 = Join-Path $tempDir ($outBase5 + $suffix)
CreateThumbnail $inPath5 $outPath5 $titleText5 56 $subText5
