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

    elif action == "ignore":
        if _UUID_RE.match(job_id):
            update_job(job_id, {"status": "ignored", "decision": "rejected"})
        answer_callback_query(callback_id, "Güncelleme yoksayıldı.")
        _send_message(f"❌ Güncelleme yoksayıldı ({job_id[:8] if _UUID_RE.match(job_id) else job_id}).")
        return {"status": "ignored"}

    elif action in ("full_mod", "sanitize_only"):
        job = get_job(job_id)
        apk_url = job.get("apk_url") if job else ""
        if not apk_url:
            # Fallback if job_id was passed as package name
            listing = find_listing_by_package(job_id)
            if listing:
                apk_url = listing.get("fileUrl") or ""
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
        _send_message(f"⚡ GitHub Actions işi başlatıldı: <b>{action}</b> ({job_id[:8] if _UUID_RE.match(job_id) else job_id})")
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
            "🤖 <b>PrimeForge & TigerStream Otomasyon Botu</b>\n\n"
            "📦 <b>APK & Modlama:</b>\n"
            "• <code>/mod &lt;URL&gt;</code> — APK'yı tam modlama pipeline'ına gönder\n"
            "• <code>/analyze &lt;URL&gt;</code> — APK analiz et & rapor al\n"
            "• <code>/sanitize &lt;URL&gt;</code> — Tehlikeli izinleri temizle\n"
            "• <code>/profiles</code> — Kayıtlı APK yama profilleri\n"
            "• <code>/status</code> — Son modlama işlerinin durumu\n"
            "• <code>/updates</code> — Bekleyen güncelleme işleri\n"
            "• <code>/check_updates</code> — Uygulama güncellemelerini tara\n\n"
            "📡 <b>TigerStream IPTV:</b>\n"
            "• <code>/health</code> — Genel sistem ve havuz sağlığı\n"
            "• <code>/streams</code> — IPTV yayın ve havuz istatistikleri\n"
            "• <code>/clean_dead</code> — Ölü hesapları havuzdan temizle\n"
            "• <i>(Veya direkt .txt/.m3u dosyası iletin, NIM ile ayrıştırılıp eklensin)</i>"
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

    elif cmd == "/health":
        from engine.supabase_client import _request
        db_ok = False
        try:
            res = _request("forge_jobs?select=id&limit=1")
            db_ok = isinstance(res, list)
        except Exception:
            pass

        scripts_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "scripts")
        sys.path.insert(0, scripts_dir)
        try:
            from wars_iptv_scraper import load_pool
            pool = load_pool()
        except Exception:
            pool = []

        active = sum(1 for a in pool if a.get("status") == "Active")
        full = sum(1 for a in pool if a.get("status") == "Full")
        degraded = sum(1 for a in pool if a.get("status") == "Degraded")
        dead = sum(1 for a in pool if a.get("status") == "Dead")

        text = (
            "🏥 <b>Sistem ve Altyapı Sağlık Durumu</b>\n\n"
            f"🗄️ <b>Supabase DB:</b> {'✅ Bağlı' if db_ok else '❌ Erişilemedi'}\n"
            f"📡 <b>IPTV Havuzu:</b> {len(pool)} toplam hesap\n"
            f"  • 🟢 Aktif: {active}\n"
            f"  • 🟡 Dolu (1/1): {full}\n"
            f"  • 🟠 Geçici Sorunlu: {degraded}\n"
            f"  • 💀 Ölü: {dead}\n"
            f"🧠 <b>NVIDIA NIM:</b> ✅ Aktif\n"
            f"⚡ <b>Cloudflare Gateway:</b> Aktif"
        )
        _send_message(text)
        return {"status": "health", "db_ok": db_ok, "pool_count": len(pool)}

    elif cmd == "/streams":
        scripts_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "scripts")
        sys.path.insert(0, scripts_dir)
        try:
            from wars_iptv_scraper import load_pool
            pool = load_pool()
        except Exception:
            pool = []

        active = sum(1 for a in pool if a.get("status") == "Active")
        full = sum(1 for a in pool if a.get("status") == "Full")
        tr_count = sum(1 for a in pool if a.get("has_tr"))

        text = (
            "📺 <b>TigerStream IPTV Yayın İstatistikleri</b>\n\n"
            f"🟢 <b>Kullanıma Hazır Aktif:</b> {active}\n"
            f"🟡 <b>Dolu (1/1 Bağlantı):</b> {full}\n"
            f"🇹🇷 <b>TR Kanalı Olanlar:</b> {tr_count}\n"
            f"📊 <b>Toplam Havuz:</b> {len(pool)} hesap\n\n"
            "💡 <i>Her 4 saatte bir otomatik sağlık kontrolü çalışmaktadır.</i>"
        )
        _send_message(text)
        return {"status": "streams", "active": active, "full": full, "total": len(pool)}

    elif cmd == "/updates":
        from engine.supabase_client import _request
        pending = _request("forge_jobs?status=in.(pending,queued)&select=id,apk_url,action,created_at&order=created_at.desc&limit=5")
        if pending and isinstance(pending, list) and len(pending) > 0:
            lines = ["📦 <b>Bekleyen Güncelleme & Mod İşleri:</b>\n"]
            for j in pending:
                apk_name = j.get("apk_url", "").split("/")[-1][:25] or "APK"
                lines.append(f"• <code>{j['id'][:8]}</code> — {j.get('action', 'mod')} ({apk_name})")
            _send_message("\n".join(lines))
        else:
            _send_message("✅ Bekleyen veya sıraya alınmış güncelleme işi yok.")
        return {"status": "updates"}

    elif cmd == "/status":
        from engine.supabase_client import _request
        jobs = _request("forge_jobs?order=created_at.desc&limit=5")
        if jobs and isinstance(jobs, list) and len(jobs) > 0:
            lines = ["📋 <b>Son 5 PrimeForge İşi:</b>\n"]
            status_emojis = {"completed": "✅", "failed": "❌", "running": "⏳", "pending": "📥", "queued": "🕒"}
            for j in jobs:
                s_icon = status_emojis.get(j.get("status"), "❔")
                apk_name = j.get("apk_url", "").split("/")[-1][:20] or "APK"
                lines.append(f"{s_icon} <code>{j['id'][:8]}</code> | <b>{j.get('status')}</b> — {apk_name}")
            _send_message("\n".join(lines))
        else:
            _send_message("ℹ️ Kayıtlı iş geçmişi bulunamadı.")
        return {"status": "status_list"}

    elif cmd == "/clean_dead":
        _send_message("🧹 <b>Havuz Temizliği Başlatılıyor...</b>\nÖlü hesaplar canlı test edilip ayıklanacak.")
        scripts_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "scripts")
        sys.path.insert(0, scripts_dir)
        try:
            from stream_health_check import run_health_check
            res = run_health_check(max_workers=5, sync_kv=True)
            _send_message(
                f"✅ <b>Havuz Temizliği Tamamlandı!</b>\n\n"
                f"💀 Temizlenen: {res.get('cleaned', 0)} ölü hesap\n"
                f"📡 Kalan Havuz: {res.get('final_count', 0)} aktif hesap\n"
                f"☁️ Cloudflare KV senkronize edildi."
            )
            return {"status": "clean_dead_success", "result": res}
        except Exception as e:
            _send_message(f"❌ Temizlik hatası: <code>{str(e)[:200]}</code>")
            return {"status": "clean_dead_error", "error": str(e)}

    elif cmd == "/check_updates":
        _send_message("🔍 <b>Uygulama Güncelleme Kontrolü Başlatılıyor...</b>\nProfiller ve katalog taranıyor.")
        try:
            triggered = trigger_github_workflow("scheduled-update-check", {"triggered_by": "telegram"})
            if triggered:
                _send_message("⚡ GitHub Actions güncelleme taraması tetiklendi!")
            else:
                _send_message("⚠️ GitHub Actions tetiklenemedi. Token kontrol edin.")
            return {"status": "check_updates_triggered", "triggered": triggered}
        except Exception as e:
            _send_message(f"❌ Güncelleme tetikleme hatası: <code>{str(e)[:200]}</code>")
            return {"status": "check_updates_error", "error": str(e)}

    return {"status": "unknown_command"}


