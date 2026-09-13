@echo off
chcp 65001 >nul
echo ========================================================
echo   🚀 PrimeForge Çoklu Cihaz (TV/Mobil/Tablet) Testi
echo ========================================================
echo.

set TARGET_APK=%1
if "%TARGET_APK%"=="" set TARGET_APK=output\modded.apk

if not exist "%TARGET_APK%" (
    echo ❌ APK bulunamadı: %TARGET_APK%
    echo Kullanım: run_local_test.bat ^<apk_dosyası^>
    exit /b 1
)

echo 📦 Test Edilecek APK: %TARGET_APK%
echo 🔍 ADB Cihaz / Emülatör kontrol ediliyor...

adb devices | findstr /C:"device" >nul
if errorlevel 1 (
    echo ⚠️ Hiçbir aktif ADB cihazı veya emülatör bulunamadı!
    echo Lütfen önce bir emülatör veya cihaz bağlayın:
    echo   emulator -avd PrimeTV_AVD
    echo   veya USB hata ayıklama ile telefon/TV bağlayın.
    pause
    exit /b 1
)

echo ✅ Aktif cihaz tespit edildi. Test başlatılıyor...
echo.
python engine\emulator_tester.py "%TARGET_APK%"

echo.
echo ========================================================
echo 📄 Test Raporu: output\test_report.json
echo 📸 Ekran Görüntüleri:
echo    • output\tv_screenshot.png
echo    • output\mobile_screenshot.png
echo    • output\tablet_screenshot.png
echo 📋 Logcat Kayıtları: output\logcat_test.log
echo ========================================================
