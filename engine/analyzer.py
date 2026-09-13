# -*- coding: utf-8 -*-
"""Static APK analysis engine.

Decompiles APK with apktool, then scans manifest, smali code,
and native libraries to produce a structured analysis report.
"""
import json
import os
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

# Known ad network package prefixes
AD_NETWORKS = {
    "com.google.android.gms.ads": "Google AdMob",
    "com.google.ads": "Google Ads",
    "com.unity3d.ads": "Unity Ads",
    "com.unity3d.services": "Unity Services",
    "com.ironsource": "IronSource",
    "com.applovin": "AppLovin",
    "com.vungle": "Vungle / Liftoff",
    "com.facebook.ads": "Meta Audience Network",
    "com.appsflyer": "AppsFlyer",
    "com.adjust": "Adjust",
    "com.mbridge": "Mintegral",
    "com.bytedance.sdk.openadsdk": "Pangle (ByteDance)",
    "com.chartboost": "Chartboost",
    "com.adcolony": "AdColony",
    "com.inmobi": "InMobi",
    "com.startapp": "StartApp",
}

# Known DRM / licensing systems
DRM_SIGNATURES = {
    "com.revenuecat": "RevenueCat",
    "com.android.vending.billing": "Google Play Billing",
    "com.google.android.vending": "Google Play LVL",
    "com.amazon.device.iap": "Amazon IAP",
    "io.adapty": "Adapty",
    "com.qonversion": "Qonversion",
    "com.purchasely": "Purchasely",
}

# Dangerous permissions
DANGEROUS_PERMISSIONS = {
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.QUERY_ALL_PACKAGES",
    "android.permission.PACKAGE_USAGE_STATS",
    "android.permission.RECORD_AUDIO",
    "android.permission.READ_CONTACTS",
    "android.permission.READ_CALL_LOG",
    "android.permission.RECEIVE_BOOT_COMPLETED",
    "android.permission.READ_SMS",
    "android.permission.SEND_SMS",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.REQUEST_INSTALL_PACKAGES",
    "android.permission.WRITE_SETTINGS",
}

# Ad-related permissions (always safe to remove)
AD_PERMISSIONS = {
    "com.google.android.gms.permission.AD_ID",
    "android.permission.ACCESS_ADSERVICES_TOPICS",
    "android.permission.ACCESS_ADSERVICES_ATTRIBUTION",
    "android.permission.ACCESS_ADSERVICES_AD_ID",
    "android.permission.ACCESS_ADSERVICES_CUSTOM_AUDIENCES",
    "com.android.vending.BILLING",
}


