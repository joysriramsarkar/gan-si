$adb = 'C:\Users\joysr\AppData\Local\Android\Sdk\platform-tools\adb.exe'
$pid = (& $adb shell pidof com.gansi.sursadhana) -join ''
Write-Output "PID=$pid"
& $adb logcat -d | Select-String -Pattern 'Capacitor|WebView|chromium|gansi' | Select-Object -Last 25
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile("$pwd\emulator-shot.png")
$w = 480; $h = [int]($src.Height * $w / $src.Width)
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($src, 0, 0, $w, $h)
$bmp.Save("$pwd\emulator-shot-small.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)
$g.Dispose(); $bmp.Dispose(); $src.Dispose()
Write-Output 'thumb saved'
