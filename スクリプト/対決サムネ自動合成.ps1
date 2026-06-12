Add-Type -AssemblyName System.Drawing

$baseDir = (Get-Location).Path
$utf8 = [System.Text.Encoding]::UTF8
$tempDirName = $utf8.GetString([byte[]](228, 184, 128, 230, 153, 130, 228, 189, 156, 230, 165, 173))
$bossName = $utf8.GetString([byte[]](227, 131, 144, 227, 131, 179, 227, 131, 144, 46, 112, 110, 103))
$selfName = $utf8.GetString([byte[]](231, 153, 189, 227, 130, 191, 227, 131, 171, 46, 106, 112, 103))
$bossPath = Join-Path $baseDir (Join-Path $tempDirName $bossName)
$selfPath = Join-Path $baseDir (Join-Path $tempDirName $selfName)
$outputPath = Join-Path $baseDir "versus_thumbnail_Bumba.png"

$width = 1280
$height = 720
$bmp = [System.Drawing.Bitmap]::new($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)

$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# 1. Base Gradient
$brushLeft = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.Point]::new(0, 0), [System.Drawing.Point]::new(640, 720), [System.Drawing.Color]::FromArgb(255, 88, 28, 135), [System.Drawing.Color]::FromArgb(255, 239, 68, 68))
$brushRight = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.Point]::new(640, 0), [System.Drawing.Point]::new(1280, 720), [System.Drawing.Color]::FromArgb(255, 30, 58, 186), [System.Drawing.Color]::FromArgb(255, 6, 182, 212))

$pointsLeft = @(
    [System.Drawing.Point]::new(0, 0),
    [System.Drawing.Point]::new(750, 0),
    [System.Drawing.Point]::new(530, 720),
    [System.Drawing.Point]::new(0, 720)
)
$g.FillPolygon($brushLeft, $pointsLeft)

$pointsRight = @(
    [System.Drawing.Point]::new(750, 0),
    [System.Drawing.Point]::new(1280, 0),
    [System.Drawing.Point]::new(1280, 720),
    [System.Drawing.Point]::new(530, 720)
)
$g.FillPolygon($brushRight, $pointsRight)

# 2. Stripes
$stripeBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(10, 255, 255, 255))
for ($i = -100; $i -lt 1380; $i += 80) {
    $pts = @(
        [System.Drawing.Point]::new($i, 0),
        [System.Drawing.Point]::new($i + 30, 0),
        [System.Drawing.Point]::new($i - 170, 720),
        [System.Drawing.Point]::new($i - 200, 720)
    )
    $g.FillPolygon($stripeBrush, $pts)
}

# 3. Grid
$gridPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(12, 255, 255, 255), 1)
for ($x = 0; $x -lt 1280; $x += 60) {
    $g.DrawLine($gridPen, $x, 0, $x, 720)
}
for ($y = 0; $y -lt 720; $y += 60) {
    $g.DrawLine($gridPen, 0, $y, 1280, $y)
}

# 4. Scanlines
$scanPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(25, 0, 0, 0), 1)
for ($y = 0; $y -lt 720; $y += 4) {
    $g.DrawLine($scanPen, 0, $y, 1280, $y)
}

# 5. Boss Image
if (Test-Path $bossPath) {
    $bossBmp = [System.Drawing.Image]::FromFile($bossPath)
    $g.Save() | Out-Null
    $clipPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $clipPath.AddPolygon($pointsLeft) | Out-Null
    $g.SetClip($clipPath)
    $bossW = 900
    $bossH = [int]($bossW * ($bossBmp.Height / $bossBmp.Width))
    $bx = 350 - ($bossW / 2)
    $by = 360 - ($bossH / 2)
    $g.DrawImage($bossBmp, [float]$bx, [float]$by, [float]$bossW, [float]$bossH)
    $g.ResetClip()
    $bossBmp.Dispose()
}

