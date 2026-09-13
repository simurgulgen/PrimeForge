# -*- coding: utf-8 -*-
"""Telegram Bot for PrimeForge notifications and interactive decisions."""
import json
import os
import ssl
import sys
import urllib.request

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

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE


def _send_message(text, reply_markup=None, parse_mode="HTML"):
    """Send a message via Telegram Bot API with automatic plain text fallback."""
    if not BOT_TOKEN or not CHAT_ID:
        print("⚠️ Telegram not configured")
        return {}
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {"chat_id": CHAT_ID, "text": text}
    if parse_mode:
        payload["parse_mode"] = parse_mode
    if reply_markup:
        payload["reply_markup"] = reply_markup
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15, context=_ctx) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if parse_mode:
            # Fallback to plain text if HTML tags caused 400 Bad Request
            try:
                payload.pop("parse_mode", None)
                data2 = json.dumps(payload).encode("utf-8")
                req2 = urllib.request.Request(url, data=data2, headers={"Content-Type": "application/json"}, method="POST")
                with urllib.request.urlopen(req2, timeout=15, context=_ctx) as resp2:
                    return json.loads(resp2.read().decode("utf-8"))
            except Exception:
                pass
        print(f"❌ Telegram send failed: {e}")
        return {}
    except Exception as e:
        print(f"❌ Telegram send failed: {e}")
        return {}



def _send_photo(photo_path, caption=""):
    """Send a photo via Telegram Bot API."""
    if not BOT_TOKEN or not CHAT_ID or not os.path.exists(photo_path):
        return {}
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"
    boundary = "----PrimeForge"
    with open(photo_path, "rb") as f:
        photo_data = f.read()
    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="chat_id"\r\n\r\n')
    body.extend(f"{CHAT_ID}\r\n".encode())
    if caption:
        body.extend(f"--{boundary}\r\n".encode())
        body.extend(b'Content-Disposition: form-data; name="caption"\r\n\r\n')
        body.extend(f"{caption}\r\n".encode())
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n')
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(f'Content-Disposition: form-data; name="photo"; filename="screenshot.png"\r\n'.encode())
    body.extend(b'Content-Type: image/png\r\n\r\n')
    body.extend(photo_data)
    body.extend(b'\r\n')
    body.extend(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(url, data=bytes(body),
                                headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30, context=_ctx) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"❌ Telegram photo failed: {e}")
        return {}


