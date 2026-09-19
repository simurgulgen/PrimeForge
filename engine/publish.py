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
    if os.environ.get("PIPELINE_PAUSED") == "true":
        print("⏸️ Pipeline is paused waiting for decision. Skipping publish step.")
        sys.exit(0)

    result_path = os.path.join("output", "result.json")
    if not os.path.exists(result_path):
        print("⚠️ No result.json found. Pipeline was either paused, cancelled or analyze-only.")
        sys.exit(0)

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

    # Upload all multi-device screenshots (TV, Mobile, Tablet, Icon, Banner)
    screenshot_url = None
    uploaded_shots = {}
    try:
        from engine.screenshot_uploader import collect_and_upload_screenshots
        uploaded_shots = collect_and_upload_screenshots(job_id, package_name)
        screenshot_url = uploaded_shots.get("tv") or uploaded_shots.get("mobile") or uploaded_shots.get("icon")
    except Exception as e:
        print(f"  ⚠️ Screenshot upload warning: {e}")

    # Create GitHub Release with screenshots, architectures, device types and modded APK
    github_release_url = None
    rel_asset_url = None
    rel_info = {}
    try:
        from engine.github_releaser import create_github_release
        rel_info = create_github_release(
            result=result,
            apk_path=apk_path,
            test_report=test_report,
            screenshots=uploaded_shots,
        )
        if rel_info.get("status") == "success":
            github_release_url = rel_info.get("html_url")
            rel_asset_url = rel_info.get("asset_url")
            print(f"  📦 GitHub Release created: {github_release_url}")
            with open(os.path.join("output", "release_url.txt"), "w") as rf:
                rf.write(github_release_url)
    except Exception as e:
        print(f"  ⚠️ GitHub Release creation warning: {e}")

    primary_download_url = catbox_url or rel_asset_url or github_release_url or ""

    if job_id:
        try:
            analysis_data = result.get("analysis", {})
            if test_report:
                analysis_data["emulator_test_report"] = test_report
            if uploaded_shots:
                analysis_data["screenshots"] = uploaded_shots
            if github_release_url:
                analysis_data["github_release_url"] = github_release_url

            update_payload = {
                "status": "waiting_approval",
                "modded_apk_url": primary_download_url,
                "modded_apk_hash": result["build"]["sha256"],
                "modded_apk_size": result["build"]["file_size"],
                "emulator_passed": emulator_passed,
                "profile_used": result.get("profile_used"),
                "analysis_report": analysis_data,
            }
            if screenshot_url:
                update_payload["screenshot_url"] = screenshot_url

            update_job(job_id, update_payload)
            print("  📝 Job updated in Supabase with emulator test report, screenshots & GitHub release")
        except Exception as e:
            print(f"  ⚠️ Job update failed: {e}")

    try:
        from telegram.bot import send_approval_request
        send_approval_request(result, primary_download_url, job_id, test_report=test_report)
    except Exception as e:
        print(f"  ⚠️ Telegram notification failed: {e}")

    with open(os.path.join("output", "catbox_url.txt"), "w") as f:
        f.write(primary_download_url)
    with open(os.path.join("output", "download_url.txt"), "w") as f:
        f.write(primary_download_url)

    print(f"\n✅ Published! Waiting for approval.")
    print(f"  📦 {package_name}")
    print(f"  🔗 {primary_download_url}")


if __name__ == "__main__":
    publish()
