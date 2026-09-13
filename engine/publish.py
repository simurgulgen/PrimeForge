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

    if job_id:
        try:
            update_job(job_id, {
                "status": "waiting_approval",
                "modded_apk_url": catbox_url,
                "modded_apk_hash": result["build"]["sha256"],
                "modded_apk_size": result["build"]["file_size"],
                "emulator_passed": True,
                "profile_used": result.get("profile_used"),
                "analysis_report": result.get("analysis"),
            })
            print("  📝 Job updated in Supabase")
        except Exception as e:
            print(f"  ⚠️ Job update failed: {e}")

    try:
        from telegram.bot import send_approval_request
        send_approval_request(result, catbox_url, job_id)
    except Exception as e:
        print(f"  ⚠️ Telegram notification failed: {e}")

    with open(os.path.join("output", "catbox_url.txt"), "w") as f:
        f.write(catbox_url)

    print(f"\n✅ Published! Waiting for approval.")
    print(f"  📦 {package_name}")
    print(f"  🔗 {catbox_url}")


if __name__ == "__main__":
    publish()
