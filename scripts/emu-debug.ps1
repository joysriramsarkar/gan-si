$adb = 'C:\Users\joysr\AppData\Local\Android\Sdk\platform-tools\adb.exe'
Write-Output '--- webview pkg ---'
& $adb shell dumpsys package com.google.android.webview | Select-String -Pattern 'versionName' | Select-Object -First 2
Write-Output '--- console messages (all) ---'
& $adb logcat -d | Select-String -Pattern 'CONSOLE|console\.|Uncaught|Failed to load|ERR_' | Select-Object -Last 20
Write-Output '--- splash/activity ---'
& $adb shell dumpsys activity activities | Select-String -Pattern 'Splash|Hist #|mResumed' | Select-Object -First 10
