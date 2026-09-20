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

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

def main():
    target_apk = "output/modded.apk"
    if not os.path.isfile(target_apk):
        target_apk = "input.apk"

    if not os.path.isfile(target_apk):
        print("⚠️ No target APK found to test.")
        sys.exit(0)

    env = os.environ.copy()
    env["PYTHONPATH"] = PROJECT_ROOT

    print(f"🚀 Running PrimeForge Multi-Device Emulator Test Suite on {target_apk}...")
    try:
        subprocess.run([sys.executable, "engine/emulator_tester.py", target_apk], check=False, env=env)
    except Exception as e:
        print(f"⚠️ Error executing emulator_tester.py: {e}")

    job_id = os.environ.get("JOB_ID", "")
    package_name = os.environ.get("PACKAGE_NAME", "")
    try:
        subprocess.run([sys.executable, "engine/screenshot_uploader.py", job_id, package_name], check=False, env=env)
    except Exception as e:
        print(f"⚠️ Error executing screenshot_uploader.py: {e}")

    report_path = "output/test_report.json"
    if os.path.isfile(report_path):
        try:
            with open(report_path, "r", encoding="utf-8") as f:
                report = json.load(f)
            if report.get("status") == "CRASHED":
                print("❌ UYGULAMA ÇÖKTÜ!")
                pkg = report.get("package_name", package_name or "unknown")
                crash_log_path = "output/logcat_test.log"
                crash_snippet = ""
                if os.path.exists(crash_log_path):
                    try:
                        with open(crash_log_path, "r", encoding="utf-8", errors="ignore") as clf:
                            crash_snippet = clf.read()[-3000:]
                    except Exception:
                        pass

                # Update Supabase job status immediately so it does not stay in 'testing'
                if job_id and job_id != "local":
                    try:
                        from engine.supabase_client import update_job
                        crash_count = report.get("crash_analysis", {}).get("crash_count", 1)
                        errors = report.get("crash_analysis", {}).get("errors", [])
                        err_summary = errors[0].get("line", "") if errors else "Bilinmeyen çalışma zamanı çökmesi (SIGSEGV / Crash)"
                        update_job(job_id, {
                            "status": "failed",
                            "emulator_passed": False,
                            "error_message": f"Emülatör testi başarısız: Uygulama çöktü ({crash_count} çökme). {err_summary[:150]}",
                            "crash_log": crash_snippet,
                        })
                        print(f"📝 Supabase job #{job_id} durumu 'failed' (CRASHED) olarak güncellendi.")
                    except Exception as s_err:
                        print(f"⚠️ Supabase job update error: {s_err}")

                try:
                    subprocess.run([sys.executable, "telegram/bot.py", "crash", pkg, crash_log_path], check=False, env=env)
                except Exception as t_err:
                    print(f"⚠️ Telegram notification error: {t_err}")

                sys.exit(1)
            else:
                print("✅ Emulator testleri başarıyla tamamlandı (CRASH yok).")
        except Exception as e:
            print(f"⚠️ Error checking test_report.json: {e}")

if __name__ == "__main__":
    main()
