$adb = 'C:\Users\joysr\AppData\Local\Android\Sdk\platform-tools\adb.exe'
& $adb shell am start -n com.gansi.sursadhana/.MainActivity
Start-Sleep -Seconds 14
$appPid = ((& $adb shell pidof com.gansi.sursadhana) -join '').Trim()
Write-Output "APP_PID=$appPid"
& $adb shell dumpsys window | Select-String -Pattern 'mCurrentFocus|mFocusedApp' | Select-Object -First 4
& $adb shell screencap -p /sdcard/shot2.png
& $adb pull /sdcard/shot2.png emulator-shot2.png
& $adb logcat -d | Select-String -Pattern 'Uncaught|chromium.*(ERROR|error)|Capacitor.*(started|local request: https://localhost/$)' | Select-Object -Last 12