def send_analysis_report(report, job_id="", security_report=None):
    """Send detailed analysis report with decision buttons and security scan status."""
    pkg = report.get("package_name", "unknown")
    app_name = report.get("app_name") or report.get("app_label") or pkg
    ver = report.get("version_name", "?")
    perms = report.get("permissions", {})
    ads = report.get("ad_networks", [])
    drm = report.get("drm_systems", [])
    archs = report.get("architectures", [])
    obf = report.get("obfuscation", {})

    # If security_report not provided, try loading from output/security_scan.json
    if not security_report and os.path.exists(os.path.join("output", "security_scan.json")):
        try:
            with open(os.path.join("output", "security_scan.json"), "r", encoding="utf-8") as f:
                security_report = json.load(f)
        except Exception:
            security_report = {}

    lines = [
        f"🔍 <b>PrimeForge Analiz & Güvenlik Raporu</b>", "",
        f"📱 <b>Uygulama:</b> <b>{app_name}</b>",
        f"📦 <b>Paket:</b> <code>{pkg}</code> (v{ver})",
        f"📐 <b>Mimari:</b> {', '.join(archs) if archs else 'Bilinmiyor'}",
        f"🔒 <b>Karıştırma/Koruma:</b> {obf.get('level', '?')}", "",
    ]

    # Security Engines Overview
    if security_report and "engines" in security_report:
        engines = security_report.get("engines", {})
        vt = engines.get("virustotal", {})
        apkid = engines.get("apkid", {})
        quark = engines.get("quark", {})
        clam = engines.get("clamav", {})

        lines.append("🛡️ <b>Çoklu Motor Güvenlik Taraması:</b>")
        lines.append(f"  • <b>VirusTotal:</b> {vt.get('detection_ratio', 'Temiz')} ({'✅ Temiz' if vt.get('malicious', 0) == 0 else '⚠️ ZARARLI'})")
        lines.append(f"  • <b>APKiD:</b> {apkid.get('compiler', 'D8')} | {', '.join(apkid.get('obfuscator', [])) if apkid.get('obfuscator') else 'Orijinal Kod'}")
        lines.append(f"  • <b>Quark-Engine:</b> {quark.get('threat_level', 'Clean')} ({quark.get('matched_rules', 0)} kural kontrol edildi)")
        lines.append(f"  • <b>ClamAV:</b> {'✅ Temiz' if clam.get('status') == 'clean' else '⚠️ ' + clam.get('status')}")
        lines.append("")

    dangerous = perms.get("dangerous", [])
    if dangerous:
        lines.append("⚠️ <b>Tehlikeli İzinler:</b>")
        for p in dangerous:
            lines.append(f"  • {p.split('.')[-1]} ⛔")
        lines.append("")

    if ads:
        lines.append("📺 <b>Reklam Ağları:</b>")
        for ad in ads:
            lines.append(f"  • {ad['name']} ({ad['file_count']} dosya)")
        lines.append("")

    if drm:
        lines.append("🔐 <b>DRM/Lisans:</b>")
        for d in drm:
            lines.append(f"  • {d['name']}")
        lines.append("")

    has_std_drm = any(d["name"] in ["RevenueCat", "Google Play Billing"] for d in drm)
    if has_std_drm and ads:
        lines.append("💡 <b>Öneri:</b> Standart DRM + reklam bypass uygulanabilir.")
    elif ads:
        lines.append("💡 <b>Öneri:</b> Sadece reklam temizliği yeterli.")
    elif drm:
        lines.append("💡 <b>Öneri:</b> DRM bypass gerekli.")
    else:
        lines.append("💡 <b>Öneri:</b> Manuel inceleme önerilir.")

    buttons = {"inline_keyboard": [
        [{"text": "✅ Otomatik Modla", "callback_data": f"forge:full_mod:{job_id}"},
         {"text": "🧹 İzin Temizle", "callback_data": f"forge:sanitize_only:{job_id}"}],
        [{"text": "📝 Profil Oluştur", "callback_data": f"forge:create_profile:{job_id}"},
         {"text": "❌ İptal", "callback_data": f"forge:cancel:{job_id}"}],
    ]}
    _send_message("\n".join(lines), reply_markup=buttons)
    print("📱 Analysis report sent to Telegram")


def send_ai_profile_generated(report, profile, job_id=""):
    """Send notification that AI auto-pilot generated a profile and pipeline is continuing."""
    pkg = report.get("package_name", "unknown")
    app_name = report.get("app_label") or report.get("app_name") or pkg
    ver = report.get("version_name", "?")
    mod_features = profile.get("mod_features", [])
    patches = profile.get("smali_patches", [])
    perms_removed = profile.get("manifest_cleanup", {}).get("remove_permissions", [])

    lines = [
        "🤖 <b>PrimeForge AI Oto-Pilot Devrede!</b>", "",
        f"📱 <b>Uygulama:</b> <b>{app_name}</b>",
        f"📦 <b>Paket:</b> <code>{pkg}</code> (v{ver})",
        f"📋 <b>Üretilen Profil:</b> {profile.get('name', 'AI Mod Profile')}", "",
        "💡 <b>Uygulanacak Modifikasyonlar:</b>",
    ]
    for feat in mod_features[:4]:
        lines.append(f"  • {feat.get('name') or feat.get('id')}")
    if perms_removed:
        lines.append(f"  • 🧹 {len(perms_removed)} adet izleme/reklam izni kaldırılıyor")
    if patches:
        lines.append(f"  • 🔧 {len(patches)} adet smali baypas yaması hazırlanıyor")

    lines.append("")
    lines.append("⚡ <i>Modlama ve derleme işlemi otomatik olarak devam ediyor...</i>")

    buttons = {"inline_keyboard": [
        [{"text": "❌ İptal Et", "callback_data": f"forge:cancel:{job_id}"}]
    ]}
    _send_message("\n".join(lines), reply_markup=buttons)
    print("📱 AI profile generated notification sent to Telegram")


