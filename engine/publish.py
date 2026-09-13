#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Post-test publisher. Uploads modded APK to Catbox and updates Supabase."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.uploader import upload_to_catbox
from engine.supabase_client import update_job, find_listing_by_package, update_listing


def publish():
    result_path = os.path.join("output", "result.json")
    if not os.path.exists(result_path):
        print("❌ No result.json found.")
        sys.exit(1)

    with open(result_path, "r", encoding="utf-8") as f:
        result = json.load(f)

    apk_path = result["build"]["apk_path"]
    package_name = result["package_name"]
    job_id = os.environ.get("JOB_ID", "")

    print("\n☁️ Uploading to Catbox...")
    catbox_url = upload_to_catbox(apk_path)
    print(f"  URL: {catbox_url}")

    # Load multi-device test report if available
    test_report_path = os.path.join("output", "test_report.json")
    test_report = None
    emulator_passed = True
    if os.path.exists(test_report_path):
        try:
            with open(test_report_path, "r", encoding="utf-8") as f:
                test_report = json.load(f)
                emulator_passed = test_report.get("status") in ["PASSED", "PASSED_WITH_WARNINGS"]
        except Exception:
            pass

    if job_id:
        try:
            analysis_data = result.get("analysis", {})
            if test_report:
                analysis_data["emulator_test_report"] = test_report

            update_job(job_id, {
                "status": "waiting_approval",
                "modded_apk_url": catbox_url,
                "modded_apk_hash": result["build"]["sha256"],
                "modded_apk_size": result["build"]["file_size"],
                "emulator_passed": emulator_passed,
                "profile_used": result.get("profile_used"),
                "analysis_report": analysis_data,
            })
            print("  📝 Job updated in Supabase with emulator test report")
        except Exception as e:
            print(f"  ⚠️ Job update failed: {e}")

    try:
        from telegram.bot import send_approval_request
        send_approval_request(result, catbox_url, job_id, test_report=test_report)
    except Exception as e:
        print(f"  ⚠️ Telegram notification failed: {e}")

    with open(os.path.join("output", "catbox_url.txt"), "w") as f:
        f.write(catbox_url)

    print(f"\n✅ Published! Waiting for approval.")
    print(f"  📦 {package_name}")
    print(f"  🔗 {catbox_url}")


if __name__ == "__main__":
    publish()
