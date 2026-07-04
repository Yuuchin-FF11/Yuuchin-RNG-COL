Add-Type -AssemblyName System.Drawing
$files = Get-ChildItem -Recurse -Filter "*.png"
foreach ($file in $files) {
    try {
        $img = [System.Drawing.Image]::FromFile($file.FullName)
        Write-Output "$($file.FullName): $($img.Width)x$($img.Height)"
        $img.Dispose()
    } catch {
        # Ignore
    }
}
