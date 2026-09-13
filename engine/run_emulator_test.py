#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PrimeForge Emulator Test Runner Wrapper
Runs emulator tests, collects screenshots, and checks crash status cleanly without shell parsing issues.
"""

import os
import sys
import json
import subprocess

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

def main():
    target_apk = "output/modded.apk"
    if not os.path.isfile(target_apk):
        target_apk = "input.apk"

    if not os.path.isfile(target_apk):
        print("⚠️ No target APK found to test.")
        sys.exit(0)

    print(f"🚀 Running PrimeForge Multi-Device Emulator Test Suite on {target_apk}...")
    try:
        subprocess.run([sys.executable, "engine/emulator_tester.py", target_apk], check=False)
    except Exception as e:
        print(f"⚠️ Error executing emulator_tester.py: {e}")

    job_id = os.environ.get("JOB_ID", "")
    package_name = os.environ.get("PACKAGE_NAME", "")
    try:
        subprocess.run([sys.executable, "engine/screenshot_uploader.py", job_id, package_name], check=False)
    except Exception as e:
        print(f"⚠️ Error executing screenshot_uploader.py: {e}")

    report_path = "output/test_report.json"
    if os.path.isfile(report_path):
        try:
            with open(report_path, "r", encoding="utf-8") as f:
                report = json.load(f)
            if report.get("status") == "CRASHED":
                print("❌ UYGULAMA ÇÖKTÜ!")
                pkg = report.get("package_name", "unknown")
                try:
                    subprocess.run([sys.executable, "telegram/bot.py", "crash", pkg, "output/logcat_test.log"], check=False)
                except Exception:
                    pass
                sys.exit(1)
            else:
                print("✅ Emulator testleri başarıyla tamamlandı (CRASH yok).")
        except Exception as e:
            print(f"⚠️ Error checking test_report.json: {e}")

if __name__ == "__main__":
    main()
