# -*- coding: utf-8 -*-
"""PrimeForge Telegram Webhook and Callback Handler.

Handles inline buttons (publish, cancel, full_mod, sanitize_only)
and text commands (/mod, /analyze, /sanitize, /status, /jobs, /profiles).
Can be invoked by Next.js API route (/api/webhook-telegram) or run standalone via polling.
"""
import json
import os
import sys
import urllib.request
import ssl

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.supabase_client import get_job, update_job, find_listing_by_package, update_listing
from telegram.bot import _send_message, BOT_TOKEN, CHAT_ID

GITHUB_REPO = os.environ.get("GITHUB_REPO", "simurgulgen/PrimeForge")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")

_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE


def answer_callback_query(callback_query_id: str, text: str = ""):
    """Acknowledge Telegram callback query to stop loading spinner."""
    if not BOT_TOKEN:
        return
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/answerCallbackQuery"
    payload = {"callback_query_id": callback_query_id, "text": text}
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        urllib.request.urlopen(req, timeout=10, context=_ctx)
    except Exception as e:
        print(f"Error answering callback query: {e}")


def trigger_github_workflow(event_type: str, client_payload: dict) -> bool:
    """Dispatch workflow to GitHub Actions."""
    if not GITHUB_TOKEN:
        print("⚠️ GITHUB_TOKEN not configured for dispatch")
        return False
    url = f"https://api.github.com/repos/{GITHUB_REPO}/dispatches"
    payload = {
        "event_type": event_type,
        "client_payload": client_payload
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
            "User-Agent": "PrimeForge-TelegramBot"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status in (200, 204)
    except Exception as e:
        print(f"Failed to trigger GitHub workflow: {e}")
        return False


def handle_callback_query(callback: dict) -> dict:
    """Handle inline button click."""
    callback_id = callback.get("id")
    data = callback.get("data", "")
    from_user = callback.get("from", {})

    print(f"🔘 Telegram Callback: {data} from {from_user.get('username', from_user.get('id'))}")

    parts = data.split(":")
    if len(parts) < 3 or parts[0] != "forge":
        answer_callback_query(callback_id, "Bilinmeyen işlem")
        return {"status": "ignored"}

    action = parts[1]
    job_id = parts[2]

    if action == "publish":
        # Approve and publish to Supabase listings
        job = get_job(job_id)
        if not job:
            answer_callback_query(callback_id, "İş bulunamadı!")
            return {"status": "error", "message": "job not found"}

        pkg = job.get("package_name")
        catbox_url = job.get("modded_apk_url")
        ver = job.get("version_name")

        # Update listings table if exists
        listing = find_listing_by_package(pkg)
        if listing and listing.get("id"):
            update_listing(listing["id"], {
                "fileUrl": catbox_url,
                "version": f"{ver} (Prime Mod)",
                "status": "published"
            })
            listing_msg = f"✅ `{listing.get('title', pkg)}` kataloğu güncellendi!"
        else:
            listing_msg = f"ℹ️ Katalogda doğrudan kayıt bulunamadı, Catbox linki hazır."

        update_job(job_id, {"status": "published", "decision": "approved"})
        answer_callback_query(callback_id, "Yayınlandı!")
        _send_message(
            f"🚀 <b>Yayınlama Başarılı!</b>\n\n"
            f"📦 <b>{pkg}</b> v{ver}\n"
            f"🔗 {catbox_url}\n"
            f"{listing_msg}"
        )
        return {"status": "published"}

    elif action == "cancel":
        update_job(job_id, {"status": "cancelled", "decision": "rejected"})
        answer_callback_query(callback_id, "İşlem iptal edildi.")
        _send_message(f"❌ İşlem iptal edildi: #{job_id[:8]}")
        return {"status": "cancelled"}

    elif action in ("full_mod", "sanitize_only"):
        job = get_job(job_id)
        apk_url = job.get("apk_url") if job else ""
        if not apk_url:
            answer_callback_query(callback_id, "APK URL bulunamadı!")
            return {"status": "error"}

        triggered = trigger_github_workflow("patch-apk", {
            "apk_url": apk_url,
            "action": action,
            "job_id": job_id
        })
        status_text = "Tetiklendi!" if triggered else "GitHub tetiklenemedi (token kontrol edin)"
        answer_callback_query(callback_id, status_text)
        _send_message(f"⚡ GitHub Actions işi başlatıldı: <b>{action}</b> (#{job_id[:8]})")
        return {"status": "triggered"}

    elif action == "create_profile":
        answer_callback_query(callback_id, "Profil oluşturma modu")
        _send_message(f"📝 Profil oluşturmak için web dashboard'u ziyaret edin veya <code>profiles/</code> dizinine YAML ekleyin.")
        return {"status": "profile_mode"}

    answer_callback_query(callback_id, "Tamamlandı")
    return {"status": "ok"}


def handle_message(msg: dict) -> dict:
    """Handle incoming text commands."""
    text = msg.get("text", "").strip()
    chat_id = str(msg.get("chat", {}).get("id", ""))

    if not text:
        return {"status": "no_text"}

    parts = text.split()
    cmd = parts[0].lower()

    if cmd == "/start" or cmd == "/help":
        help_text = (
            "🔧 <b>PrimeForge Telegram Bot</b>\n\n"
            "Mevcut komutlar:\n"
            "• <code>/mod &lt;APK_URL&gt;</code> — APK'yı modlama pipeline'ına gönder\n"
            "• <code>/analyze &lt;APK_URL&gt;</code> — Sadece analiz et ve rapor sun\n"
            "• <code>/sanitize &lt;APK_URL&gt;</code> — Sadece izinleri temizle\n"
            "• <code>/status</code> — Son işlerin durumunu göster\n"
            "• <code>/profiles</code> — Kayıtlı yama profilleri\n"
        )
        _send_message(help_text)
        return {"status": "help"}

    elif cmd in ("/mod", "/analyze", "/sanitize"):
        if len(parts) < 2:
            _send_message(f"⚠️ Lütfen APK indirme bağlantısı girin.\nÖrnek: <code>{cmd} https://example.com/app.apk</code>")
            return {"status": "missing_arg"}

        apk_url = parts[1]
        action_map = {"/mod": "full_mod", "/analyze": "analyze_only", "/sanitize": "sanitize_only"}
        action = action_map[cmd]

        from engine.supabase_client import create_job
        job = create_job(apk_url, action=action)
        job_id = job.get("id", "pending")

        triggered = trigger_github_workflow("patch-apk", {
            "apk_url": apk_url,
            "action": action,
            "job_id": job_id
        })

        _send_message(
            f"📥 <b>Yeni İş Sıraya Alındı</b>\n\n"
            f"🎯 İşlem: <code>{action}</code>\n"
            f"🔗 APK: {apk_url}\n"
            f"🆔 Job ID: <code>{job_id}</code>\n\n"
            f"{'⚡ GitHub Actions tetiklendi!' if triggered else '⚠️ GitHub Actions tetiklenemedi (token kontrol edin).'}"
        )
        return {"status": "job_created", "job_id": job_id}

    elif cmd == "/profiles":
        profiles_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "profiles")
        p_files = [f for f in os.listdir(profiles_dir) if f.endswith(".yml")] if os.path.exists(profiles_dir) else []
        lines = ["📋 <b>Kayıtlı Yama Profilleri:</b>", ""]
        for pf in sorted(p_files):
            lines.append(f"• <code>{pf}</code>")
        _send_message("\n".join(lines))
        return {"status": "profiles"}

    return {"status": "unknown_command"}


def handle_update(update: dict) -> dict:
    """Main webhook entrypoint."""
    if "callback_query" in update:
        return handle_callback_query(update["callback_query"])
    elif "message" in update:
        return handle_message(update["message"])
    return {"status": "ignored"}
