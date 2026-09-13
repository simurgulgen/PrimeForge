#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PrimeForge Main Orchestrator.

Coordinates: Decompile → Analyze → Profile Match → Patch → Sanitize → Build → Sign → Record Guide
"""
import json
import os
import sys
import yaml
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.analyzer import full_analysis
from engine.sanitizer import sanitize_manifest, bump_version
from engine.patcher import apply_profile_patches
from engine.signer import build_and_sign
from engine.supabase_client import create_job, update_job, get_profile

PROFILES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "profiles")
DECOMPILED_DIR = "decompiled"
OUTPUT_DIR = "output"


def load_profile(package_name):
    """Load YAML profile for a package from local file or Supabase. Returns None if unknown."""
    profile_path = os.path.join(PROFILES_DIR, f"{package_name}.yml")
    if os.path.exists(profile_path):
        with open(profile_path, "r", encoding="utf-8") as f:
            profile = yaml.safe_load(f)
        print(f"📋 Loaded local profile: {profile.get('name', package_name)}")
        return profile

    # Fallback to Supabase forge_profiles
    try:
        remote_profile = get_profile(package_name)
        if remote_profile and remote_profile.get("profile_yaml"):
            profile = yaml.safe_load(remote_profile["profile_yaml"])
            print(f"☁️ Loaded profile from Supabase: {profile.get('name', package_name)}")
            # Cache locally
            os.makedirs(PROFILES_DIR, exist_ok=True)
            with open(profile_path, "w", encoding="utf-8") as f:
                f.write(remote_profile["profile_yaml"])
            return profile
    except Exception as e:
        print(f"⚠️ Remote profile lookup failed: {e}")

    print(f"⚠️ No profile found for {package_name}")
    unknown_path = os.path.join(PROFILES_DIR, "_unknown.yml")
    if os.path.exists(unknown_path):
        with open(unknown_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    return None


def load_base_profile():
    """Load the base profile with common rules."""
    base_path = os.path.join(PROFILES_DIR, "_base.yml")
    if os.path.exists(base_path):
        with open(base_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    return {}


def merge_profiles(base, specific):
    """Merge base profile with app-specific profile."""
    merged = dict(base)
    for key, value in specific.items():
        if key in merged:
            if isinstance(merged[key], dict) and isinstance(value, dict):
                merged[key] = {**merged[key], **value}
            elif isinstance(merged[key], list) and isinstance(value, list):
                merged[key] = list(set(merged[key] + value))
            else:
                merged[key] = value
        else:
            merged[key] = value
    return merged


def run_pipeline(apk_path, action=None, profile_name=None):
    """Run the full PrimeForge pipeline."""
    action = action or os.environ.get("ACTION", "full_mod")
    job_id = os.environ.get("JOB_ID", "local")

    print("=" * 60)
    print(f"🔧 PrimeForge Pipeline v1.0")
    print(f"📦 APK: {apk_path}")
    print(f"🎯 Action: {action}")
    print("=" * 60)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Step 1: Analyze
    print("\n📊 Step 1: Static Analysis")
    print("-" * 40)
    report = full_analysis(apk_path, DECOMPILED_DIR)
    package_name = report.get("package_name", "unknown")
    print(f"  Package: {package_name}")
    print(f"  Version: {report.get('version_name', '?')} (code: {report.get('version_code', '?')})")
    print(f"  Architectures: {report.get('architectures', [])}")
    print(f"  Ad Networks: {[ad['name'] for ad in report.get('ad_networks', [])]}")
    print(f"  DRM Systems: {[drm['name'] for drm in report.get('drm_systems', [])]}")
    print(f"  Dangerous Perms: {report['permissions'].get('dangerous', [])}")

    # Step 1.5: Multi-Engine Security Scan (VirusTotal, APKiD, Quark-Engine, ClamAV)
    print("\n🛡️ Step 1.5: Multi-Engine Security Scan")
    print("-" * 40)
    security_report = {}
    try:
        from engine.security_scanner import run_all_scans
        security_report = run_all_scans(apk_path, DECOMPILED_DIR, OUTPUT_DIR)
    except Exception as e:
        print(f"⚠️ Security scan failed: {e}")

    if action == "analyze_only":
        print("\n📊 Analysis complete. Sending report...")
        try:
            from telegram.bot import send_analysis_report
            send_analysis_report(report, job_id, security_report)
        except Exception as e:
            print(f"⚠️ Telegram notification failed: {e}")
        return report

    # Step 2: Load profile
    print("\n📋 Step 2: Loading Profile")
    print("-" * 40)
    profile = load_profile(profile_name or package_name)

    if profile is None or not profile.get("auto_apply", False):
        print("🚫 No auto-apply profile. Requesting decision via Telegram...")
        try:
            from telegram.bot import request_decision
            request_decision(report, job_id)
        except Exception as e:
            print(f"⚠️ Telegram failed: {e}")
        github_env = os.environ.get("GITHUB_ENV")
        if github_env:
            with open(github_env, "a") as f:
                f.write("SKIP_EMULATOR=true\n")
        print("⏸️ Pipeline paused. Waiting for Telegram decision.")
        sys.exit(0)

    merged_profile = merge_profiles(load_base_profile(), profile)
    print(f"  Profile: {merged_profile.get('name', 'unknown')}")

    # Step 3: Sanitize manifest
    print("\n🧹 Step 3: Manifest Sanitization")
    print("-" * 40)
    sanitize_result = sanitize_manifest(DECOMPILED_DIR, merged_profile)

    # Step 4: Apply smali patches
    patch_result = {"applied": 0, "total": 0}
    if action != "sanitize_only":
        print("\n🔧 Step 4: Smali Patching")
        print("-" * 40)
        patch_result = apply_profile_patches(DECOMPILED_DIR, merged_profile)

    # Step 5: Bump version
    print("\n📦 Step 5: Version Bump")
    print("-" * 40)
    bump_result = bump_version(DECOMPILED_DIR, merged_profile)

    # Step 6: Build & Sign
    print("\n🔐 Step 6: Build & Sign")
    print("-" * 40)
    ks_pass = os.environ.get("KEYSTORE_PASSWORD", "primestore123")
    ks_alias = os.environ.get("KEYSTORE_ALIAS", "primestore")
    build_result = build_and_sign(DECOMPILED_DIR, OUTPUT_DIR, "primestore_release.jks", ks_alias, ks_pass)

    # Summary dictionary
    full_result = {
        "package_name": package_name,
        "version_name": report.get("version_name"),
        "version_code": report.get("version_code"),
        "profile_used": merged_profile.get("name"),
        "action": action,
        "analysis": report,
        "security": security_report,
        "sanitization": sanitize_result,
        "patching": patch_result,
        "build": build_result,
    }

    # Step 7: Generate Modding Guide & Record Profile for Future Updates
    print("\n📖 Step 7: Generating Modding Guide & Recording Profile")
    print("-" * 40)
    try:
        from engine.guide_recorder import generate_and_record_guide
        guide_info = generate_and_record_guide(full_result, OUTPUT_DIR)
        full_result["guide_path"] = guide_info["guide_path"]
        full_result["profile_path"] = guide_info["profile_path"]
    except Exception as e:
        print(f"⚠️ Guide generation error: {e}")

    # Final Summary Output
    print("\n" + "=" * 60)
    print("✅ PrimeForge Pipeline Complete!")
    print(f"  📦 APK: {build_result['apk_path']}")
    print(f"  📏 Size: {build_result['file_size'] / (1024*1024):.2f} MB")
    print(f"  🔒 SHA256: {build_result['sha256']}")
    print(f"  ✅ Signature: {'Verified' if build_result['verified'] else 'FAILED'}")
    print(f"  🧹 Manifest: {sanitize_result.get('total_changes', 0)} changes")
    print(f"  🔧 Smali: {patch_result.get('applied', 0)}/{patch_result.get('total', 0)} patches")
    print("=" * 60)

    with open(os.path.join(OUTPUT_DIR, "result.json"), "w", encoding="utf-8") as f:
        json.dump(full_result, f, indent=2, ensure_ascii=False)

    try:
        from telegram.bot import send_build_success
        send_build_success(full_result, job_id)
    except Exception as e:
        print(f"⚠️ Telegram notification failed: {e}")

    return full_result


if __name__ == "__main__":
    apk = sys.argv[1] if len(sys.argv) > 1 else "input.apk"
    run_pipeline(apk)