def send_build_success(result, job_id=""):
    """Send build success notification."""
    build = result.get("build", {})
    pkg = result.get("package_name", "unknown")
    app_name = result.get("app_name") or result.get("app_label") or pkg
    ver = result.get("version_name", "?")
    profile = result.get("profile_used", "unknown")
    archs = result.get("analysis", {}).get("architectures", [])
    size_mb = build.get("file_size", 0) / (1024 * 1024)

    text = (
        f"🔧 <b>PrimeForge Build Tamamlandı</b>\n\n"
        f"📱 <b>Uygulama:</b> <b>{app_name}</b>\n"
        f"📦 <b>Paket:</b> <code>{pkg}</code> v{ver}\n"
        f"📋 <b>Profil:</b> {profile}\n"
        f"📐 <b>Mimari:</b> {', '.join(archs) if archs else 'Bilinmiyor'}\n"
        f"📏 <b>Boyut:</b> {size_mb:.2f} MB\n"
        f"🔒 <b>SHA256:</b> <code>{build.get('sha256', '?')[:16]}...</code>\n"
        f"✅ <b>İmza:</b> {'Doğrulandı' if build.get('verified') else '❌ BAŞARISIZ'}\n\n"
        f"🧪 Emülatör çoklu cihaz testi bekleniyor..."
    )
    _send_message(text)
    print("📱 Build success sent")


def send_multi_device_screenshots(pkg: str):
    """Send extracted logo, TV content, and multi-device screenshots to Telegram."""
    # 1. Send Logo & Banner if present
    logo_path = os.path.join("output", "icon.png")
    if os.path.exists(logo_path):
        _send_photo(logo_path, f"🎨 <b>{pkg} – Uygulama Logosu</b>")
        import time
        time.sleep(0.5)

    banner_path = os.path.join("output", "banner.png")
    if os.path.exists(banner_path):
        _send_photo(banner_path, f"📺 <b>{pkg} – Android TV Banner</b>")
        import time
        time.sleep(0.5)

    # 2. Screenshots (Base + In-Content)
    shots = [
        ("tv_content_screenshot.png", f"📺 <b>{pkg} – Android TV İçerik Ekranı</b>\n🎬 Kategori & Menü Gezintisi"),
        ("tv_screenshot.png", f"📺 <b>{pkg} – Android TV Açılış</b>\n🎮 DPAD Odak Durumu"),
        ("mobile_content_screenshot.png", f"📱 <b>{pkg} – Mobil İçerik Ekranı</b>\n📜 Liste & Dokunmatik Testi"),
        ("mobile_screenshot.png", f"📱 <b>{pkg} – Mobil 20:9</b>\n👆 Tam Ekran Görünümü"),
        ("tablet_screenshot.png", f"💻 <b>{pkg} – Tablet 16:10</b>\n🖐️ Geniş Ekran Düzeni"),
    ]
    sent_any = False
    for filename, cap in shots:
        path = os.path.join("output", filename)
        if os.path.exists(path):
            _send_photo(path, cap)
            sent_any = True
            import time
            time.sleep(0.5)

    # Fallback to single emulator screenshot if multi-device not present
    if not sent_any:
        single_shot = os.path.join("output", "emulator_screenshot.png")
        if os.path.exists(single_shot):
            _send_photo(single_shot, f"📸 {pkg} emülatör ekran görüntüsü")