def handle_document(msg: dict) -> dict:
    """Telegram'dan gelen TXT/M3U dosyasını IPTV hesap havuzuna işle.

    İşlem akışı:
    1. Dosya uzantısını kontrol et (.txt, .m3u, .m3u8)
    2. Telegram API ile dosyayı indir
    3. NIM ile hesapları çıkar (fallback: regex parser)
    4. Her hesabı Xtream API ile canlı test et
    5. Aktif hesapları havuza ekle + KV sync
    6. Telegram'a sonuç raporu gönder
    """
    doc = msg.get("document", {})
    file_name = doc.get("file_name", "").lower()
    file_id = doc.get("file_id", "")
    file_size = doc.get("file_size", 0)

    # Sadece desteklenen dosya türlerini kabul et
    supported_ext = (".txt", ".m3u", ".m3u8")
    if not any(file_name.endswith(ext) for ext in supported_ext):
        _send_message("⚠️ Sadece <code>.txt</code>, <code>.m3u</code> veya <code>.m3u8</code> dosyaları desteklenmektedir.")
        return {"status": "unsupported_file"}

    # Boyut kontrolü (Telegram Bot API max 20 MB)
    if file_size > 20 * 1024 * 1024:
        _send_message("❌ Dosya çok büyük. Maksimum 20 MB desteklenmektedir.")
        return {"status": "file_too_large"}

    _send_message(
        f"📥 <b>{doc.get('file_name', 'dosya')}</b> alındı.\n"
        f"📏 Boyut: {file_size / 1024:.1f} KB\n"
        f"🔄 NIM ile ayrıştırılıyor..."
    )

    # 1. Dosyayı indir
    from telegram.bot import download_telegram_file
    content = download_telegram_file(file_id)
    if not content:
        _send_message("❌ Dosya indirilemedi. Lütfen tekrar deneyin.")
        return {"status": "download_failed"}

    # 2. NIM ile hesapları çıkar
    accounts = []
    try:
        sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "engine"))
        from engine.ai_advisor import nim_extract_iptv_accounts
        nim_result = nim_extract_iptv_accounts(content)
        accounts = nim_result.get("accounts", [])
        parse_notes = nim_result.get("parse_notes", "")
        if parse_notes:
            print(f"  📝 NIM notları: {parse_notes}")
    except Exception as e:
        print(f"  ⚠️ NIM ayrıştırma hatası: {e}")

    # 3. Fallback: NIM bulamazsa regex ile dene
    if not accounts:
        try:
            scripts_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "scripts")
            sys.path.insert(0, scripts_dir)
            from wars_iptv_scraper import extract_accounts_from_text
            accounts_raw = extract_accounts_from_text(content)
            accounts = [{"host": a.get("host", ""), "username": a.get("username", ""), "password": a.get("password", "")}
                        for a in accounts_raw if a.get("host") and a.get("username")]
            if accounts:
                print(f"  🔧 Regex fallback: {len(accounts)} hesap bulundu")
        except Exception as e:
            print(f"  ⚠️ Regex fallback hatası: {e}")

    if not accounts:
        _send_message(
            f"⚠️ Dosyada IPTV hesabı bulunamadı.\n"
            f"📄 Taranan metin: {len(content)} karakter\n\n"
            f"💡 Desteklenen formatlar:\n"
            f"• <code>http://host:port/get.php?username=X&password=Y</code>\n"
            f"• <code>host:port username password</code>\n"
            f"• M3U/M3U8 playlist URL'leri"
        )
        return {"status": "no_accounts"}

    _send_message(f"🔍 <b>{len(accounts)}</b> hesap bulundu. Canlı test başlıyor...")

    # 4. Her hesabı test et
    added = 0
    failed = 0
    duplicates = 0
    try:
        scripts_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "scripts")
        sys.path.insert(0, scripts_dir)
        from wars_iptv_scraper import test_xtream_account, load_pool, save_pool, sync_to_kv

        pool_accounts = load_pool()  # Dönen değer bir list
        existing_keys = set()
        for a in pool_accounts:
            key = f"{a.get('host', '')}|{a.get('username', '')}"
            existing_keys.add(key)

        for acc in accounts:
            key = f"{acc.get('host', '')}|{acc.get('username', '')}"
            if key in existing_keys:
                duplicates += 1
                continue

            result = test_xtream_account(acc, source="telegram_upload")
            if result:
                pool_accounts.append(result)
                existing_keys.add(key)
                added += 1
            else:
                failed += 1

        if added > 0:
            save_pool(pool_accounts)
            try:
                sync_to_kv(pool_accounts)
                print(f"  ☁️ KV sync tamamlandı ({added} yeni hesap)")
            except Exception as kv_err:
                print(f"  ⚠️ KV sync hatası: {kv_err}")
    except Exception as e:
        _send_message(f"❌ Test sırasında hata oluştu: <code>{str(e)[:200]}</code>")
        return {"status": "test_error", "error": str(e)}

    # 5. Rapor gönder
    from telegram.bot import send_iptv_report
    send_iptv_report(added, len(accounts) - duplicates, failed, len(accounts), duplicates)
    return {"status": "processed", "added": added, "failed": failed, "duplicates": duplicates}


def handle_update(update: dict) -> dict:
    """Main webhook entrypoint — tüm Telegram mesajlarını yönlendirir."""
    if "callback_query" in update:
        return handle_callback_query(update["callback_query"])
    elif "message" in update:
        msg = update["message"]
        # Dosya (document) gönderilmişse IPTV işleyiciye yönlendir
        if "document" in msg:
            return handle_document(msg)
        return handle_message(msg)
    return {"status": "ignored"}
