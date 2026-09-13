# -*- coding: utf-8 -*-
"""File uploader for Catbox.moe."""
import os
import time
import urllib.request
import ssl

_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE


def upload_to_catbox(file_path: str, max_retries: int = 4) -> str:
    """Upload a file to catbox.moe and return the URL."""
    filename = os.path.basename(file_path)
    file_size = os.path.getsize(file_path)
    print(f"📤 Preparing upload: {filename} ({file_size / (1024*1024):.2f} MB)")

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="reqtype"\r\n\r\n')
    body.extend(b'fileupload\r\n')
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(f'Content-Disposition: form-data; name="fileToUpload"; filename="{filename}"\r\n'.encode())
    body.extend(b'Content-Type: application/vnd.android.package-archive\r\n\r\n')
    body.extend(file_bytes)
    body.extend(b'\r\n')
    body.extend(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        "https://catbox.moe/user/api.php",
        data=bytes(body),
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) PrimeForge/1.0",
        },
    )

    for attempt in range(1, max_retries + 1):
        try:
            print(f"  ☁️ Upload attempt {attempt}/{max_retries}...")
            t0 = time.time()
            with urllib.request.urlopen(req, timeout=600, context=_ctx) as resp:
                url = resp.read().decode("utf-8").strip()
                if url.startswith("https://files.catbox.moe/"):
                    print(f"  ✅ Uploaded in {time.time() - t0:.1f}s: {url}")
                    return url
                else:
                    print(f"  ⚠️ Unexpected response: {url}")
        except Exception as e:
            print(f"  ❌ Attempt {attempt} error: {e}")
            if attempt < max_retries:
                time.sleep(3 * attempt)

    raise RuntimeError(f"Failed to upload {filename} to Catbox after {max_retries} attempts")


def upload_to_imgbb(file_path: str, api_key: str = None, max_retries: int = 3) -> str:
    """Upload an image file to ImgBB (api.imgbb.com) and return the permanent direct URL."""
    import base64
    import json
    import urllib.parse

    key = api_key or os.environ.get("IMGBB_API_KEY")
    if not key:
        raise ValueError("IMGBB_API_KEY bulunamadı.")

    filename = os.path.basename(file_path)
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    b64_image = base64.b64encode(file_bytes).decode("ascii")

    data = urllib.parse.urlencode({
        "key": key.strip(),
        "image": b64_image,
        "name": filename,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.imgbb.com/1/upload",
        data=data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PrimeForge/1.0",
        },
    )

    for attempt in range(1, max_retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=40, context=_ctx) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                if res.get("success") and "data" in res:
                    url = res["data"].get("url") or res["data"].get("display_url")
                    if url:
                        print(f"  🖼️ ImgBB Yüklendi: {url}")
                        return url
                err = res.get("error", {}).get("message", "Bilinmeyen ImgBB hatası")
                print(f"  ⚠️ ImgBB Hatası: {err}")
        except Exception as e:
            print(f"  ❌ ImgBB deneme {attempt}/{max_retries} hatası: {e}")
            if attempt < max_retries:
                time.sleep(2 * attempt)

    raise RuntimeError(f"ImgBB yüklemesi başarısız oldu: {filename}")


def upload_image_smart(file_path: str, api_key: str = None) -> str:
    """
    Akıllı Görsel Yükleyici:
    1. Öncelikli olarak ImgBB (api.imgbb.com) dener.
    2. ImgBB anahtarı yoksa, geçersizse (Error 100) veya kota/hata verirse,
       işlemin çökmesini önlemek için otomatik Catbox yedeğine geçer.
    """
    key = api_key or os.environ.get("IMGBB_API_KEY")
    filename = os.path.basename(file_path)

    # ImgBB API anahtarı standart 32 hex karakterdir
    if key and len(key.strip()) >= 30 and len(key.strip()) <= 45:
        try:
            print(f"  📸 ImgBB yüklemesi deneniyor: {filename}...")
            return upload_to_imgbb(file_path, key.strip())
        except Exception as e:
            print(f"  ⚠️ ImgBB yüklenemedi ({e}), Catbox yedeğine geçiliyor...")

    print(f"  ☁️ {filename} Catbox'a yükleniyor...")
    return upload_to_catbox(file_path)