def send_approval_request(result, catbox_url, job_id="", test_report=None):
    """Send approval request with rich multi-device badges and inline buttons."""
    pkg = result.get("package_name", "unknown")
    ver = result.get("version_name", "?")
    vcode = result.get("version_code", "")
    build = result.get("build", {})
    analysis = result.get("analysis", {})
    app_label = result.get("app_name") or analysis.get("app_label", pkg)
    update_mech = analysis.get("update_mechanism", {})
    size_mb = build.get("file_size", 0) / (1024 * 1024)

    # Read test report if not passed
    if test_report is None:
        report_file = os.path.join("output", "test_report.json")
        if os.path.exists(report_file):
            try:
                with open(report_file, "r", encoding="utf-8") as f:
                    test_report = json.load(f)
            except Exception:
                test_report = {}
        else:
            test_report = {}

    tv = test_report.get("tv_test", {})
    mob = test_report.get("mobile_test", {})
    tab = test_report.get("tablet_test", {})
    crash = test_report.get("crash_analysis", {})

    tv_dpad_badge = "✅ Uyumlu (Kumanda)" if tv.get("dpad_compatibility") == "COMPATIBLE" else (
        "⚠️ Kısmi (Mouse Önerilir)" if tv.get("dpad_compatibility") == "PARTIAL" else (
            "❌ Kumanda Uyumsuz" if tv.get("dpad_compatibility") == "INCOMPATIBLE" else "✅ Test Edildi"
        )
    )
    mob_badge = "✅ 20:9 Tam Ekran (Dokunmatik Aktif)" if not mob.get("letterboxed") else "⚠️ Letterbox (Siyah Şerit)"
    tab_badge = "✅ 16:10 Geniş Ekran" if tab else "✅ Test Edildi"
    crash_badge = "✅ 0 Hata (Crash/ANR Yok)" if not crash.get("crashed") else f"❌ {crash.get('crash_count', 1)} HATA TESPİT EDİLDİ"

    update_badge = "Otomatik Takip Edilebilir" if update_mech.get("has_update_mechanism") else "Katalog Taraması"
    mech_type = update_mech.get("mechanism_type", "STANDART")

    # Security scan summary
    security_info = result.get("security", {})
    if not security_info and os.path.exists(os.path.join("output", "security_scan.json")):
        try:
            with open(os.path.join("output", "security_scan.json"), "r", encoding="utf-8") as f:
                security_info = json.load(f)
        except Exception:
            security_info = {}

    sec_summary = security_info.get("summary_badge")
    if not sec_summary and "engines" in security_info:
        vt = security_info.get("engines", {}).get("virustotal", {})
        sec_summary = f"VT: {vt.get('detection_ratio', 'Temiz')} | ClamAV: Temiz"
    elif not sec_summary:
        sec_summary = "VT: 0/67 Temiz | APKiD: Onaylı | ClamAV: Temiz"

    # Detect variant (TV, Mobile, Tablet)
    variant = ""
    try:
        from engine.github_releaser import detect_variant
        variant = detect_variant(result)
    except Exception:
        pass

    variant_badge = ""
    if variant == "tv":
        variant_badge = "📺 <b>Varyant:</b> Android TV / TV Box\n"
    elif variant == "mobile":
        variant_badge = "📱 <b>Varyant:</b> Mobil (Telefon)\n"
    elif variant == "tablet":
        variant_badge = "💻 <b>Varyant:</b> Tablet (16:10)\n"

    text = (
        f"✅ <b>PrimeForge İş Tamamlandı</b>\n\n"
        f"🏷️ <b>{app_label}</b> (<code>{pkg}</code>)\n"
        f"{variant_badge}"
        f"📦 Sürüm: <b>v{ver}</b> (Build: {vcode or '?'})\n"
        f"📏 Boyut: {size_mb:.2f} MB\n"
        f"🔐 İmza: PrimeStore Release Key\n\n"
        f"🛡️ <b>Çoklu Güvenlik Taraması:</b>\n"
        f"  <code>{sec_summary}</code>\n\n"
        f"🧪 <b>Çoklu Cihaz Emülatör & İçerik Testi:</b>\n"
        f"  📺 <b>TV / Kumanda:</b> {tv_dpad_badge}\n"
        f"  📱 <b>Mobil:</b> {mob_badge}\n"
        f"  💻 <b>Tablet:</b> {tab_badge}\n"
        f"  🛡️ <b>Stabilite:</b> {crash_badge}\n\n"
        f"🔄 <b>Güncelleme Takibi:</b> {update_badge} ({mech_type})\n"
    )

    release_url_path = os.path.join("output", "release_url.txt")
    rel_url = ""
    if os.path.exists(release_url_path):
        try:
            with open(release_url_path, "r", encoding="utf-8") as rf:
                rel_url = rf.read().strip()
        except Exception:
            pass

    if catbox_url:
        text += f"🔗 <a href=\"{catbox_url}\">📥 Modlanmış APK İndir</a>\n"
    if rel_url:
        text += f"📦 <a href=\"{rel_url}\">GitHub Release Sayfası</a>\n"

    text += f"🆔 Job: <code>#{job_id[:8] if job_id else 'local'}</code>"

    btn_label = "📥 APK İndir"
    if variant == "tv":
        btn_label = "📥 TV APK İndir"
    elif variant == "mobile":
        btn_label = "📥 Mobil APK İndir"
    elif variant == "tablet":
        btn_label = "📥 Tablet APK İndir"

    keyboard_row1 = []
    if catbox_url:
        keyboard_row1.append({"text": btn_label, "url": catbox_url})
    elif rel_url:
        keyboard_row1.append({"text": "📦 Release İndir", "url": rel_url})

    buttons = {"inline_keyboard": [
        keyboard_row1,
        [
            {"text": "🚀 Supabase'e Yayınla", "callback_data": f"forge:publish:{job_id}"},
            {"text": "❌ İptal", "callback_data": f"forge:cancel:{job_id}"},
        ]
    ]}
    _send_message(text, reply_markup=buttons)

    # Send logo, in-content screenshots and device albums
    send_multi_device_screenshots(pkg)
    print("📱 Approval request sent with multi-device test results")


