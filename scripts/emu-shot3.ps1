$adb = 'C:\Users\joysr\AppData\Local\Android\Sdk\platform-tools\adb.exe'
& $adb shell screencap -p /sdcard/shot3.png
& $adb pull /sdcard/shot3.png emulator-shot3.png
& $adb shell dumpsys window | Select-String -Pattern 'mCurrentFocus' | Select-Object -First 2
