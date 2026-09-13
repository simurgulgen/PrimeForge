# PrimeForge Local Android Emulator Setup Script (TV, Mobile, Tablet)
# Sets up Android SDK commandline-tools, accepts licenses, and creates 3 AVDs:
# 1. PrimeTV_AVD (Android TV 1080p, DPAD testing)
# 2. PrimeMobile_AVD (Pixel 6 1080x2400 20:9, Mobile Touch & Aspect Ratio)
# 3. PrimeTablet_AVD (Pixel Tablet / WQXGA 2560x1600 16:10, Wide layout)

param(
    [string]$SdkPath = "$env:LOCALAPPDATA\Android\Sdk"
)

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host " 🚀 PrimeForge Çoklu Cihaz Emülatör Kurulum Sihirbazı" -ForegroundColor Cyan
Write-Host "    (TV, Mobil ve Tablet Ortamları)" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

# 1. Detect or Create SDK Path
if (-not (Test-Path $SdkPath)) {
    Write-Host "📁 Android SDK dizini oluşturuluyor: $SdkPath" -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $SdkPath | Out-Null
} else {
    Write-Host "✅ Android SDK tespit edildi: $SdkPath" -ForegroundColor Green
}

$env:ANDROID_HOME = $SdkPath
$env:ANDROID_SDK_ROOT = $SdkPath

# 2. Check for cmdline-tools / sdkmanager
$cmdlineToolsDir = Join-Path $SdkPath "cmdline-tools\latest\bin"
$sdkmanager = Join-Path $cmdlineToolsDir "sdkmanager.bat"
$avdmanager = Join-Path $cmdlineToolsDir "avdmanager.bat"

if (-not (Test-Path $sdkmanager)) {
    Write-Host "⬇️  Android Command-line Tools indiriliyor..." -ForegroundColor Yellow
    $zipUrl = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
    $tempZip = Join-Path $env:TEMP "cmdline-tools.zip"
    
    Invoke-WebRequest -Uri $zipUrl -OutFile $tempZip -UseBasicParsing
    
    Write-Host "📦 Arşiv açılıyor..." -ForegroundColor Yellow
    $tempExtract = Join-Path $env:TEMP "cmdline-tools-extracted"
    Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force
    
    $targetLatest = Join-Path $SdkPath "cmdline-tools\latest"
    if (Test-Path $targetLatest) { Remove-Item -Recurse -Force $targetLatest }
    New-Item -ItemType Directory -Force -Path (Join-Path $SdkPath "cmdline-tools") | Out-Null
    Move-Item -Path (Join-Path $tempExtract "cmdline-tools") -Destination $targetLatest -Force
    
    Remove-Item -Force $tempZip -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $tempExtract -ErrorAction SilentlyContinue
    Write-Host "✅ Command-line Tools kuruldu." -ForegroundColor Green
}

# 3. Accept Licenses
Write-Host "`n📜 Android SDK lisansları onaylanıyor..." -ForegroundColor Yellow
& cmd.exe /c "echo y | `"$sdkmanager`" --licenses" | Out-Null

# 4. Install Components
Write-Host "`n⬇️  Gerekli paketler ve sistem imajları indiriliyor..." -ForegroundColor Yellow
Write-Host "   • Platform Tools (adb)"
Write-Host "   • Emulator"
Write-Host "   • Android TV x86_64 İmajı (API 30)"
Write-Host "   • Android Telefon x86_64 İmajı (API 30)"

& $sdkmanager "platform-tools" "emulator" "platforms;android-30" "system-images;android-30;google_atv;x86_64" "system-images;android-30;google_apis;x86_64"

# 5. Create AVDs
Write-Host "`n📱 AVD (Sanal Cihazlar) oluşturuluyor..." -ForegroundColor Yellow

# AVD 1: Android TV
Write-Host "   [1/3] PrimeTV_AVD (Android TV 1080p)..." -ForegroundColor Cyan
& cmd.exe /c "echo no | `"$avdmanager`" create avd -n PrimeTV_AVD -k `"system-images;android-30;google_atv;x86_64`" --device `"tv_1080p`" --force"

# AVD 2: Mobile Phone (Pixel 6 / 20:9)
Write-Host "   [2/3] PrimeMobile_AVD (Pixel 6 / 1080x2400)..." -ForegroundColor Cyan
& cmd.exe /c "echo no | `"$avdmanager`" create avd -n PrimeMobile_AVD -k `"system-images;android-30;google_apis;x86_64`" --device `"pixel_6`" --force"

# AVD 3: Tablet (10.1\" WQXGA / 2560x1600)
Write-Host "   [3/3] PrimeTablet_AVD (10.1 inç Tablet / 2560x1600)..." -ForegroundColor Cyan
& cmd.exe /c "echo no | `"$avdmanager`" create avd -n PrimeTablet_AVD -k `"system-images;android-30;google_apis;x86_64`" --device `"10.1in WQXGA (Tablet)`" --force"

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host " 🎉 Kurulum Tamamlandı! Oluşturulan Cihazlar:" -ForegroundColor Green
Write-Host "    1. PrimeTV_AVD      (Android TV - Kumanda & DPAD)" -ForegroundColor White
Write-Host "    2. PrimeMobile_AVD  (Telefon - 20:9 Dokunmatik)" -ForegroundColor White
Write-Host "    3. PrimeTablet_AVD  (Tablet - 16:10 Geniş Ekran)" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Green
Write-Host "`n💡 Emülatörleri başlatmak için:" -ForegroundColor Yellow
Write-Host "   & `"$SdkPath\emulator\emulator.exe`" -avd PrimeTV_AVD" -ForegroundColor Gray
Write-Host "   & `"$SdkPath\emulator\emulator.exe`" -avd PrimeMobile_AVD" -ForegroundColor Gray
Write-Host "   & `"$SdkPath\emulator\emulator.exe`" -avd PrimeTablet_AVD" -ForegroundColor Gray
Write-Host "`n🧪 Veya doğrudan test çalıştırmak için:" -ForegroundColor Yellow
Write-Host "   .\scripts\run_local_test.bat output\modded.apk`n" -ForegroundColor White
