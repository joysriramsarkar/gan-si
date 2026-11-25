# Android App — Build ও Device Test Report

> **Status (2026-11-25, এই মেশিনে যাচাইকৃত):** ✅ v2.4.0 (versionCode 10) `assembleDebug` BUILD SUCCESSFUL → `android/app/build/outputs/apk/debug/app-debug.apk` (5,393,737 bytes ≈ 5.14MB)

## পরিবেশ (যাচাইকৃত)
- Java: Temurin 21.0.11 (LTS)
- SDK: `%LOCALAPPDATA%\Android\Sdk` (platforms 33–37, build-tools 34–37, emulator, cmdline-tools 12.0)
- Emulator image: `system-images;android-34;google_apis;x86_64` + AVD `gansi` (Pixel 7, 1080x2400)

## Build (পুনরাবৃত্তি)
```powershell
npm install
npm run android:build
# APK: android\app\build\outputs\apk\debug\app-debug.apk
```

## Native প্যাচ (কেন দরকার ছিল)
- `AndroidManifest.xml`: `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` + microphone feature (WebView `getUserMedia`-এর জন্য বাধ্যতামূলক)
- `MainActivity.java`: `BridgeWebChromeClient.onPermissionRequest` override → `request.grant(...)`, নইলে permission request নীরবে deny হয়
- Icons/splash: `@capacitor/assets` দিয়ে `assets/icon.png` + `assets/splash.png` থেকে 87 ফাইল generated

## v2.2 Web Assets
- Minimalist Material UI: warm paper surfaces, clay accent, soft elevation, reusable SVG icons
- Sticky pill tabs, mobile-safe header, stacked recording rows, contained modals
- Default Paper theme + Gold/Sunset/Wood/optional Dark; theme-aware pitch canvas
- SW v11 network-first + one-time migration reload: bundled raga/alankar/theory offline fallback; stats/users/recordings কখনো cache নয়
- `npm run sync:data` canonical `data/*.json` → `public/data/*.json`; Android build স্বয়ংক্রিয়ভাবে sync করে
- Accessibility: zoom, labels, keyboard tabs, contrast
- Build-এর আগে `npx cap sync android` চালানো বাধ্যতামূলক

## Device পরীক্ষা (AVD `gansi` — এই মেশিনে যাচাইকৃত ✅)
```powershell
adb install android\app\build\outputs\apk\debug\app-debug.apk     # Success (streamed install)
adb shell pm grant com.gansi.sursadhana android.permission.RECORD_AUDIO
adb shell monkey -p com.gansi.sursadhana -c android.intent.category.LAUNCHER 1
```
| পরীক্ষা | ফলাফল |
|---|---|
| APK install | ✅ Success (clean uninstall + install) |
| Launch + render | ✅ MainActivity focused; ১০ ট্যাব ও v2.1 assets load |
| Bundled offline data | ✅ Backend ছাড়াই ১০টি রাগ card load (`RAGA_CARDS=10`) |
| Raga Learning UI | ✅ `RagaLearning=true`, Bhoopali lesson ready/visible |
| Mic start (CDP) | ✅ `pitchDetector.isListening === true` |
| Backup default | ✅ `cloudBackupToggle.checked === false` |
| Pitch value | ⚠️ এমুলেটরে virtual mic নীরব → আসল ডিভাইসে যাচাই করতে হবে |
| Tanpura on/off (CDP) | ✅ আগের v2.0 device test-এ `true→false` verified |
| JS errors | ✅ আমাদের WebView প্রসেসে কোনো Uncaught নেই; শুধু Capacitor safe-area/GMS noise |
| `/api/*` | ⚠️ Native-এ relative API URL serve হয় না; production backend লাগবে। Bundled fallback থাকায় content offline খোলে |

- [x] APK install সফল
- [x] App launch — “সুর সাধনা” UI render (screenshot দিয়ে নিশ্চিত)
- [x] Mic permission: manifest + runtime grant + WebChromeClient grant (CDP দিয়ে start প্রমাণিত)
- [ ] Bluetooth latency / background-audio / আসল mic-এ pitch: আসল ডিভাইসে মাপতে হবে (এমুলেটরে অর্থহীন)

## API নোট
Native WebView-এ relative `/api/*` URL কাজ করে না — production-এ backend deploy করে `capacitor.config.json`-এ `server.url` বসান, অথবা PWA হিসেবে same-origin serve করুন। Offline-এ tanpura/harmonium/tabla/pitch/ear-training এবং bundled raga/alankar/theory content চলে; stats/account/recording-server সংযোগ ফিরলে sync হয়।
