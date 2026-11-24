# Android App — Build ও Device Test Report

> **Status (2026-11-24, এই মেশিনে যাচাইকৃত):** ✅ `assembleDebug` BUILD SUCCESSFUL → `android/app/build/outputs/apk/debug/app-debug.apk` (~5.1MB)

## পরিবেশ (যাচাইকৃত)
- Java: Temurin 21.0.11 (LTS)
- SDK: `%LOCALAPPDATA%\Android\Sdk` (platforms 33–37, build-tools 34–37, emulator, cmdline-tools 12.0)
- Emulator image: `system-images;android-34;google_apis;x86_64` + AVD `gansi` (Pixel 7, 1080x2400)

## Build (পুনরাবৃত্তি)
```powershell
npm install
npx cap sync android
cd android
.\gradlew.bat assembleDebug
# APK: android\app\build\outputs\apk\debug\app-debug.apk
```

## Native প্যাচ (কেন দরকার ছিল)
- `AndroidManifest.xml`: `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` + microphone feature (WebView `getUserMedia`-এর জন্য বাধ্যতামূলক)
- `MainActivity.java`: `BridgeWebChromeClient.onPermissionRequest` override → `request.grant(...)`, নইলে permission request নীরবে deny হয়
- Icons/splash: `@capacitor/assets` দিয়ে `assets/icon.png` + `assets/splash.png` থেকে 87 ফাইল generated

## Device পরীক্ষা (AVD `gansi` — এই মেশিনে যাচাইকৃত ✅)
```powershell
adb install android\app\build\outputs\apk\debug\app-debug.apk     # Success (streamed install)
adb shell pm grant com.gansi.sursadhana android.permission.RECORD_AUDIO
adb shell monkey -p com.gansi.sursadhana -c android.intent.category.LAUNCHER 1
```
| পরীক্ষা | ফলাফল |
|---|---|
| APK install | ✅ Success |
| Launch + render | ✅ MainActivity focused; “সুর সাধনা Pro” UI স্ক্রিনশটে নিশ্চিত (timer চলছে, ১০ ট্যাব, pitch monitor) |
| Mic start (CDP: `#startMicBtn` click) | ✅ বাটন → “⏹️ রেওয়াজ থামান”, `pitchDetector.isListening === true` (WebView permission grant কাজ করে) |
| Pitch value | ⚠️ এমুলেটরে virtual mic নীরব → সারগাম `--` (expected; আসল ডিভাইসে যাচাই করতে হবে) |
| Tanpura on/off (CDP) | ✅ `isTanpuraPlaying true→false`, বাটন toggle সঠিক |
| JS errors | ✅ আমাদের WebView প্রসেসে কোনো Uncaught নেই (শুধু emulator-GMS noise) |
| `/api/*` | ⚠️ Native-এ relative API URL → `https://localhost/api/...` serve হয় না (JSON parse fail, app gracefully handle করে) — production-এ backend deploy করে `server.url` বসান |

- [x] APK install সফল
- [x] App launch — “সুর সাধনা” UI render (screenshot দিয়ে নিশ্চিত)
- [x] Mic permission: manifest + runtime grant + WebChromeClient grant (CDP দিয়ে start প্রমাণিত)
- [ ] Bluetooth latency / background-audio / আসল mic-এ pitch: আসল ডিভাইসে মাপতে হবে (এমুলেটরে অর্থহীন)

## API নোট
Native WebView-এ relative `/api/*` URL কাজ করে না — production-এ backend deploy করে `capacitor.config.json`-এ `server.url` বসান, অথবা PWA হিসেবে same-origin serve করুন। Offline-এ tanpura/harmonium/tabla/pitch/ear-training চলে; stats/theory/recording-server সংযোগ ফিরলে sync হয়।
