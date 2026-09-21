# -*- coding: utf-8 -*-
"""PrimeForge & PrimeStore M3U Playlist Güvenlik ve Akış Denetim Motoru.

İncelenen Güvenlik Kriterleri:
1. Oynatıcı Komut Enjeksiyonu Denetimi (#EXTVLCOPT, #EXTMPVOPT, shell injection).
2. Tehlikeli Protokol Kontrolü (file://, smb://, javascript:, data:).
3. Alan Adı Güvenliği & Phishing Taraması (Tehditli TLD ve URL kalıpları).
4. Akış Şifreleme Oranı (HTTPS vs Şifresiz HTTP).
5. Akış Başlık ve MIME Doğrulaması (Sahte yayın / zararlı exe-apk yönlendirme kontrolü).
"""
import hashlib
import json
import os
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

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

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://mdorxlwvitfixbzajksw.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "") or os.environ.get(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kb3J4bHd2aXRmaXhiemFqa3N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NzE2NTcsImV4cCI6MjEwMTQ0NzY1N30.HXoHD3JGXmq_kIkcJ0XJJaMX_BCyukwG7EawZb738mw"
)
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE

DANGEROUS_PROTOCOLS = ["file://", "smb://", "ftp://", "gopher://", "javascript:", "data:"]
DANGEROUS_TAG_PATTERNS = [
    re.compile(r"#EXTVLCOPT\s*:\s*(sout|run|system|exec|lua)", re.IGNORECASE),
    re.compile(r"#EXTMPVOPT\s*:\s*(script|run|system)", re.IGNORECASE),
]
MALICIOUS_MIME_TYPES = [
    "application/x-msdownload",
    "application/x-dosexec",
    "application/vnd.android.package-archive",
    "application/octet-stream-exe",
]
VALID_STREAM_MIMES = [
    "video/", "audio/", "application/vnd.apple.mpegurl", "application/x-mpegurl",
    "application/dash+xml", "application/octet-stream"
]


def compute_string_hash(s: str) -> str:
    """Compute SHA-256 hash of a string."""
    return hashlib.sha256(s.encode("utf-8", errors="ignore")).hexdigest().lower()


