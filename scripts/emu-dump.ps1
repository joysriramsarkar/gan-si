$adb = 'C:\Users\joysr\AppData\Local\Android\Sdk\platform-tools\adb.exe'
& $adb shell input keyevent KEYCODE_WAKEUP
& $adb shell input keyevent 82
Start-Sleep -Seconds 2
& $adb shell am start -n com.gansi.sursadhana/.MainActivity
Start-Sleep -Seconds 12
& $adb shell uiautomator dump /sdcard/ui.xml
& $adb pull /sdcard/ui.xml emulator-ui.xml
