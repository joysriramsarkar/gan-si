$avdName = 'gansi'
$androidHome = "$env:USERPROFILE\.android"
$avdDir = "$androidHome\avd\$avdName.avd"
New-Item -ItemType Directory -Force -Path $avdDir | Out-Null
@"
avd.ini.encoding=UTF-8
path=$avdDir
path.rel=avd/$avdName.avd
target=android-34
"@ | Set-Content "$androidHome\avd\$avdName.ini" -Encoding UTF8
@"
avd.ini.encoding=UTF-8
AvdId=$avdName
PlayStore.enabled=false
abi.type=x86_64
avd.ini.displayname=Gan-si Test
disk.dataPartition.size=4G
fastboot.chosenSnapshotFile=
fastboot.forceChosenSnapshotBoot=no
fastboot.forceColdBoot=no
fastboot.forceFastBoot=yes
hw.accelerometer=yes
hw.arc=false
hw.audioInput=yes
hw.audioOutput=yes
hw.battery=yes
hw.camera.back=virtualscene
hw.camera.front=emulated
hw.cpu.arch=x86_64
hw.cpu.ncore=4
hw.dPad=no
hw.device.hash2=MD5:3db6f5c57fd74c070f30b8aa36b40c7a
hw.device.manufacturer=Google
hw.device.name=pixel_7
hw.gps=yes
hw.gpu.enabled=yes
hw.gpu.mode=swiftshader_indirect
hw.initialOrientation=Portrait
hw.keyboard=yes
hw.lcd.density=420
hw.lcd.height=2400
hw.lcd.width=1080
hw.mainKeys=no
hw.ramSize=4096
hw.sdCard=yes
hw.sensors.light=yes
hw.sensors.pressure=yes
hw.sensors.proximity=yes
hw.trackBall=no
hw.vmHeapSize=228
image.sysdir.1=system-images/android-34/google_apis/x86_64/
runtime.network.latency=none
runtime.network.speed=full
sdcard.size=512M
showDeviceFrame=no
skin.dynamic=yes
skin.name=1080x2400
skin.path=1080x2400
snapshot.present=false
tag.display=Google APIs
tag.id=google_apis
vm.heapSize=228
"@ | Set-Content "$avdDir\config.ini" -Encoding UTF8
Write-Output "AVD created at $avdDir"