# 6. Self Image with Shield Path
if (Test-Path $selfPath) {
    $selfBmp = [System.Drawing.Image]::FromFile($selfPath)
    $g.Save() | Out-Null
    $sx = 960; $sy = 360; $sw = 380; $sh = 480
    $shieldPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $shieldPath.StartFigure() | Out-Null
    $ptsShield = @(
        [System.Drawing.PointF]::new($sx, $sy - $sh/2),
        [System.Drawing.PointF]::new($sx + $sw/2, $sy - $sh/3),
        [System.Drawing.PointF]::new($sx + $sw/2, $sy + $sh/6),
        [System.Drawing.PointF]::new($sx, $sy + $sh/2),
        [System.Drawing.PointF]::new($sx - $sw/2, $sy + $sh/6),
        [System.Drawing.PointF]::new($sx - $sw/2, $sy - $sh/3)
    )
    $shieldPath.AddPolygon($ptsShield) | Out-Null
    $g.SetClip($shieldPath)
    $selfW = 700
    $selfH = [int]($selfW * ($selfBmp.Height / $selfBmp.Width))
    $s_pos_x = 960 - ($selfW / 2)
    $s_pos_y = 360 - ($selfH / 2)
    $g.DrawImage($selfBmp, [float]$s_pos_x, [float]$s_pos_y, [float]$selfW, [float]$selfH)
    $g.ResetClip()
    $borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 250, 204, 21), 8)
    $g.DrawPolygon($borderPen, $ptsShield) | Out-Null
    $selfBmp.Dispose()
}

# 7. Center Border
$borderPenMain = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 250, 204, 21), 8)
$g.DrawLine($borderPenMain, 750, 0, 530, 720)

# 8. Text Rendering
# Safe Font Loading
$vsFont = $null
$mainFont = $null
$subFont = $null

try { $vsFont = [System.Drawing.Font]::new("Impact", 120, [System.Drawing.FontStyle]::Bold -bor [System.Drawing.FontStyle]::Italic) } catch { $vsFont = [System.Drawing.Font]::new("Arial", 120, [System.Drawing.FontStyle]::Bold) }
try { $mainFont = [System.Drawing.Font]::new("MS Gothic", 80, [System.Drawing.FontStyle]::Bold) } catch { $mainFont = [System.Drawing.Font]::new("Arial", 80, [System.Drawing.FontStyle]::Bold) }
try { $subFont = [System.Drawing.Font]::new("Impact", 60, [System.Drawing.FontStyle]::Bold) } catch { $subFont = [System.Drawing.Font]::new("Arial", 60, [System.Drawing.FontStyle]::Bold) }

$sf = [System.Drawing.StringFormat]::new()
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center

# VS Text
$vsX = 640; $vsY = 360
$borderBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 15, 23, 42))
for ($dx = -6; $dx -le 6; $dx += 3) {
    for ($dy = -6; $dy -le 6; $dy += 3) {
        $g.DrawString("VS", $vsFont, $borderBrush, [System.Drawing.PointF]::new($vsX + $dx, $vsY + $dy), $sf)
    }
}
$vsBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 251, 191, 36))
$g.DrawString("VS", $vsFont, $vsBrush, [System.Drawing.PointF]::new($vsX, $vsY), $sf)

# Title Text
$mainTextBytes = [byte[]](227,130,184, 227,130,167, 227,131,188, 227,131,171, 86, 50, 53)
$titleMain = [System.Text.Encoding]::UTF8.GetString($mainTextBytes)
$tx = 640; $ty = 560
for ($dx = -6; $dx -le 6; $dx += 2) {
    for ($dy = -6; $dy -le 6; $dy += 2) {
        $g.DrawString($titleMain, $mainFont, $borderBrush, [System.Drawing.PointF]::new($tx + $dx, $ty + $dy), $sf)
    }
}
$textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 250, 204, 21))
$g.DrawString($titleMain, $mainFont, $textBrush, [System.Drawing.PointF]::new($tx, $ty), $sf)

# Subtitle Text "Bumba"
$titleSub = "Bumba"
$sx_sub = 640; $sy_sub = 640
for ($dx = -5; $dx -le 5; $dx += 2) {
    for ($dy = -5; $dy -le 5; $dy += 2) {
        $g.DrawString($titleSub, $subFont, $borderBrush, [System.Drawing.PointF]::new($sx_sub + $dx, $sy_sub + $dy), $sf)
    }
}
$subBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$g.DrawString($titleSub, $subFont, $subBrush, [System.Drawing.PointF]::new($sx_sub, $sy_sub), $sf)

# Save Image
$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Release Resources
$g.Dispose()
$bmp.Dispose()

Write-Host "Success"
