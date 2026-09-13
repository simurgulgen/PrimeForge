# -*- coding: utf-8 -*-
"""File uploader for Catbox.moe and ImgBB."""
import os
import sys
import time
import urllib.request
import ssl

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE


def upload_to_catbox(file_path: str, max_retries: int = 4) -> str:
    """Upload a file to catbox.moe and return the URL."""
    filename = os.path.basename(file_path)
    file_size = os.path.getsize(file_path)
    print(f"[Catbox] Upload hazirlaniyor: {filename} ({file_size / (1024*1024):.2f} MB)")

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
            print(f"  [Catbox] Deneme {attempt}/{max_retries}...")
            t0 = time.time()
            with urllib.request.urlopen(req, timeout=600, context=_ctx) as resp:
                url = resp.read().decode("utf-8").strip()
                if url.startswith("https://files.catbox.moe/"):
                    print(f"  [Catbox OK] Yuklendi ({time.time() - t0:.1f}s): {url}")
                    return url
                else:
                    print(f"  [Catbox WARN] Beklenmeyen yanit: {url}")
        except Exception as e:
            print(f"  [Catbox Hata] Deneme {attempt} hatasi: {e}")
            if attempt < max_retries:
                time.sleep(3 * attempt)

    raise RuntimeError(f"Failed to upload {filename} to Catbox after {max_retries} attempts")


def upload_to_imgbb(file_path: str, api_key: str = None, max_retries: int = 3) -> str:
    """Upload an image file to ImgBB (api.imgbb.com) via multipart/form-data and return direct URL."""
    import json

    key = api_key or os.environ.get("IMGBB_API_KEY") or "902f9549fab9d9c25ed84948b10d6248"
    filename = os.path.basename(file_path)

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    boundary = "----WebKitFormBoundaryImgBBUploader7MA4YW"
    body = bytearray()

    # 1. key field
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="key"\r\n\r\n')
    body.extend(key.strip().encode())
    body.extend(b"\r\n")

    # 2. image field (binary file)
    mime = "image/png" if filename.lower().endswith(".png") else "image/jpeg"
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(f'Content-Disposition: form-data; name="image"; filename="{filename}"\r\n'.encode())
    body.extend(f"Content-Type: {mime}\r\n\r\n".encode())
    body.extend(file_bytes)
    body.extend(b"\r\n")

    body.extend(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        "https://api.imgbb.com/1/upload",
        data=bytes(body),
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PrimeForge/1.0",
        },
    )

    for attempt in range(1, max_retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=45, context=_ctx) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                if res.get("success") and "data" in res:
                    url = res["data"].get("url") or res["data"].get("display_url")
                    if url:
                        print(f"  [ImgBB OK] Yuklendi ({filename}): {url}")
                        return url
                err = res.get("error", {}).get("message", "Bilinmeyen ImgBB hatasi")
                print(f"  [ImgBB WARN] Hata yaniti: {err}")
        except Exception as e:
            print(f"  [ImgBB Hata] Deneme {attempt}/{max_retries} hatasi: {e}")
            if attempt < max_retries:
                time.sleep(2 * attempt)

    raise RuntimeError(f"ImgBB yuklemesi basarisiz oldu: {filename}")


def upload_image_smart(file_path: str, api_key: str = None) -> str:
    """
    Akilli Gorsel Yukleyici:
    1. Oncelikli olarak ImgBB (api.imgbb.com) dener.
    2. ImgBB anahtari yoksa, gecersizse (Error 100) veya kota/hata verirse,
       islemin cokmesini onlemek icin otomatik Catbox yedegine gecer.
    """
    key = api_key or os.environ.get("IMGBB_API_KEY") or "902f9549fab9d9c25ed84948b10d6248"
    filename = os.path.basename(file_path)

    # ImgBB API anahtari standart 32 hex karakterdir
    if key and len(key.strip()) >= 30 and len(key.strip()) <= 45:
        try:
            print(f"  [ImgBB] Yukleniyor: {filename}...")
            return upload_to_imgbb(file_path, key.strip())
        except Exception as e:
            print(f"  [ImgBB Hata] ({e}), Catbox yedegine geciliyor...")

    print(f"  [Catbox] {filename} yukleniyor...")
    return upload_to_catbox(file_path)
