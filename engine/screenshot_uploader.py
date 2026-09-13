#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PrimeForge Screenshot Manager & Uploader
Collects all generated screenshots (TV, Mobile, Tablet, Content, Icon, Banner) from output/,
uploads them to Catbox, stores public URLs in Supabase forge_jobs, and sends multi-device
albums to Telegram.
"""

import os
import sys
import json
import glob
from typing import Dict, Optional, Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.uploader import upload_to_catbox
from engine.supabase_client import update_job


def collect_and_upload_screenshots(job_id: str = None, package_name: str = None, output_dir: str = "output") -> Dict[str, str]:
    """
    Finds all screenshot images in output/, uploads each to Catbox,
    and returns a mapping of device/screen type -> public Catbox URL.
    """
    job_id = job_id or os.environ.get("JOB_ID", "")
    os.makedirs(output_dir, exist_ok=True)

    screenshot_files = {
        "tv": os.path.join(output_dir, "tv_screenshot.png"),
        "tv_content": os.path.join(output_dir, "tv_content_screenshot.png"),
        "mobile": os.path.join(output_dir, "mobile_screenshot.png"),
        "mobile_content": os.path.join(output_dir, "mobile_content_screenshot.png"),
        "tablet": os.path.join(output_dir, "tablet_screenshot.png"),
        "emulator": os.path.join(output_dir, "emulator_screenshot.png"),
        "banner": os.path.join(output_dir, "banner.png"),
        "icon": os.path.join(output_dir, "icon.png"),
    }

    uploaded_urls: Dict[str, str] = {}
    print("\n📸 [Screenshot Uploader] Scanning output/ for device and content screenshots...")

    for key, path in screenshot_files.items():
        if os.path.exists(path) and os.path.getsize(path) > 100:
            try:
                print(f"  ☁️ Uploading {os.path.basename(path)} ({os.path.getsize(path) // 1024} KB) to Catbox...")
                url = upload_to_catbox(path)
                if url and url.startswith("http"):
                    uploaded_urls[key] = url
                    print(f"    ✅ Uploaded ({key}): {url}")
                else:
                    print(f"    ⚠️ Failed to upload {path}")
            except Exception as e:
                print(f"    ⚠️ Error uploading {path}: {e}")

    # Fallback to any other png screenshots in output
    for extra_png in glob.glob(os.path.join(output_dir, "*screenshot*.png")):
        base_name = os.path.splitext(os.path.basename(extra_png))[0]
        if base_name not in uploaded_urls:
            try:
                url = upload_to_catbox(extra_png)
                if url and url.startswith("http"):
                    uploaded_urls[base_name] = url
            except Exception:
                pass

    primary_screenshot_url = (
        uploaded_urls.get("tv")
        or uploaded_urls.get("tv_content")
        or uploaded_urls.get("mobile")
        or uploaded_urls.get("mobile_content")
        or uploaded_urls.get("tablet")
        or uploaded_urls.get("emulator")
        or uploaded_urls.get("banner")
        or uploaded_urls.get("icon")
    )

    # Save to local metadata file
    meta_path = os.path.join(output_dir, "screenshots.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({
            "primary_url": primary_screenshot_url,
            "screenshots": uploaded_urls,
            "job_id": job_id,
            "package_name": package_name
        }, f, indent=2)

    # Update Supabase forge_jobs record if job_id is present
    if job_id and job_id != "local" and primary_screenshot_url:
        try:
            # We also update analysis_report.screenshots so the web UI has the entire multi-device album
            from engine.supabase_client import get_job
            job_record = get_job(job_id) or {}
            analysis_data = job_record.get("analysis_report") or {}
            analysis_data["screenshots"] = uploaded_urls
            analysis_data["screenshot_url"] = primary_screenshot_url

            update_payload: Dict[str, Any] = {
                "screenshot_url": primary_screenshot_url,
                "analysis_report": analysis_data,
            }
            update_job(job_id, update_payload)
            print(f"  📝 Supabase job #{job_id} updated with {len(uploaded_urls)} screenshots.")
        except Exception as e:
            print(f"  ⚠️ Supabase screenshot update error: {e}")

    # Send multi-device photo album to Telegram
    if package_name:
        try:
            from telegram.bot import send_multi_device_screenshots
            send_multi_device_screenshots(package_name)
        except Exception as e:
            print(f"  ⚠️ Telegram screenshot dispatch warning: {e}")

    return uploaded_urls


if __name__ == "__main__":
    jid = sys.argv[1] if len(sys.argv) > 1 else ""
    pkg = sys.argv[2] if len(sys.argv) > 2 else ""
    collect_and_upload_screenshots(jid, pkg)
