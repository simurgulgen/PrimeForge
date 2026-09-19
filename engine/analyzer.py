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


def trace_billing_and_mod_dependencies(decompiled_dir: str) -> dict:
    """Scan smali code to detect In-App Billing endpoints, VIP/Premium checks,
    existing modded logic, and class dependency mappings."""
    smali_dirs = [d for d in os.listdir(decompiled_dir) if d.startswith("smali")]
    
    billing_clients = []
    vip_methods_found = []
    existing_mod_indicators = []
    recipe_suggestions = []

    # Patterns indicating premium or purchase verification methods
    vip_pattern = re.compile(r'\.method.*(isVip|isPremium|isSubscribed|isPurchased|hasSubscription|getPurchaseState|isPro|isUnlocked)\b', re.IGNORECASE)
    
    # Pattern indicating existing mod/bypass (e.g. const/4 v0, 0x1 followed immediately by return v0)
    hardcoded_true_pattern = re.compile(r'const/4\s+([vp]\d+),\s*0x1\s*\n\s*return\s+\1', re.IGNORECASE)

    for sdir in smali_dirs:
        sdir_path = os.path.join(decompiled_dir, sdir)
        for smali_file in Path(sdir_path).rglob("*.smali"):
            try:
                content = smali_file.read_text(encoding="utf-8", errors="ignore")
                
                # Check for Google Play / RevenueCat BillingClient references
                if "Lcom/android/billingclient/api/BillingClient;" in content or "Lcom/android/vending/billing" in content:
                    billing_clients.append(str(smali_file.relative_to(sdir_path)))
                
                # Check for VIP / Purchase verification methods
                matches = vip_pattern.findall(content)
                if matches:
                    class_match = re.search(r'\.class.*?(L[^;]+;)', content)
                    class_name = class_match.group(1) if class_match else smali_file.stem
                    
                    is_already_patched = bool(hardcoded_true_pattern.search(content))
                    
                    vip_methods_found.append({
                        "class": class_name,
                        "methods": list(set(matches)),
                        "file": str(smali_file.relative_to(sdir_path)),
                        "already_patched": is_already_patched
                    })

                    if is_already_patched:
                        existing_mod_indicators.append(f"Hardcoded VIP return-true in {class_name}")

                    # Generate recipe suggestion for profile
                    for m in set(matches):
                        recipe_suggestions.append({
                            "target_class": class_name,
                            "target_method": m,
                            "patch_type": "return_true",
                            "action": "force_vip_status"
                        })

                # Check for LuckyPatcher / Mod signatures in comments or classes
                if any(sig in content for sig in ["LuckyPatcher", "Modded by", "ReVanced", "MT VIP", "Mobilism"]):
                    existing_mod_indicators.append(f"Modding signature in {smali_file.stem}")

            except Exception:
                continue

    return {
        "has_billing_client": len(billing_clients) > 0,
        "billing_client_files": billing_clients[:10],
        "vip_methods_detected": vip_methods_found[:15],
        "is_already_modded": len(existing_mod_indicators) > 0,
        "mod_indicators": list(set(existing_mod_indicators))[:10],
        "recipe_suggestions": recipe_suggestions[:10]
    }



def full_analysis(apk_path: str, output_dir: str = "decompiled") -> dict:
    """Run full static analysis on an APK."""
    decompile_apk(apk_path, output_dir)

    manifest_info = parse_manifest(output_dir)
    ad_networks = detect_ad_networks(output_dir)
    drm_systems = detect_drm(output_dir)
    architectures = detect_architectures(output_dir)
    obfuscation = detect_obfuscation(output_dir)

    # Extract assets (logo, banner, precise metadata)
    asset_info = {}
    try:
        from engine.asset_extractor import extract_all_assets
        asset_info = extract_all_assets(apk_path, output_dir, "output")
    except Exception as e:
        print(f"⚠️ Asset extraction warning: {e}")

    # Detect update mechanism
    update_info = {}
    try:
        from engine.update_analyzer import analyze_decompiled_updates
        update_info = analyze_decompiled_updates(output_dir, manifest_info.get("package_name", ""))
    except Exception as e:
        print(f"⚠️ Update mechanism analysis warning: {e}")

    # Trace billing, IAP, and existing mod dependencies
    billing_mod_info = trace_billing_and_mod_dependencies(output_dir)

    report = {
        **manifest_info,
        "app_label": asset_info.get("app_label", manifest_info.get("package_name", "App")),
        "has_icon": asset_info.get("has_icon", False),
        "has_banner": asset_info.get("has_banner", False),
        "ad_networks": ad_networks,
        "drm_systems": drm_systems,
        "billing_and_mods": billing_mod_info,
        "architectures": architectures,
        "obfuscation": obfuscation,
        "update_mechanism": update_info,
        "apk_path": apk_path,
        "decompiled_dir": output_dir,
    }

    # If asset_extractor discovered higher precision versions, override
    if asset_info.get("version_name"):
        report["version_name"] = asset_info["version_name"]
    if asset_info.get("version_code"):
        report["version_code"] = asset_info["version_code"]

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