def decompile_apk(apk_path: str, output_dir: str) -> str:
    """Decompile APK using apktool."""
    cmd = ["apktool", "d", "-f", "-o", output_dir, apk_path]
    print(f"🔧 Decompiling: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"apktool decompile failed:\n{result.stderr}")
    print(f"✅ Decompiled to {output_dir}")
    return output_dir


def parse_manifest(decompiled_dir: str) -> dict:
    """Parse AndroidManifest.xml and extract key info."""
    manifest_path = os.path.join(decompiled_dir, "AndroidManifest.xml")
    if not os.path.exists(manifest_path):
        return {"error": "AndroidManifest.xml not found"}

    tree = ET.parse(manifest_path)
    root = tree.getroot()
    ns = {"android": "http://schemas.android.com/apk/res/android"}

    package_name = root.get("package", "unknown")
    version_code = root.get(f'{{{ns["android"]}}}versionCode', "")
    version_name = root.get(f'{{{ns["android"]}}}versionName', "")

    # Extract permissions
    permissions = []
    for perm in root.findall(".//uses-permission"):
        name = perm.get(f'{{{ns["android"]}}}name', "")
        if name:
            permissions.append(name)

    # Categorize permissions
    dangerous = [p for p in permissions if p in DANGEROUS_PERMISSIONS]
    ad_perms = [p for p in permissions if p in AD_PERMISSIONS]
    safe = [p for p in permissions if p not in DANGEROUS_PERMISSIONS and p not in AD_PERMISSIONS]

    # Check for queries block (sniffer detection)
    queries_block = root.find(".//queries")
    has_queries = queries_block is not None
    queried_packages = []
    if has_queries:
        for pkg in queries_block.findall(".//package"):
            pkg_name = pkg.get(f'{{{ns["android"]}}}name', "")
            if pkg_name:
                queried_packages.append(pkg_name)

    # Check debuggable
    app_elem = root.find(".//application")
    debuggable = False
    if app_elem is not None:
        debuggable = app_elem.get(f'{{{ns["android"]}}}debuggable', "false") == "true"

    return {
        "package_name": package_name,
        "version_code": version_code,
        "version_name": version_name,
        "permissions": {
            "all": permissions,
            "dangerous": dangerous,
            "ad_related": ad_perms,
            "safe": safe,
        },
        "has_queries_block": has_queries,
        "queried_packages": queried_packages,
        "debuggable": debuggable,
    }


def detect_ad_networks(decompiled_dir: str) -> list:
    """Scan smali directories for known ad network packages."""
    found = []
    smali_dirs = [d for d in os.listdir(decompiled_dir) if d.startswith("smali")]

    for ad_pkg, ad_name in AD_NETWORKS.items():
        pkg_path = ad_pkg.replace(".", os.sep)
        for sdir in smali_dirs:
            full_path = os.path.join(decompiled_dir, sdir, pkg_path)
            if os.path.isdir(full_path):
                smali_count = sum(1 for f in Path(full_path).rglob("*.smali"))
                found.append({
                    "name": ad_name,
                    "package": ad_pkg,
                    "smali_dir": sdir,
                    "file_count": smali_count,
                })
                break

    return found


def detect_drm(decompiled_dir: str) -> list:
    """Scan for DRM/licensing systems."""
    found = []
    smali_dirs = [d for d in os.listdir(decompiled_dir) if d.startswith("smali")]

    for drm_pkg, drm_name in DRM_SIGNATURES.items():
        pkg_path = drm_pkg.replace(".", os.sep)
        for sdir in smali_dirs:
            full_path = os.path.join(decompiled_dir, sdir, pkg_path)
            if os.path.isdir(full_path):
                found.append({"name": drm_name, "package": drm_pkg, "smali_dir": sdir})
                break

    return found


def detect_architectures(decompiled_dir: str) -> list:
    """Detect supported CPU architectures from lib/ directory."""
    lib_dir = os.path.join(decompiled_dir, "lib")
    if not os.path.isdir(lib_dir):
        return []
    return sorted(os.listdir(lib_dir))


def detect_obfuscation(decompiled_dir: str) -> dict:
    """Estimate obfuscation level by scanning smali class names."""
    smali_dirs = [d for d in os.listdir(decompiled_dir) if d.startswith("smali")]
    total_classes = 0
    short_names = 0

    for sdir in smali_dirs:
        sdir_path = os.path.join(decompiled_dir, sdir)
        for smali_file in Path(sdir_path).rglob("*.smali"):
            total_classes += 1
            stem = smali_file.stem
            if len(stem) <= 3 and stem.isalpha():
                short_names += 1

    ratio = short_names / max(total_classes, 1)
    if ratio > 0.5:
        level = "heavy (ProGuard/R8)"
    elif ratio > 0.2:
        level = "moderate"
    else:
        level = "minimal or none"

    return {
        "total_classes": total_classes,
        "obfuscated_names": short_names,
        "ratio": round(ratio, 3),
        "level": level,
    }


def full_analysis(apk_path: str, output_dir: str = "decompiled") -> dict:
    """Run full static analysis on an APK."""
    decompile_apk(apk_path, output_dir)

    manifest_info = parse_manifest(output_dir)
    ad_networks = detect_ad_networks(output_dir)
    drm_systems = detect_drm(output_dir)
    architectures = detect_architectures(output_dir)
    obfuscation = detect_obfuscation(output_dir)

    report = {
        **manifest_info,
        "ad_networks": ad_networks,
        "drm_systems": drm_systems,
        "architectures": architectures,
        "obfuscation": obfuscation,
        "apk_path": apk_path,
        "decompiled_dir": output_dir,
    }

    os.makedirs("output", exist_ok=True)
    report_path = os.path.join("output", "analysis.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"📊 Analysis saved to {report_path}")

    return report


if __name__ == "__main__":
    import sys
    apk = sys.argv[1] if len(sys.argv) > 1 else "input.apk"
    report = full_analysis(apk)
    print(json.dumps(report, indent=2, ensure_ascii=False))
