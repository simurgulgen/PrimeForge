#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PrimeForge Automated Update Checker
Polls upstream update endpoints, GitHub releases, or store catalogs for each
configured app profile. Triggers auto-modding pipeline or sends Telegram alert
when a new version is detected.
"""

import glob
import json
import os
import re
import ssl
import sys
import time
import urllib.request
from typing import Dict, Any, List, Optional
import yaml

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

PROFILES_DIR = os.path.join(PROJECT_ROOT, "profiles")
OUTPUT_DIR = os.path.abspath("output")

_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE


def compare_versions(v1: str, v2: str) -> int:
    """Compare two version strings (e.g. '3.4.0' vs '3.5.0'). Returns 1 if v2 > v1, 0 if equal, -1 if v1 > v2."""
    def _normalize(v):
        # Extract digits
        parts = re.findall(r"\d+", str(v))
        return [int(p) for p in parts] if parts else [0]

    p1, p2 = _normalize(v1), _normalize(v2)
    # Pad to equal length
    max_len = max(len(p1), len(p2))
    p1 += [0] * (max_len - len(p1))
    p2 += [0] * (max_len - len(p2))

    if p2 > p1:
        return 1
    elif p1 > p2:
        return -1
    return 0


class UpdateChecker:
    def __init__(self):
        self.github_token = os.environ.get("GITHUB_TOKEN", "")
        self.repo_slug = os.environ.get("GITHUB_REPOSITORY", "simurgulgen/PrimeForge")
        self.results: List[Dict[str, Any]] = []

    def load_active_profiles(self) -> List[Dict[str, Any]]:
        """Load all YAML profiles from profiles/ directory and supplement from Supabase."""
        profiles = []
        seen_packages = set()

        # 1. Local Profiles
        for ext in ["*.yml", "*.yaml"]:
            for file_path in glob.glob(os.path.join(PROFILES_DIR, ext)):
                base = os.path.basename(file_path)
                if base.startswith("_"):
                    continue
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data = yaml.safe_load(f)
                        if data and "package" in data:
                            data["_file_path"] = file_path
                            seen_packages.add(data["package"])
                            profiles.append(data)
                except Exception as e:
                    print(f"⚠️ Error reading profile {base}: {e}")

        # 2. Remote Supabase Catalog listings
        try:
            from engine.supabase_client import get_all_listings
            listings = get_all_listings(limit=50)
            for item in listings:
                pkg = item.get("packageName")
                if pkg and pkg not in seen_packages:
                    seen_packages.add(pkg)
                    profiles.append({
                        "name": item.get("title", pkg),
                        "package": pkg,
                        "current_version": str(item.get("version", "1.0.0")),
                        "auto_apply": False,
                        "_file_path": None
                    })
        except Exception:
            pass

        return profiles

    def check_github_releases(self, url: str) -> Optional[Dict[str, Any]]:
        """Check for updates via GitHub Releases API."""
        m = re.search(r"github\.com/([^/]+/[^/]+)", url)
        if not m:
            return None
        repo = m.group(1)
        api_url = f"https://api.github.com/repos/{repo}/releases/latest"
        headers = {"User-Agent": "PrimeForge-UpdateChecker", "Accept": "application/vnd.github.v3+json"}
        if self.github_token:
            headers["Authorization"] = f"Bearer {self.github_token}"

        req = urllib.request.Request(api_url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=15, context=_ctx) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                tag = data.get("tag_name", "").lstrip("v")
                rel_name = data.get("name", "")
                
                # Prioritize release title (e.g. '2.0.19') over generic tags (e.g. 'update', 'latest')
                import re
                m_name = re.search(r"([0-9]+(?:\.[0-9]+)+)", rel_name)
                m_tag = re.search(r"([0-9]+(?:\.[0-9]+)+)", tag)
                if m_name:
                    remote_ver = m_name.group(1)
                elif m_tag:
                    remote_ver = m_tag.group(1)
                else:
                    remote_ver = tag or rel_name

                apk_url = None
                for asset in data.get("assets", []):
                    if asset.get("name", "").endswith(".apk"):
                        apk_url = asset.get("browser_download_url")
                        break
                return {"remote_version": remote_ver, "apk_url": apk_url}
        except Exception as e:
            print(f"  ⚠️ GitHub check failed for {repo}: {e}")
            return None

    def check_http_json(self, endpoint: str, version_key: str = "version", apk_key: str = "apk_url") -> Optional[Dict[str, Any]]:
        """Check custom HTTP JSON endpoint."""
        headers = {
            "User-Agent": "Mozilla/5.0 (Linux; Android 11; Pixel 6)",
            "Accept": "application/json"
        }
        req = urllib.request.Request(endpoint, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=15, context=_ctx) as resp:
                data = json.loads(resp.read().decode("utf-8"))

                remote_version = data.get(version_key)
                if remote_version is None:
                    for vk in ["version", "versionCode", "version_code", "latest", "ver"]:
                        if vk in data:
                            remote_version = data[vk]
                            break

                apk_url = data.get(apk_key)
                if apk_url is None:
                    for ak in ["url", "apk_url", "download_url", "apkUrl", "downloadUrl", "link"]:
                        if ak in data:
                            apk_url = data[ak]
                            break

                return {"remote_version": str(remote_version) if remote_version is not None else None, "apk_url": apk_url}
        except Exception as e:
            print(f"  ⚠️ HTTP check failed for {endpoint}: {e}")
            return None

    def check_supabase_catalog(self, package_name: str) -> Optional[Dict[str, Any]]:
        """Supabase catalog is the destination catalog, not an upstream update source. Returns None."""
        return None

    def trigger_github_pipeline(self, apk_url: str, package_name: str, profile_name: str):
        """Trigger PrimeForge pipeline on GitHub Actions."""
        if not self.github_token:
            print("  ⚠️ GITHUB_TOKEN not configured, skipping dispatch.")
            return

        url = f"https://api.github.com/repos/{self.repo_slug}/dispatches"
        payload = {
            "event_type": "patch-apk",
            "client_payload": {
                "apk_url": apk_url,
                "package_name": package_name,
                "profile": profile_name,
                "action": "full_mod"
            }
        }
        data = json.dumps(payload).encode("utf-8")
        headers = {
            "Authorization": f"Bearer {self.github_token}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        }
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=15, context=_ctx) as resp:
                print(f"  🚀 GitHub Actions pipeline triggered for {package_name}!")
        except Exception as e:
            print(f"  ❌ Failed to trigger pipeline: {e}")

    def notify_telegram_new_version(self, app_name: str, pkg: str, cur_ver: str, new_ver: str, apk_url: str):
        """Send rich Telegram alert with valid job_id and mod button."""
        try:
            from telegram.bot import _send_message
            from engine.supabase_client import create_job
            job = create_job(apk_url=apk_url, action="full_mod")
            job_id = job.get("id") if isinstance(job, dict) and job.get("id") else pkg

            text = (
                f"🔔 <b>Yeni Uygulama Güncellemesi Bulundu!</b>\n\n"
                f"📦 <b>{app_name}</b>\n"
                f"🏷️ <code>{pkg}</code>\n"
                f"🔹 Mevcut Sürüm: <code>v{cur_ver}</code>\n"
                f"🚀 Yeni Sürüm: <b>v{new_ver}</b>\n\n"
                f"🔗 <a href=\"{apk_url}\">Yeni APK İndirme Bağlantısı</a>"
            )
            buttons = {"inline_keyboard": [[
                {"text": "⚡ Otomatik Modla", "callback_data": f"forge:full_mod:{job_id}"},
                {"text": "❌ Yoksay", "callback_data": f"forge:ignore:{job_id}"}
            ]]}
            _send_message(text, reply_markup=buttons)
            print(f"  📱 Telegram notification sent for {pkg} (Job: {job_id})")
        except Exception as e:
            print(f"  ⚠️ Telegram alert error: {e}")

    def notify_telegram_update_with_nim(self, app_name: str, pkg: str, cur_ver: str,
                                         new_ver: str, apk_url: str, nim_result: dict):
        """NIM doğrulama sonuçlarını içeren zengin Telegram bildirimi gönder."""
        try:
            from telegram.bot import _send_message
            from engine.supabase_client import create_job, update_job

            job = create_job(apk_url=apk_url, action="full_mod")
            job_id = job.get("id") if isinstance(job, dict) and job.get("id") else pkg

            # NIM sonucunu forge_jobs'a kaydet
            if isinstance(job, dict) and job.get("id"):
                try:
                    update_job(job["id"], {"nim_verification": nim_result})
                except Exception:
                    pass

            confidence = nim_result.get("confidence", 0)
            action = nim_result.get("recommended_action", "manual_review")
            reason = nim_result.get("reason", "")
            flags = nim_result.get("risk_flags", [])

            # Güven skoru badge'i
            if confidence >= 80:
                nim_badge = f"🟢 Güven: {confidence}%"
            elif confidence >= 50:
                nim_badge = f"🟡 Güven: {confidence}%"
            else:
                nim_badge = f"🔴 Güven: {confidence}%"

            # Aksiyon badge'i
            action_badge = {
                "auto_mod": "⚡ Otomatik Modlama Öneriliyor",
                "manual_review": "👀 Manuel İnceleme Gerekli",
                "skip": "🚫 Atlanması Öneriliyor"
            }.get(action, "❓ Bilinmeyen")

            risk_text = ""
            if flags:
                risk_text = f"\n⚠️ <b>Risk:</b> {', '.join(flags)}"

            text = (
                f"🔔 <b>Yeni Uygulama Güncellemesi Bulundu!</b>\n\n"
                f"📦 <b>{app_name}</b>\n"
                f"🏷️ <code>{pkg}</code>\n"
                f"🔹 Mevcut: <code>v{cur_ver}</code>\n"
                f"🚀 Yeni: <b>v{new_ver}</b>\n\n"
                f"🧠 <b>NIM Doğrulama:</b>\n"
                f"  {nim_badge}\n"
                f"  📋 {action_badge}\n"
                f"  💬 {reason}"
                f"{risk_text}\n\n"
                f"🔗 <a href=\"{apk_url}\">APK İndirme Bağlantısı</a>"
            )

            # auto_mod onaylıysa pipeline butonu öne çıksın
            if action == "auto_mod" and confidence >= 75:
                buttons = {"inline_keyboard": [[
                    {"text": "⚡ Modla (NIM Onaylı)", "callback_data": f"forge:full_mod:{job_id}"},
                    {"text": "❌ Yoksay", "callback_data": f"forge:ignore:{job_id}"}
                ]]}
            else:
                buttons = {"inline_keyboard": [[
                    {"text": "✅ Modla", "callback_data": f"forge:full_mod:{job_id}"},
                    {"text": "🔍 İncele", "callback_data": f"forge:analyze_only:{job_id}"},
                    {"text": "❌ Yoksay", "callback_data": f"forge:ignore:{job_id}"}
                ]]}

            _send_message(text, reply_markup=buttons)
            print(f"  📱 NIM destekli Telegram bildirimi gönderildi: {pkg} (Job: {job_id})")
        except Exception as e:
            print(f"  ⚠️ Telegram NIM bildirim hatası: {e}")
            # Fallback: Eski basit bildirimi dene
            self.notify_telegram_new_version(app_name, pkg, cur_ver, new_ver, apk_url)

    def run_check(self) -> List[Dict[str, Any]]:
        """Run update checks for all loaded profiles."""
        profiles = self.load_active_profiles()
        print(f"🔎 PrimeForge Update Checker: Checking {len(profiles)} profiles...")

        for prof in profiles:
            pkg = prof.get("package")
            name = prof.get("name", pkg)
            update_cfg = prof.get("update_check", {})

            # Fetch catalog listing to resolve real installed/published version and potential upstream repo
            from engine.supabase_client import find_listing_by_package
            listing = find_listing_by_package(pkg) if pkg else {}

            # Resolve current version: Profile explicit version -> Catalog listing version -> fallback 1.0.0
            current_ver = prof.get("current_version")
            if not current_ver or str(current_ver).strip() in ["1.0.0", "1.0"]:
                if listing and listing.get("version"):
                    vm = re.search(r"([0-9]+(?:\.[0-9]+)+)", str(listing.get("version")))
                    current_ver = vm.group(1) if vm else str(listing.get("version"))
                else:
                    current_ver = "1.0.0"
            current_ver = str(current_ver)

            print(f"\n📦 Checking: {name} ({pkg}) [Current: v{current_ver}]")
            update_info = None

            # Strategy 1: Defined in Profile
            cfg_type = update_cfg.get("type")
            if cfg_type == "github_releases" and update_cfg.get("url"):
                update_info = self.check_github_releases(update_cfg["url"])
            elif cfg_type in ["http_json", "http_json_get"] and update_cfg.get("endpoint"):
                update_info = self.check_http_json(
                    update_cfg["endpoint"],
                    update_cfg.get("version_key", "version"),
                    update_cfg.get("apk_key", "apk_url")
                )
            elif listing:
                # Strategy 2: Upstream GitHub repo attached to listing
                gh_cand = listing.get("githubSourceRepo") or ""
                if not gh_cand or "simurgulgen" in gh_cand or "Orion-Data" in gh_cand:
                    file_cand = listing.get("fileUrl") or ""
                    m = re.search(r"github\.com/([^/]+/[^/]+)", file_cand)
                    if m and "simurgulgen" not in m.group(1) and "Orion-Data" not in m.group(1):
                        gh_cand = m.group(1)
                    else:
                        gh_cand = None
                if gh_cand:
                    update_info = self.check_github_releases(f"https://github.com/{gh_cand}")

            if update_info and update_info.get("remote_version"):
                remote_ver = update_info["remote_version"]
                apk_url = update_info.get("apk_url")
                is_newer = compare_versions(current_ver, remote_ver) > 0

                item = {
                    "package_name": pkg,
                    "app_name": name,
                    "current_version": current_ver,
                    "remote_version": remote_ver,
                    "is_newer": is_newer,
                    "apk_url": apk_url,
                    "checked_at": time.strftime("%Y-%m-%d %H:%M:%S")
                }
                self.results.append(item)

                if is_newer and apk_url:
                    # Check if already notified or job created for this apk_url to prevent 6-hour cron spam
                    already_notified = False
                    try:
                        from engine.supabase_client import _request
                        existing = _request(f'forge_jobs?apk_url=eq.{urllib.parse.quote(apk_url)}&select=id,status')
                        if existing and isinstance(existing, list) and len(existing) > 0:
                            already_notified = True
                    except Exception:
                        pass

                    if not already_notified:
                        print(f"  🎉 NEW VERSION AVAILABLE: v{remote_ver} > v{current_ver}")

                        # === NIM AKILLI DOĞRULAMA ADIMI ===
                        nim_result = {"approved": True, "confidence": 50, "recommended_action": "manual_review"}
                        try:
                            from engine.ai_advisor import nim_verify_update
                            nim_result = nim_verify_update(
                                name, pkg, current_ver, remote_ver, apk_url,
                                source_repo=(listing.get("githubSourceRepo") or "") if listing else ""
                            )
                        except Exception as nim_err:
                            print(f"  ⚠️ NIM doğrulama atlandı: {nim_err}")

                        nim_approved = nim_result.get("approved", True)
                        nim_confidence = nim_result.get("confidence", 50)
                        nim_action = nim_result.get("recommended_action", "manual_review")
                        nim_reason = nim_result.get("reason", "")
                        nim_flags = nim_result.get("risk_flags", [])

                        # NIM doğrulama sonucunu item'a ekle
                        item["nim_verification"] = nim_result

                        if not nim_approved and nim_action == "skip":
                            # NIM bu güncellemeyi reddetti — atla, bildirme
                            print(f"  🧠 NIM REDDİ: ❌ Güncelleme atlanıyor — {nim_reason}")
                            print(f"     Risk bayrakları: {nim_flags}")
                        elif nim_approved and nim_action == "auto_mod" and nim_confidence >= 75:
                            # NIM yüksek güvenle onayladı — otomatik modla
                            print(f"  🧠 NIM ONAYI: ✅ Güven: {nim_confidence}% — Otomatik modlama")
                            self.notify_telegram_update_with_nim(
                                name, pkg, current_ver, remote_ver, apk_url, nim_result)
                            if prof.get("auto_apply"):
                                print("  ⚙️ auto_apply aktif — GitHub pipeline tetikleniyor...")
                                self.trigger_github_pipeline(
                                    apk_url, pkg, os.path.basename(prof.get("_file_path", "")))
                        else:
                            # NIM onayladı ama güven düşük veya manuel onay istiyor
                            print(f"  🧠 NIM: ⚠️ Güven: {nim_confidence}% — Manuel onay gerekli")
                            self.notify_telegram_update_with_nim(
                                name, pkg, current_ver, remote_ver, apk_url, nim_result)
                            # Pipeline tetiklenmez, Telegram butonundan onay beklenir
                    else:
                        print(f"  ℹ️ Update available (v{remote_ver}), but already notified/queued.")
                else:
                    print(f"  ✅ App is up to date (Latest: v{remote_ver})")
            else:
                print("  ℹ️ No remote upstream version source configured or reachable.")

        # Save Report
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        report_file = os.path.join(OUTPUT_DIR, "update_check_report.json")
        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)
        print(f"\n📄 Update check report saved to: {report_file}")
        return self.results


if __name__ == "__main__":
    checker = UpdateChecker()
    checker.run_check()
