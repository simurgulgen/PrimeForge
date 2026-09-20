#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PrimeForge Asset & Metadata Extractor
Extracts exact package name, version name, version code, application label,
high-resolution app icon (output/icon.png), and TV banner (output/banner.png).
"""

import json
import os
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile
from typing import Dict, Any, Optional, Tuple

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def find_aapt_executable() -> Optional[str]:
    """Find aapt or aapt2 executable across system PATH and Android SDK directories."""
    # 1. System PATH
    found = shutil.which("aapt") or shutil.which("aapt.exe")
    if found:
        return found

    # 2. Android SDK paths
    sdk_roots = []
    for env_var in ["ANDROID_HOME", "ANDROID_SDK_ROOT"]:
        val = os.environ.get(env_var)
        if val and os.path.exists(val):
            sdk_roots.append(val)

    if sys.platform == "win32":
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        if local_app_data:
            sdk_roots.append(os.path.join(local_app_data, "Android", "Sdk"))
        sdk_roots.append(r"C:\Android\Sdk")
    else:
        sdk_roots.extend([
            os.path.expanduser("~/Android/Sdk"),
            os.path.expanduser("~/Library/Android/sdk"),
            "/usr/lib/android-sdk",
            "/opt/android-sdk"
        ])

    for root in sdk_roots:
        bt_dir = os.path.join(root, "build-tools")
        if os.path.exists(bt_dir):
            try:
                versions = sorted(os.listdir(bt_dir), reverse=True)
                for v in versions:
                    exe_name = "aapt.exe" if sys.platform == "win32" else "aapt"
                    cand = os.path.join(bt_dir, v, exe_name)
                    if os.path.isfile(cand) and os.access(cand, os.X_OK if sys.platform != "win32" else os.F_OK):
                        return cand
            except Exception:
                pass
    return None


def extract_metadata_from_aapt(apk_path: str) -> Dict[str, Any]:
    """Extract precise metadata using aapt dump badging if available."""
    meta: Dict[str, Any] = {}
    aapt_bin = find_aapt_executable()
    if not aapt_bin:
        return meta

    try:
        res = subprocess.run(
            [aapt_bin, "dump", "badging", apk_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=20
        )
        out = res.stdout
        if out:
            # Package & Version
            pkg_m = re.search(r"package:\s*name='([^']+)'(?:\s+versionCode='([^']+)')?(?:\s+versionName='([^']+)')?", out)
            if pkg_m:
                meta["package_name"] = pkg_m.group(1)
                meta["version_code"] = pkg_m.group(2)
                meta["version_name"] = pkg_m.group(3)

            # Application Label
            label_m = re.search(r"application-label(?:-[a-zA-Z_-]+)?:\s*'([^']+)'", out)
            if label_m:
                meta["app_label"] = label_m.group(1)

            # Icon Paths (Collect highest density)
            icons = re.findall(r"application-icon-\d+:\s*'([^']+)'", out)
            if not icons:
                single_icon = re.search(r"application:\s*label='[^']*'\s*icon='([^']+)'", out)
                if single_icon:
                    icons = [single_icon.group(1)]
            if icons:
                # Prefer .png / .webp over .xml
                image_icons = [i for i in icons if i.endswith((".png", ".webp", ".jpg"))]
                meta["icon_path"] = image_icons[-1] if image_icons else icons[-1]

            # Banner
            banner_m = re.search(r"banner:\s*'([^']+)'", out)
            if banner_m:
                meta["banner_path"] = banner_m.group(1)

            # SDK targets
            sdk_m = re.search(r"sdkVersion:\s*'([^']+)'", out)
            if sdk_m:
                meta["min_sdk"] = sdk_m.group(1)
            target_m = re.search(r"targetSdkVersion:\s*'([^']+)'", out)
            if target_m:
                meta["target_sdk"] = target_m.group(1)
    except Exception:
        pass
    return meta


def extract_metadata_from_zip_and_manifest(apk_path: str, decompiled_dir: Optional[str] = None) -> Dict[str, Any]:
    """Fallback extraction using AndroidManifest.xml and apk zip scan."""
    meta: Dict[str, Any] = {}

    # Read from decompiled AndroidManifest if available
    manifest_path = os.path.join(decompiled_dir, "AndroidManifest.xml") if decompiled_dir else None
    if manifest_path and os.path.exists(manifest_path):
        try:
            tree = ET.parse(manifest_path)
            root = tree.getroot()
            ns = {"android": "http://schemas.android.com/apk/res/android"}
            meta["package_name"] = root.get("package", "unknown")
            meta["version_code"] = root.get(f'{{{ns["android"]}}}versionCode', "")
            meta["version_name"] = root.get(f'{{{ns["android"]}}}versionName', "")

            app_elem = root.find(".//application")
            if app_elem is not None:
                icon_ref = app_elem.get(f'{{{ns["android"]}}}icon', "")
                banner_ref = app_elem.get(f'{{{ns["android"]}}}banner', "")
                meta["icon_ref"] = icon_ref
                meta["banner_ref"] = banner_ref
                label = app_elem.get(f'{{{ns["android"]}}}label', "")
                if label and not label.startswith("@"):
                    meta["app_label"] = label
        except Exception:
            pass

    # Read apktool.yml if available
    apktool_path = os.path.join(decompiled_dir, "apktool.yml") if decompiled_dir else None
    if apktool_path and os.path.exists(apktool_path):
        try:
            import yaml
            with open(apktool_path, "r", encoding="utf-8") as f:
                y = yaml.safe_load(f)
                if "versionInfo" in y:
                    vi = y["versionInfo"]
                    if "versionCode" in vi and not meta.get("version_code"):
                        meta["version_code"] = str(vi["versionCode"])
                    if "versionName" in vi and not meta.get("version_name"):
                        meta["version_name"] = str(vi["versionName"])
        except Exception:
            pass

    return meta


def extract_icon_and_banner(apk_path: str, meta: Dict[str, Any], output_dir: str = "output") -> Tuple[Optional[str], Optional[str]]:
    """Extract icon and banner images to output/icon.png and output/banner.png."""
    os.makedirs(output_dir, exist_ok=True)
    icon_dest = os.path.join(output_dir, "icon.png")
    banner_dest = os.path.join(output_dir, "banner.png")

    icon_found = False
    banner_found = False

    if not os.path.exists(apk_path) or not zipfile.is_zipfile(apk_path):
        return None, None

    with zipfile.ZipFile(apk_path, "r") as z:
        names = z.namelist()

        # 1. Look for designated icon_path
        target_icon = meta.get("icon_path")
        valid_exts = (".png", ".webp", ".jpg", ".jpeg")
        if target_icon and target_icon in names and target_icon.endswith(valid_exts):
            with open(icon_dest, "wb") as f:
                f.write(z.read(target_icon))
            icon_found = True

        # 2. If not found or target was XML, scan for highest resolution genuine launcher icon
        if not icon_found:
            density_order = ["xxxhdpi", "xxhdpi", "xhdpi", "hdpi", "mdpi"]
            valid_exts = (".png", ".webp", ".jpg", ".jpeg")
            excluded_prefixes = ("exo_", "media3_", "abc_", "common_", "notification_", "notify_", "btn_", "ic_mr_", "cast_")

            # Tier 1: Real launcher icons in mipmap
            tier1 = []
            for n in names:
                if n.endswith(valid_exts) and "mipmap" in n.lower():
                    base = n.split("/")[-1].lower()
                    if not any(base.startswith(p) for p in excluded_prefixes):
                        if any(k in base for k in ["ic_launcher_round", "ic_launcher", "app_icon", "logo"]):
                            tier1.append(n)

            # Tier 2: Real launcher icons in drawable
            tier2 = []
            for n in names:
                if n.endswith(valid_exts) and "drawable" in n.lower():
                    base = n.split("/")[-1].lower()
                    if not any(base.startswith(p) for p in excluded_prefixes):
                        if any(k in base for k in ["ic_launcher_round", "ic_launcher", "app_icon", "logo", "icon"]):
                            tier2.append(n)

            candidates = tier1 if tier1 else tier2

            best_candidate = None
            for d in density_order:
                matches = [c for c in candidates if d in c]
                round_matches = [m for m in matches if "round" in m.lower()]
                if round_matches:
                    best_candidate = round_matches[0]
                    break
                elif matches:
                    best_candidate = matches[0]
                    break

            if not best_candidate and candidates:
                best_candidate = candidates[0]

            if best_candidate:
                with open(icon_dest, "wb") as f:
                    f.write(z.read(best_candidate))
                icon_found = True
                meta["icon_path"] = best_candidate

        # 3. Look for designated banner_path or TV banner
        target_banner = meta.get("banner_path")
        if target_banner and target_banner in names and target_banner.endswith(valid_exts):
            with open(banner_dest, "wb") as f:
                f.write(z.read(target_banner))
            banner_found = True
        else:
            banner_candidates = [n for n in names if n.endswith(valid_exts) and "banner" in n.lower()]
            if banner_candidates:
                with open(banner_dest, "wb") as f:
                    f.write(z.read(banner_candidates[0]))
                banner_found = True
                meta["banner_path"] = banner_candidates[0]

    return icon_dest if icon_found else None, banner_dest if banner_found else None


def extract_all_assets(apk_path: str, decompiled_dir: Optional[str] = None, output_dir: str = "output") -> Dict[str, Any]:
    """Orchestrate full extraction of metadata, logo, and banner."""
    print(f"📦 Extracting metadata and app logo from: {os.path.basename(apk_path)}...")

    meta = extract_metadata_from_aapt(apk_path)
    fallback_meta = extract_metadata_from_zip_and_manifest(apk_path, decompiled_dir)

    for k, v in fallback_meta.items():
        if not meta.get(k):
            meta[k] = v

    if not meta.get("app_label"):
        pkg = meta.get("package_name", "App")
        meta["app_label"] = pkg.split(".")[-1].capitalize()

    icon_file, banner_file = extract_icon_and_banner(apk_path, meta, output_dir)
    meta["has_icon"] = bool(icon_file and os.path.exists(icon_file))
    meta["has_banner"] = bool(banner_file and os.path.exists(banner_file))

    if meta["has_icon"]:
        print(f"  🎨 App Logo extracted: output/icon.png ({os.path.getsize(icon_file) // 1024} KB)")
    if meta["has_banner"]:
        print(f"  📺 TV Banner extracted: output/banner.png ({os.path.getsize(banner_file) // 1024} KB)")

    meta_file = os.path.join(output_dir, "app_meta.json")
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    return meta


if __name__ == "__main__":
    target_apk = sys.argv[1] if len(sys.argv) > 1 else "input.apk"
    d_dir = sys.argv[2] if len(sys.argv) > 2 else "decompiled"
    res = extract_all_assets(target_apk, d_dir)
    print(json.dumps(res, indent=2, ensure_ascii=False))
