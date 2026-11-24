$adb = 'C:\Users\joysr\AppData\Local\Android\Sdk\platform-tools\adb.exe'
Start-Sleep -Seconds 12
& $adb shell uiautomator dump /sdcard/ui.xml
& $adb pull /sdcard/ui.xml emulator-ui.xml | Out-Null
& $adb exec-out screencap -p > emulator-shot.png
Write-Output 'dump+shot done'