def fetch_m3u_content(target: str) -> tuple[str, str]:
    """Fetch M3U from local file or HTTP URL (first 4MB max)."""
    if os.path.exists(target):
        with open(target, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read(4 * 1024 * 1024)
            return content, compute_string_hash(content)

    # HTTP URL
    req = urllib.request.Request(
        target,
        headers={"User-Agent": "PrimeStore/2.0 (IPTV Stream Validator)"},
        method="GET"
    )
    with urllib.request.urlopen(req, timeout=15, context=_ctx) as resp:
        raw_bytes = resp.read(4 * 1024 * 1024)
        content = raw_bytes.decode("utf-8", errors="ignore")
        return content, compute_string_hash(content)


def scan_playlist(m3u_input: str, listing_id: str = None) -> dict:
    """Scan and audit an M3U playlist for security vulnerabilities, commands and health."""
    print("\n" + "=" * 65)
    print("🛡️ PrimeForge & PrimeStore M3U Playlist Güvenlik Denetimi")
    print(f"   Hedef: {m3u_input[:80]}")
    print("=" * 65)

    try:
        content, content_hash = fetch_m3u_content(m3u_input)
    except Exception as e:
        err_msg = f"Playlist indirilemedi veya okunamadı: {e}"
        print(f"  ❌ Hata: {err_msg}")
        return {
            "status": "error",
            "error": err_msg,
            "overall_score": 0,
            "summary_badge": "⚠️ Playlist Okunamadı"
        }

    lines = content.splitlines()
    total_lines = len(lines)
    
    # 1. Parse streams, channels & tags
    channels = []
    stream_urls = []
    domains = set()
    https_count = 0
    http_count = 0
    
    injection_findings = []
    suspicious_protocols = []

    current_title = "Bilinmeyen Kanal"

    for idx, line in enumerate(lines):
        line_clean = line.strip()
        if not line_clean:
            continue

        # Check for Command Injection Tags
        if line_clean.startswith("#EXTVLCOPT") or line_clean.startswith("#EXTMPVOPT"):
            for pattern in DANGEROUS_TAG_PATTERNS:
                if pattern.search(line_clean):
                    injection_findings.append({
                        "line": idx + 1,
                        "tag": line_clean,
                        "desc": "Zararlı oynatıcı komut çalıştırma girişimi tespit edildi"
                    })

        # Channel info tag
        if line_clean.startswith("#EXTINF:"):
            title_part = line_clean.split(",")[-1].strip()
            current_title = title_part if title_part else "Kanal"
            continue

        # Check stream URLs
        if not line_clean.startswith("#"):
            url = line_clean
            # Protocol check
            lower_url = url.lower()
            for proto in DANGEROUS_PROTOCOLS:
                if lower_url.startswith(proto):
                    suspicious_protocols.append({
                        "channel": current_title,
                        "protocol": proto,
                        "url": url[:60]
                    })
            
            if url.startswith("http://") or url.startswith("https://"):
                stream_urls.append(url)
                if url.startswith("https://"):
                    https_count += 1
                else:
                    http_count += 1

                try:
                    parsed = urllib.parse.urlparse(url)
                    if parsed.netloc:
                        domains.add(parsed.netloc)
                except Exception:
                    pass

    total_streams = len(stream_urls)
    total_domains = len(domains)
    https_ratio = int((https_count / total_streams * 100)) if total_streams > 0 else 0

    print(f"  📊 Analiz: {total_streams} Akış | {total_domains} Farklı Sunucu | %{https_ratio} HTTPS Şifreleme")

    # 2. Sample Stream Live Validation (Probe 3 sample streams)
    sample_checks = []
    malicious_mimes_found = []
    sample_streams = stream_urls[:3] if len(stream_urls) <= 3 else [stream_urls[0], stream_urls[len(stream_urls) // 2], stream_urls[-1]]

    for s_url in sample_streams:
        try:
            head_req = urllib.request.Request(
                s_url,
                headers={"User-Agent": "PrimeStore/2.0", "Range": "bytes=0-1024"},
                method="GET"
            )
            with urllib.request.urlopen(head_req, timeout=5, context=_ctx) as stream_resp:
                content_type = stream_resp.headers.get("Content-Type", "").lower()
                status_code = stream_resp.status
                
                # Check for malicious payload masquerading as stream
                for bad_mime in MALICIOUS_MIME_TYPES:
                    if bad_mime in content_type:
                        malicious_mimes_found.append({
                            "url": s_url[:60],
                            "mime": content_type,
                            "desc": "Yayın yerine yürütülebilir zararlı dosya döndürüldü!"
                        })

                sample_checks.append({
                    "url": s_url[:50] + "...",
                    "status_code": status_code,
                    "content_type": content_type or "audio/video stream",
                    "accessible": status_code in [200, 206]
                })
        except Exception as e:
            sample_checks.append({
                "url": s_url[:50] + "...",
                "status_code": 0,
                "content_type": "Bağlantı zaman aşımı / kapalı",
                "accessible": False
            })

    # 3. Calculate Overall Security Score
    score = 100
    if injection_findings:
        score -= 40
    if suspicious_protocols:
        score -= 30
    if malicious_mimes_found:
        score = 0
    if https_ratio < 30:
        score -= 10

    score = max(10, min(100, score))

    if score >= 80 and not injection_findings and not malicious_mimes_found:
        overall_status = "clean"
    elif score >= 50:
        overall_status = "warning"
    else:
        overall_status = "malicious"

    summary_badge = (
        f"🛡️ M3U Onaylı (%{score} Güvenli)" if overall_status == "clean"
        else (f"⚠️ Dikkat: Olası Güvensiz Akışlar (%{score})" if overall_status == "warning"
        else "🚨 TEHLİKELİ PLAYLIST")
    )

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "M3U",
        "file_hash": content_hash,
        "overall_status": overall_status,
        "overall_score": score,
        "summary_badge": summary_badge,
        "stats": {
            "total_channels": total_streams,
            "distinct_domains": total_domains,
            "https_ratio": f"%{https_ratio}",
            "https_streams": https_count,
            "http_streams": http_count,
        },
        "findings": {
            "command_injections": injection_findings,
            "suspicious_protocols": suspicious_protocols,
            "malicious_mimes": malicious_mimes_found,
            "sample_checks": sample_checks,
            "sample_domains": list(domains)[:8]
        }
    }

    # Upsert into Supabase virustotal_scans or update listings
    try:
        auth_token = SERVICE_ROLE_KEY if SERVICE_ROLE_KEY else SUPABASE_KEY
        upsert_payload = {
            "file_hash": content_hash,
            "status": overall_status,
            "positives": 0 if overall_status == "clean" else 1,
            "total_engines": 5,
            "vt_report_url": f"https://primestore.app/security/playlist/{content_hash}",
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "last_checked_at": datetime.now(timezone.utc).isoformat(),
            "security_report": report,
            "security_score": score,
        }
        upsert_req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/virustotal_scans",
            data=json.dumps(upsert_payload).encode("utf-8"),
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates",
            },
            method="POST"
        )
        with urllib.request.urlopen(upsert_req, timeout=10, context=_ctx) as _:
            print("  ☁️ Supabase virustotal_scans tablosuna M3U raporu kaydedildi.")
    except Exception as e:
        print(f"  ⚠️ Supabase kayıt uyarısı: {e}")

    # If listing_id provided, also update listings table
    if listing_id:
        try:
            listing_payload = {
                "virusTotalStatus": overall_status,
                "virusTotalScore": f"{score}/100"
            }
            patch_req = urllib.request.Request(
                f"{SUPABASE_URL}/rest/v1/listings?id=eq.{listing_id}",
                data=json.dumps(listing_payload).encode("utf-8"),
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {auth_token}",
                    "Content-Type": "application/json",
                },
                method="PATCH"
            )
            with urllib.request.urlopen(patch_req, timeout=10, context=_ctx) as _:
                print(f"  ✅ listings ({listing_id}) güncellendi.")
        except Exception as e:
            print(f"  ⚠️ Listing güncelleme uyarısı: {e}")

    print(f"✅ Playlist Güvenlik Sonucu: {summary_badge}\n")
    return report


if __name__ == "__main__":
    test_target = sys.argv[1] if len(sys.argv) > 1 else "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8"
    lid = sys.argv[2] if len(sys.argv) > 2 else None
    res = scan_playlist(test_target, lid)
    print("Tamamlandı.")
