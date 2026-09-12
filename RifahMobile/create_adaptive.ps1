Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile('assets/barspa_app_icon.png')
$bmp = New-Object System.Drawing.Bitmap 1024, 1024
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::Transparent)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Scale to 66% (safe zone is inner 66%) -> 675x675
$scale = 0.66
$newWidth = [int](1024 * $scale)
$newHeight = [int](1024 * $scale)
$x = (1024 - $newWidth) / 2
$y = (1024 - $newHeight) / 2

$g.DrawImage($src, $x, $y, $newWidth, $newHeight)
$bmp.Save('assets/barspa_adaptive_icon.png', [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
$src.Dispose()
