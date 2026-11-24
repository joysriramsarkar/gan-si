$adb = 'C:\Users\joysr\AppData\Local\Android\Sdk\platform-tools\adb.exe'
for ($i = 0; $i -lt 100; $i++) {
  $v = (& $adb shell getprop sys.boot_completed) -join ''
  if ($v.Trim() -eq '1') { Write-Output 'BOOTED'; break }
  Start-Sleep -Seconds 5
}
if ($v.Trim() -ne '1') { Write-Output 'TIMEOUT'; exit 1 }
