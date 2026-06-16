$src = "C:\Users\user\.gemini\antigravity\brain\36b7448c-7769-4b0d-a32d-5d46e914060b\bikkuriman_hunter_bow_1781526154304.png"
$out = "C:\Users\user\.gemini\antigravity\brain\36b7448c-7769-4b0d-a32d-5d46e914060b\bikkuriman_hunter_bow_yuuchin.png"
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($src)
$gfx = [System.Drawing.Graphics]::FromImage($img)
$gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$fontTop = New-Object System.Drawing.Font('Arial',80,[System.Drawing.FontStyle]::Bold)
$fontBottom = New-Object System.Drawing.Font('Arial',60,[System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,255,215,0))
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = 'Center'
# Draw top text
$gfx.DrawString('Yuuchin',$fontTop,$brush,$img.Width/2,20,$sf)
# Draw bottom text
$gfx.DrawString('狩人',$fontBottom,$brush,$img.Width/2,$img.Height-80,$sf)
$img.Save($out)
$gfx.Dispose()
$img.Dispose()
Write-Host "Overlay completed: $out"
