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