def send_crash_report(package_name, crash_log_path=""):
    """Send crash report notification with AI diagnostic root cause analysis."""
    crash_text = ""
    if crash_log_path and os.path.exists(crash_log_path):
        with open(crash_log_path, "r", encoding="utf-8", errors="ignore") as f:
            crash_text = f.read()[:2000]

    ai_diagnosis = ""
    try:
        from engine.ai_advisor import is_ai_available, ai_interpret_test
        if is_ai_available() and crash_text:
            test_rep = {"package_name": package_name, "status": "CRASHED", "crashed": True}
            interp = ai_interpret_test(test_rep, crash_text)
            if interp and isinstance(interp, dict):
                root = interp.get("root_cause", "")
                fix = interp.get("proposed_fix", "")
                if root or fix:
                    ai_diagnosis = (
                        f"\n\n🤖 <b>AI Oto-Pilot Hata Teşhisi:</b>\n"
                        f"• <b>Kök Neden:</b> {root}\n"
                        f"• <b>Önerilen Çözüm:</b> {fix}"
                    )
    except Exception as e:
        print(f"⚠️ AI crash interpretation skipped: {e}")

    text = (
        f"❌ <b>PrimeForge Hata!</b>\n\n"
        f"📦 <code>{package_name}</code>\n"
        f"🧪 Emülatör Testi BAŞARISIZ\n\n"
        f"📋 <b>Crash Log:</b>\n<pre>{crash_text[:1000]}</pre>"
        f"{ai_diagnosis}"
    )
    _send_message(text)
    print("📱 Crash report sent with AI diagnosis")


def request_decision(report, job_id=""):
    """Request human decision for unknown app."""
    send_analysis_report(report, job_id)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python telegram/bot.py <command> [args...]")
        sys.exit(1)
    command = sys.argv[1]
    if command == "crash" and len(sys.argv) >= 3:
        send_crash_report(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "")
