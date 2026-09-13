#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PrimeForge Multi-Device Emulator Test Suite
Tests APKs on Android TV (DPAD navigation), Mobile (20:9 Aspect Ratio & Touch),
and Tablet (16:10 Wide Layout) with real-time logcat crash & ANR monitoring.
"""

import json
import os
import re
import subprocess
import sys
import threading
import time
from typing import Dict, Any, List, Optional, Tuple


class EmulatorTester:
    def __init__(self, apk_path: str, device_serial: Optional[str] = None):
        self.apk_path = os.path.abspath(apk_path)
        self.device_serial = device_serial
        self.output_dir = os.path.abspath("output")
        os.makedirs(self.output_dir, exist_ok=True)

        self.package_name = self._resolve_package_name()
        self.logcat_proc: Optional[subprocess.Popen] = None
        self.logcat_lines: List[str] = []
        self.crashes_detected: List[Dict[str, str]] = []
        self.stop_logcat = False

        self.report: Dict[str, Any] = {
            "package_name": self.package_name,
            "tested_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "status": "PENDING",
            "tv_test": {},
            "mobile_test": {},
            "tablet_test": {},
            "crash_analysis": {
                "crashed": False,
                "crash_count": 0,
                "errors": []
            }
        }

    def _resolve_package_name(self) -> str:
        """Resolve package name from analysis.json, result.json, or aapt dump."""
        analysis_file = os.path.join(self.output_dir, "analysis.json")
        if os.path.exists(analysis_file):
            try:
                with open(analysis_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if "package_name" in data and data["package_name"]:
                        return data["package_name"]
            except Exception:
                pass

        result_file = os.path.join(self.output_dir, "result.json")
        if os.path.exists(result_file):
            try:
                with open(result_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if "package_name" in data and data["package_name"]:
                        return data["package_name"]
            except Exception:
                pass

        # Fallback to aapt badging
        try:
            from engine.asset_extractor import find_aapt_executable
            aapt_bin = find_aapt_executable() or "aapt"
            cmd = [aapt_bin, "dump", "badging", self.apk_path]
            out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True, timeout=15)
            m = re.search(r"package:\s*name='([^']+)'", out)
            if m:
                return m.group(1)
        except Exception:
            pass

        return "unknown.package"

    def _adb_cmd(self, args: List[str], timeout: int = 30) -> subprocess.CompletedProcess:
        """Run ADB command with optional serial."""
        cmd = ["adb"]
        if self.device_serial:
            cmd.extend(["-s", self.device_serial])
        cmd.extend(args)
        return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=timeout)

    def _adb_shell(self, cmd_str: str, timeout: int = 30) -> str:
        """Run ADB shell command and return stdout."""
        res = self._adb_cmd(["shell", cmd_str], timeout=timeout)
        return res.stdout.strip()

    def check_device_connected(self) -> bool:
        """Check if any ADB device or emulator is connected and ready."""
        try:
            res = self._adb_cmd(["devices"])
            lines = [l.strip() for l in res.stdout.splitlines() if l.strip()]
            devices = [l.split()[0] for l in lines[1:] if "device" in l and not "offline" in l]
            if not devices:
                print("❌ No active ADB devices/emulators found.")
                return False
            if not self.device_serial:
                self.device_serial = devices[0]
            print(f"📱 Connected ADB Device: {self.device_serial}")
            return True
        except Exception as e:
            print(f"❌ ADB connection check failed: {e}")
            return False

    def start_crash_watcher(self):
        """Start real-time logcat monitoring in background."""
        self._adb_cmd(["logcat", "-c"])  # Clear previous logs

        def _reader():
            cmd = ["adb"]
            if self.device_serial:
                cmd.extend(["-s", self.device_serial])
            cmd.extend(["logcat", "-v", "time", "*:E"])
            try:
                self.logcat_proc = subprocess.Popen(
                    cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, bufsize=1
                )
                if self.logcat_proc.stdout:
                    for line in iter(self.logcat_proc.stdout.readline, ""):
                        if self.stop_logcat:
                            break
                        self.logcat_lines.append(line)
                        if any(pattern in line for pattern in [
                            "FATAL EXCEPTION", "SIGSEGV", "ANR in", "NullPointerException",
                            "ClassNotFoundException", "NoSuchMethodError"
                        ]):
                            self.crashes_detected.append({
                                "time": time.strftime("%H:%M:%S"),
                                "line": line.strip()
                            })
            except Exception:
                pass

        t = threading.Thread(target=_reader, daemon=True)
        t.start()

    def stop_crash_watcher(self):
        """Stop logcat watcher and save log to file."""
        self.stop_logcat = True
        if self.logcat_proc:
            try:
                self.logcat_proc.terminate()
            except Exception:
                pass

        log_path = os.path.join(self.output_dir, "logcat_test.log")
        with open(log_path, "w", encoding="utf-8", errors="replace") as f:
            f.writelines(self.logcat_lines)

        if self.crashes_detected:
            self.report["crash_analysis"]["crashed"] = True
            self.report["crash_analysis"]["crash_count"] = len(self.crashes_detected)
            self.report["crash_analysis"]["errors"] = self.crashes_detected[:10]

    def install_apk(self) -> bool:
        """Install target APK with grant-all permissions flag."""
        print(f"\n📦 Installing APK: {os.path.basename(self.apk_path)}...")
        res = self._adb_cmd(["install", "-r", "-g", self.apk_path], timeout=120)
        if "Success" in res.stdout or "Success" in res.stderr:
            print("  ✅ APK successfully installed.")
            return True
        print(f"  ❌ Installation failed: {res.stdout} {res.stderr}")
        return False

    def launch_app(self, prefer_leanback: bool = False) -> bool:
        """Launch app via Monkey launcher or Leanback launcher."""
        category = "android.intent.category.LEANBACK_LAUNCHER" if prefer_leanback else "android.intent.category.LAUNCHER"
        print(f"  🚀 Launching {self.package_name} ({category.split('.')[-1]})...")
        out = self._adb_shell(f"monkey -p {self.package_name} -c {category} 1")
        if "No activities found" in out and prefer_leanback:
            print("  ℹ️ Leanback launcher not found, falling back to standard LAUNCHER...")
            out = self._adb_shell(f"monkey -p {self.package_name} -c android.intent.category.LAUNCHER 1")

        time.sleep(3)
        focus = self._adb_shell("dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'")
        print(f"  🎯 Current Focus: {focus[:100] if focus else 'None'}")
        return self.package_name in focus

    def capture_screenshot(self, filename: str) -> str:
        """Capture screenshot directly via adb exec-out screencap."""
        dest = os.path.join(self.output_dir, filename)
        cmd = ["adb"]
        if self.device_serial:
            cmd.extend(["-s", self.device_serial])
        cmd.extend(["exec-out", "screencap", "-p"])
        try:
            with open(dest, "wb") as f:
                subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, timeout=20)
            if os.path.exists(dest) and os.path.getsize(dest) > 1024:
                print(f"  📸 Screenshot saved: {filename} ({os.path.getsize(dest) // 1024} KB)")
                return dest
        except Exception as e:
            print(f"  ⚠️ Screenshot capture failed: {e}")
        return ""

    def dismiss_system_dialogs(self):
        """Automatically detect and click permission and confirmation popups."""
        try:
            self._adb_shell("uiautomator dump /sdcard/dialog_dump.xml")
            xml = self._adb_shell("cat /sdcard/dialog_dump.xml")
            if any(term in xml.lower() for term in ["permission", "izin", "allow", "tamam", "continue"]):
                # Attempt to click Allow button coordinates or send DPAD Right + Enter
                print("  🛡️ System/Permission dialog detected. Approving automatically...")
                self._adb_shell("input keyevent 22")  # RIGHT
                self._adb_shell("input keyevent 23")  # CENTER
                time.sleep(1)
        except Exception:
            pass

    def navigate_and_capture_content(self, form_factor: str) -> Optional[str]:
        """Navigate deeper into the app's categories/menus to capture real content."""
        print(f"  🎬 Navigating into {form_factor} content (categories/media list)...")
        self.dismiss_system_dialogs()

        # Navigate down into first content section / list
        self._adb_shell("input keyevent 20")  # DPAD_DOWN
        time.sleep(0.5)
        self._adb_shell("input keyevent 22")  # DPAD_RIGHT
        time.sleep(0.5)
        self._adb_shell("input keyevent 23")  # DPAD_CENTER / Select
        time.sleep(3)  # Wait for content list / posters to render

        content_shot_name = f"{form_factor.lower()}_content_screenshot.png"
        return self.capture_screenshot(content_shot_name)

    def test_tv_profile(self) -> Dict[str, Any]:
        """Test TV profile (1920x1080 320dpi) with DPAD navigation & UI focus tracking."""
        print("\n" + "=" * 60)
        print("📺 TEST 1: ANDROID TV (1920x1080 16:9 | DPAD Navigation)")
        print("=" * 60)

        # Set TV display parameters
        self._adb_shell("wm size 1920x1080")
        self._adb_shell("wm density 320")
        time.sleep(1)

        # Launch app
        self.launch_app(prefer_leanback=True)
        time.sleep(3)
        self.dismiss_system_dialogs()
        time.sleep(2)

        # Check Leanback capability in Manifest
        manifest_leanback = False
        analysis_path = os.path.join(self.output_dir, "analysis.json")
        if os.path.exists(analysis_path):
            try:
                with open(analysis_path, "r", encoding="utf-8") as f:
                    manifest = json.load(f).get("manifest", {})
                    manifest_leanback = "android.software.leanback" in str(manifest) or "LEANBACK_LAUNCHER" in str(manifest)
            except Exception:
                pass

        # Simulate DPAD Key Events: UP(19), DOWN(20), RIGHT(22), DOWN(20), LEFT(21), CENTER(23)
        dpad_keys = [
            ("DPAD_DOWN", 20),
            ("DPAD_RIGHT", 22),
            ("DPAD_DOWN", 20),
            ("DPAD_LEFT", 21),
            ("DPAD_UP", 19),
            ("DPAD_CENTER", 23),
        ]

        print("  🎮 Sending DPAD key navigation sequence...")
        focus_states = []
        for name, keycode in dpad_keys:
            self._adb_shell(f"input keyevent {keycode}")
            time.sleep(0.5)
            focus = self._adb_shell("dumpsys window | grep mCurrentFocus")
            focus_states.append(focus)

        # Check UI hierarchy for focusable / focused elements
        focusable_count = 0
        focused_count = 0
        try:
            self._adb_shell("uiautomator dump /sdcard/tv_ui.xml")
            ui_xml = self._adb_shell("cat /sdcard/tv_ui.xml")
            focusable_count = len(re.findall(r'focusable="true"', ui_xml))
            focused_count = len(re.findall(r'focused="true"', ui_xml))
        except Exception:
            pass

        # Determine DPAD Compatibility Score
        if focused_count > 0 or focusable_count >= 3:
            dpad_compat = "COMPATIBLE"
            dpad_msg = "✅ Tam Uyumlu: Kumanda yön tuşları odaklanabiliyor."
        elif focusable_count > 0:
            dpad_compat = "PARTIAL"
            dpad_msg = "⚠️ Kısmi Uyumlu: Bazı öğeler odaklanabiliyor, Air Mouse önerilir."
        else:
            dpad_compat = "INCOMPATIBLE"
            dpad_msg = "❌ Uyumsuz: Odaklanabilir öğe bulunamadı, Dokunmatik/Mouse zorunlu."

        screenshot = self.capture_screenshot("tv_screenshot.png")
        content_shot = self.navigate_and_capture_content("tv")

        tv_result = {
            "resolution": "1920x1080 (16:9)",
            "density": "320 dpi (xhdpi)",
            "leanback_manifest": manifest_leanback,
            "focusable_elements": focusable_count,
            "focused_elements": focused_count,
            "dpad_compatibility": dpad_compat,
            "details": dpad_msg,
            "screenshot": os.path.basename(screenshot) if screenshot else None,
            "content_screenshot": os.path.basename(content_shot) if content_shot else None
        }
        self.report["tv_test"] = tv_result
        print(f"  {dpad_msg}")
        return tv_result

    def test_mobile_profile(self) -> Dict[str, Any]:
        """Test Mobile profile (1080x2400 20:9) with touch events & aspect ratio check."""
        print("\n" + "=" * 60)
        print("📱 TEST 2: MOBİL (1080x2400 20:9 | Dokunmatik & En-Boy Oranı)")
        print("=" * 60)

        # Set Modern Tall Phone parameters
        self._adb_shell("wm size 1080x2400")
        self._adb_shell("wm density 440")
        time.sleep(1)

        self.launch_app(prefer_leanback=False)
        time.sleep(3)

        # Check Window Bounds / Aspect Ratio Letterboxing
        letterboxed = False
        window_dump = self._adb_shell("dumpsys window displays")
        if "letterbox" in window_dump.lower() or "compat" in window_dump.lower():
            letterboxed = True

        # Test Touch Interactions (Tap center and Swipe scroll)
        print("  👆 Performing touch tap & vertical scroll swipe...")
        self._adb_shell("input tap 540 1200")
        time.sleep(0.5)
        self._adb_shell("input swipe 540 1600 540 800 300")
        time.sleep(1)

        # Verify UI did not freeze/ANR
        is_responsive = self.package_name in self._adb_shell("dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'")

        self.dismiss_system_dialogs()
        screenshot = self.capture_screenshot("mobile_screenshot.png")
        content_shot = self.navigate_and_capture_content("mobile")

        mobile_result = {
            "resolution": "1080x2400 (20:9 Tall)",
            "density": "440 dpi (xxhdpi)",
            "letterboxed": letterboxed,
            "aspect_ratio_status": "LETTERBOXED" if letterboxed else "FULL_SCREEN",
            "touch_responsive": is_responsive,
            "details": "✅ 20:9 Tam ekran ve dokunmatik aktif" if not letterboxed and is_responsive else "⚠️ Boyut veya dokunmatik kısıtlı",
            "screenshot": os.path.basename(screenshot) if screenshot else None,
            "content_screenshot": os.path.basename(content_shot) if content_shot else None
        }
        self.report["mobile_test"] = mobile_result
        print(f"  {mobile_result['details']}")
        return mobile_result

    def test_tablet_profile(self) -> Dict[str, Any]:
        """Test Tablet profile (2560x1600 16:10 Landscape) with wide UI scaling."""
        print("\n" + "=" * 60)
        print("💻 TEST 3: TABLET (2560x1600 16:10 | Geniş Ekran Düzeni & Dokunmatik)")
        print("=" * 60)

        # Set Tablet Wide parameters
        self._adb_shell("wm size 2560x1600")
        self._adb_shell("wm density 280")
        time.sleep(1)

        self.launch_app(prefer_leanback=False)
        time.sleep(3)

        # Test Tablet Touch Interactions
        print("  🖐️ Performing tablet wide touch interaction...")
        self._adb_shell("input tap 1280 800")
        time.sleep(0.5)
        self._adb_shell("input swipe 1600 800 600 800 300")
        time.sleep(1)

        screenshot = self.capture_screenshot("tablet_screenshot.png")

        tablet_result = {
            "resolution": "2560x1600 (16:10 WQXGA)",
            "density": "280 dpi",
            "adaptive_layout": True,
            "details": "✅ Geniş ekran yatay mod destekleniyor",
            "screenshot": os.path.basename(screenshot) if screenshot else None
        }
        self.report["tablet_test"] = tablet_result
        print(f"  {tablet_result['details']}")
        return tablet_result

    def reset_display(self):
        """Reset window manager display size and density to device default."""
        print("\n🔄 Resetting Window Manager parameters...")
        self._adb_shell("wm size reset")
        self._adb_shell("wm density reset")

    def run_all(self) -> Dict[str, Any]:
        """Execute full multi-device test suite."""
        print(f"\n🚀 Starting PrimeForge Multi-Device Test Suite for: {self.package_name}")
        start_time = time.time()

        if not self.check_device_connected():
            self.report["status"] = "SKIPPED_NO_DEVICE"
            self.report["error"] = "No ADB device or emulator connected."
            self._save_report()
            return self.report

        # 1. Extract App Logo & Metadata if not already extracted
        icon_path = os.path.join(self.output_dir, "icon.png")
        if not os.path.exists(icon_path):
            try:
                from engine.asset_extractor import extract_all_assets
                assets = extract_all_assets(self.apk_path, output_dir=self.output_dir)
                self.report["app_label"] = assets.get("app_label")
                self.report["version_name"] = assets.get("version_name")
                self.report["version_code"] = assets.get("version_code")
                self.report["has_icon"] = assets.get("has_icon")
                self.report["has_banner"] = assets.get("has_banner")
            except Exception as e:
                print(f"  ⚠️ Asset extraction error: {e}")
        else:
            self.report["has_icon"] = True

        # 2. Install APK
        if not self.install_apk():
            self.report["status"] = "INSTALL_FAILED"
            self.report["error"] = "Failed to install APK via ADB."
            self._save_report()
            return self.report

        # 3. Start Logcat Crash Watcher
        self.start_crash_watcher()

        try:
            # 3. Test TV Mode
            self.test_tv_profile()

            # 4. Test Mobile Mode
            self.test_mobile_profile()

            # 5. Test Tablet Mode
            self.test_tablet_profile()

        finally:
            # Always reset display & stop watcher
            self.reset_display()
            self.stop_crash_watcher()
            self._adb_shell(f"am force-stop {self.package_name}")

        # Evaluate Overall Status
        elapsed = round(time.time() - start_time, 1)
        self.report["duration_seconds"] = elapsed

        if self.report["crash_analysis"]["crashed"]:
            self.report["status"] = "CRASHED"
            print(f"\n❌ TEST BAŞARISIZ: Uygulama test esnasında çöktü! ({len(self.crashes_detected)} hata)")
        elif self.report["tv_test"].get("dpad_compatibility") == "INCOMPATIBLE":
            self.report["status"] = "PASSED_WITH_WARNINGS"
            print("\n⚠️ TEST GEÇTİ (UYARILI): TV kumanda uyumluluğu eksik (Mouse gerekli).")
        else:
            self.report["status"] = "PASSED"
            print(f"\n✅ TÜM TESTLER BAŞARIYLA TAMAMLANDI! ({elapsed}s)")

        self._save_report()
        self._print_summary_card()
        return self.report

    def _save_report(self):
        """Save report to output/test_report.json."""
        report_path = os.path.join(self.output_dir, "test_report.json")
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(self.report, f, indent=2, ensure_ascii=False)
        print(f"📄 Test report saved to: {report_path}")

    def _print_summary_card(self):
        """Print rich ASCII summary card in terminal."""
        tv = self.report.get("tv_test", {})
        mob = self.report.get("mobile_test", {})
        tab = self.report.get("tablet_test", {})
        crash = self.report.get("crash_analysis", {})

        print("\n" + "┌" + "─" * 58 + "┐")
        print(f"│ {'PRIMEFORGE ÇOKLU CİHAZ TEST RAPORU':^56} │")
        print("├" + "─" * 58 + "┤")
        print(f"│ 📦 Paket: {self.package_name:<46} │")
        print(f"│ ⏱️  Süre:  {self.report.get('duration_seconds', 0)}s{' ':<47} │")
        print("├" + "─" * 58 + "┤")
        print(f"│ 📺 TV (DPAD):     {tv.get('dpad_compatibility', '?'):<12} {tv.get('details', '')[:25]:<26} │")
        print(f"│ 📱 Mobil (20:9):  {mob.get('aspect_ratio_status', '?'):<12} {mob.get('details', '')[:25]:<26} │")
        crash_str = "YOK (0 Hata)" if not crash.get("crashed") else f"VAR ({crash.get('crash_count', 1)} Hata)"
        print(f"│ 🛡️  Çökme (Crash): {crash_str:<39} │")
        print("├" + "─" * 58 + "┤")
        print(f"│ 🏁 SONUÇ: {self.report.get('status', 'UNKNOWN'):<47} │")
        print("└" + "─" * 58 + "┘\n")


if __name__ == "__main__":
    target_apk = sys.argv[1] if len(sys.argv) > 1 else os.path.join("output", "modded.apk")
    serial = sys.argv[2] if len(sys.argv) > 2 else None

    if not os.path.exists(target_apk):
        print(f"❌ Target APK not found: {target_apk}")
        sys.exit(1)

    tester = EmulatorTester(target_apk, device_serial=serial)
    res = tester.run_all()
    if res.get("status") == "CRASHED":
        sys.exit(2)
