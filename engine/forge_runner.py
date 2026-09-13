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

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

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
    print(f"🆔 Job ID: {job_id}")
    print("=" * 60)

    if job_id and job_id != "local":
        try:
            update_job(job_id, {
                "status": "analyzing",
                "github_run_id": str(os.environ.get("GITHUB_RUN_ID", ""))
            })
            print(f"📡 Supabase işi #{job_id} 'analyzing' durumuna güncellendi.")
        except Exception as e:
            print(f"⚠️ Job status update failed: {e}")

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

    # Include security report inside analysis report for frontend inspection
    report["security"] = security_report

    if action == "analyze_only":
        print("\n📊 Analysis complete. Processing extracted screenshots & visual assets...")
        screenshot_url = None
        try:
            from engine.screenshot_uploader import collect_and_upload_screenshots
            uploaded_shots = collect_and_upload_screenshots(job_id, package_name)
            screenshot_url = uploaded_shots.get("tv") or uploaded_shots.get("mobile") or uploaded_shots.get("banner") or uploaded_shots.get("icon")
            if uploaded_shots:
                report["screenshots"] = uploaded_shots
        except Exception as e:
            print(f"⚠️ Screenshot upload warning: {e}")

        if job_id and job_id != "local":
            try:
                v_code = report.get("version_code")
                job_update_payload = {
                    "status": "completed",
                    "app_name": report.get("app_label") or report.get("package_name"),
                    "package_name": package_name,
                    "version_name": report.get("version_name"),
                    "version_code": int(v_code) if str(v_code).isdigit() else None,
                    "analysis_report": report,
                    "github_run_id": str(os.environ.get("GITHUB_RUN_ID", ""))
                }
                if screenshot_url:
                    job_update_payload["screenshot_url"] = screenshot_url
                update_job(job_id, job_update_payload)
                print(f"✅ Supabase işi #{job_id} 'completed' ve ekran görüntüleri ile kaydedildi.")
            except Exception as e:
                print(f"⚠️ Supabase job update failed: {e}")

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
        ai_success = False
        try:
            from engine.ai_advisor import is_ai_available, ai_generate_profile
            if is_ai_available():
                print("🤖 PrimeForge AI Oto-Pilot: Uygulama için otomatik modlama profili üretiliyor...")
                if job_id and job_id != "local":
                    try:
                        update_job(job_id, {"status": "ai_profiling"})
                    except Exception:
                        pass

                ai_profile = ai_generate_profile(report)
                if ai_profile and isinstance(ai_profile, dict) and ai_profile.get("package"):
                    profile = ai_profile
                    ai_success = True

                    # Save to local profile file
                    os.makedirs(PROFILES_DIR, exist_ok=True)
                    target_profile_path = os.path.join(PROFILES_DIR, f"{package_name}.yml")
                    with open(target_profile_path, "w", encoding="utf-8") as pf:
                        yaml.dump(profile, pf, default_flow_style=False, allow_unicode=True)
                    print(f"💾 AI profili kaydedildi: {target_profile_path}")

                    # Upsert to Supabase
                    try:
                        from engine.supabase_client import upsert_profile
                        upsert_profile(
                            package_name=package_name,
                            profile_name=profile.get("name", f"{package_name} AI Profile"),
                            profile_yaml=yaml.dump(profile, default_flow_style=False, allow_unicode=True),
                            modding_guide="PrimeForge AI Oto-Pilot tarafından otomatik olarak üretildi.",
                            auto_apply=True
                        )
                        print(f"☁️ AI profili Supabase forge_profiles tablosuna kaydedildi.")
                    except Exception as se:
                        print(f"⚠️ Supabase profile upsert error: {se}")

                    # Notify Telegram
                    try:
                        from telegram.bot import send_ai_profile_generated
                        send_ai_profile_generated(report, profile, job_id)
                    except Exception as te:
                        print(f"⚠️ Telegram AI notification error: {te}")
        except Exception as e:
            print(f"⚠️ AI profil üretimi başarısız oldu: {e}")

        if not ai_success:
            print("🚫 No auto-apply profile and AI unavailable. Requesting decision via Telegram...")
            if job_id and job_id != "local":
                try:
                    v_code = report.get("version_code")
                    update_job(job_id, {
                        "status": "waiting_decision",
                        "app_name": report.get("app_label") or report.get("package_name"),
                        "package_name": package_name,
                        "version_name": report.get("version_name"),
                        "version_code": int(v_code) if str(v_code).isdigit() else None,
                        "analysis_report": report,
                    })
                except Exception as e:
                    print(f"⚠️ Supabase job update failed: {e}")
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
        if job_id and job_id != "local":
            try:
                update_job(job_id, {"status": "patching"})
            except Exception:
                pass
        patch_result = apply_profile_patches(DECOMPILED_DIR, merged_profile)

    # Step 5: Bump version
    print("\n📦 Step 5: Version Bump")
    print("-" * 40)
    bump_result = bump_version(DECOMPILED_DIR, merged_profile)

    # Step 6: Build & Sign
    print("\n🔐 Step 6: Build & Sign")
    print("-" * 40)
    if job_id and job_id != "local":
        try:
            update_job(job_id, {"status": "building"})
        except Exception:
            pass
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

    if job_id and job_id != "local":
        try:
            update_job(job_id, {
                "status": "testing",
                "app_name": report.get("app_label") or package_name,
                "package_name": package_name,
                "version_name": report.get("version_name"),
                "version_code": int(report.get("version_code")) if str(report.get("version_code", "")).isdigit() else None,
                "analysis_report": report,
            })
        except Exception:
            pass

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
    job_id = os.environ.get("JOB_ID", "")
    try:
        run_pipeline(apk)
    except Exception as e:
        print(f"\n❌ Pipeline Kritik Hatası: {e}")
        import traceback
        traceback_str = traceback.format_exc()
        traceback.print_exc()

        # Generate Failure & Diagnostic Report even if build halted
        try:
            os.makedirs(OUTPUT_DIR, exist_ok=True)
            from engine.ai_advisor import is_ai_available, ask_ai
            diag_text = ""
            if is_ai_available():
                print("🤖 Yapay zeka hata teşhis raporu hazırlıyor...")
                diag_prompt = f"""PrimeForge modlama sırasında kritik bir hata oluştu:
Paket / APK: {apk}
Hata Mesajı: {e}

Traceback:
{traceback_str[-2000:]}

GÖREV:
Geliştirici ve tersine mühendis için bu çökmenin kök nedenini (Root Cause) ve düzeltme adımlarını 3 maddelik net bir Markdown raporu olarak açıkla.
"""
                diag_text = ask_ai(diag_prompt, max_tokens=600, temp=0.2)

            with open(os.path.join(OUTPUT_DIR, "failure_diagnosis.md"), "w", encoding="utf-8") as df:
                df.write(f"# ⚠️ PrimeForge Modlama Hata Teşhis Raporu\n\n")
                df.write(f"- **Hedef:** `{apk}`\n- **Hata:** `{e}`\n\n")
                if diag_text:
                    df.write(f"## 🤖 Yapay Zeka Kök Neden Teşhisi\n\n{diag_text}\n\n")
                df.write(f"## 📋 Ham Hata Kaydı (Traceback)\n```\n{traceback_str}\n```\n")
        except Exception as diag_err:
            print(f"⚠️ Diagnostic guide generation warning: {diag_err}")

        if job_id and job_id != "local":
            try:
                update_job(job_id, {
                    "status": "failed",
                    "error_message": str(e)
                })
                print(f"📡 Supabase işi #{job_id} 'failed' olarak güncellendi.")
            except Exception as se:
                print(f"⚠️ Supabase job update failed: {se}")
        try:
            from telegram.bot import _send_message
            _send_message(f"❌ <b>PrimeForge Kritik Pipeline Hatası!</b>\n\n📦 APK: <code>{apk}</code>\n🆔 Job: <code>#{job_id[:8] if job_id else 'local'}</code>\n\n📋 <b>Hata:</b>\n<pre>{str(e)[:1000]}</pre>")
        except Exception:
            pass
        sys.exit(1)
