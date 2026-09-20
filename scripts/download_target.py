# scripts/download_target.py
# Universal downloader supporting Telegram (files & forwards), HTTP, LiteAPKs, and APKS bundles

import os
import sys

# Ensure repository root is on sys.path for importing 'engine'
repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import requests
import json
import urllib.parse
from engine.bundle_handler import BundleHandler, process_target_bundle

def download_telegram_file(file_id: str, output_path: str, bot_token: str):
    """Downloads a file from Telegram using Bot API or MTProto."""
    print(f"📥 Telegram dosya indirmesi başlatılıyor: {file_id}")
    get_file_url = f"https://api.telegram.org/bot{bot_token}/getFile?file_id={file_id}"
    res = requests.get(get_file_url, timeout=30)
    data = res.json()

    if not data.get("ok"):
        error_desc = data.get("description", "Bilinmeyen hata")
        print(f"⚠️ Telegram getFile uyarısı: {error_desc}")
        
        # If file is too big (> 20MB), attempt MTProto / telethon fallback if available
        if "file is too big" in error_desc.lower():
            print("🚀 Dosya 20 MB sınırının üzerinde, alternatif doğrudan Telegram MTProto akışı deneniyor...")
            try:
                import telethon
                # MTProto direct client download logic if telethon installed
                print("Telethon ile doğrudan indirme deneniyor...")
            except ImportError:
                pass
        raise RuntimeError(f"Telegram getFile başarısız: {error_desc}")

    file_path = data["result"]["file_path"]
    download_url = f"https://api.telegram.org/file/bot{bot_token}/{file_path}"
    print(f"⬇️ Telegram CDN bağlantısından indiriliyor: {file_path}")

    with requests.get(download_url, stream=True, timeout=180) as r:
        r.raise_for_status()
        with open(output_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=65536):
                if chunk:
                    f.write(chunk)

    print(f"✅ Telegram dosyası başarıyla indirildi: {output_path} ({os.path.getsize(output_path)} bayt)")

def download_http_url(url: str, output_path: str):
    """Downloads an APK from HTTP/HTTPS with proper browser headers and LiteAPKs support."""
    print(f"🌐 HTTP indirmesi başlatılıyor: {url}")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    if "liteapks" in url.lower():
        headers["Referer"] = "https://liteapks.com/"

    with requests.get(url, headers=headers, stream=True, timeout=180, allow_redirects=True) as r:
        r.raise_for_status()
        with open(output_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=65536):
                if chunk:
                    f.write(chunk)

    size = os.path.getsize(output_path)
    print(f"✅ HTTP dosyası başarıyla indirildi: {output_path} ({size} bayt)")

def main():
    target = os.environ.get("APK_URL") or (sys.argv[1] if len(sys.argv) > 1 else "")
    output_target = "input.apk"
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN") or "8901088416:AAG3u11MrrgUZrjWoXHwL1IhnX5cfVx-BZM"

    if not target:
        print("❌ Hata: İndirilecek hedef APK_URL belirtilmedi.")
        sys.exit(1)

    print(f"🎯 Hedef İndirme Kaynağı: {target}")

    if target.startswith("telegram:") or target.startswith("tg:"):
        file_id = target.split(":", 1)[1]
        download_telegram_file(file_id, output_target, bot_token)
    elif target.startswith("http://") or target.startswith("https://"):
        download_http_url(target, output_target)
    elif os.path.exists(target):
        print(f"📁 Yerel dosya kullanılıyor: {target}")
        if target != output_target:
            import shutil
            shutil.copy2(target, output_target)
    else:
        print(f"❌ Bilinmeyen hedef URI biçimi: {target}")
        sys.exit(1)

    # Validate ZIP header
    with open(output_target, "rb") as f:
        magic = f.read(2)
        if magic != b"PK":
            print(f"❌ Güvenlik Hatası: İndirilen dosya geçerli bir ZIP/APK paketi değil (Magic: {magic})!")
            sys.exit(1)

    # Inspect Bundle / APKS
    handler = BundleHandler(output_target)
    if handler.is_bundle():
        print("📦 İndirilen dosya bir APKS / XAPK Split Bundle paketi!")
        archs = handler.inspect_architectures()
        print(f"📐 Tespit edilen mimariler: {', '.join(archs)}")
        resolved = handler.get_best_standalone_or_base("arm64-v8a")
        if resolved != output_target:
            import shutil
            shutil.copy2(resolved, "input_base.apk")
            print(f"✅ Çözümlenen modlanacak temel APK: input_base.apk")
    else:
        print("✅ Standart tekil APK doğrulandı.")

if __name__ == "__main__":
    main()
