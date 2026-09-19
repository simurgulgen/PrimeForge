# -*- coding: utf-8 -*-
"""Ultra-fast pure Python APK Pre-Audit Analyzer.

Reads APK ZIP archive directly (without running apktool or decompile).
Extracts:
- Package name, version code, version name from binary AndroidManifest.xml strings
- Permissions (dangerous and ad-related)
- Ad network signatures from DEX string pools
- In-App Purchase / Billing SDK signatures
- Android TV / Leanback compatibility
- File size, SHA256, architectures
"""
import hashlib
import json
import os
import re
import sys
import zipfile
from typing import Dict, Any, List

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

# Known ad network signatures
AD_NETWORK_SIGNATURES = {
    "Google AdMob": [b"com/google/android/gms/ads", b"com.google.android.gms.ads"],
    "Unity Ads": [b"com/unity3d/ads", b"com.unity3d.services"],
    "AppLovin": [b"com/applovin", b"com.applovin.sdk"],
    "IronSource": [b"com/ironsource", b"com.ironsource.mediationsdk"],
    "Vungle": [b"com/vungle", b"com.vungle.warren"],
    "Pangle (ByteDance)": [b"com/bytedance/sdk/openadsdk"],
    "Meta Audience Network": [b"com/facebook/ads"],
    "InMobi": [b"com/inmobi"],
    "Mintegral": [b"com/mbridge"],
    "Chartboost": [b"com/chartboost"],
}

# Known DRM & IAP signatures
IAP_SIGNATURES = {
    "Google Play Billing": [b"com/android/vending/billing", b"com.android.vending.BILLING", b"BillingClient"],
    "RevenueCat": [b"com/revenuecat", b"PurchasesConfiguration"],
    "Amazon IAP": [b"com/amazon/device/iap"],
    "Adapty": [b"io/adapty"],
    "Qonversion": [b"com/qonversion"],
}

# Dangerous permissions map
DANGEROUS_PERMS = {
    "android.permission.ACCESS_FINE_LOCATION": "Hassas GPS Konum Bilgisi",
    "android.permission.ACCESS_COARSE_LOCATION": "Yaklaşık Ağ Konumu",
    "android.permission.RECORD_AUDIO": "Mikrofon Erişimi / Ses Kaydı",
    "android.permission.CAMERA": "Kamera Erişimi",
    "android.permission.READ_CONTACTS": "Rehber ve Kişi Bilgilerini Okuma",
    "android.permission.READ_CALL_LOG": "Arama Geçmişini Okuma",
    "android.permission.RECEIVE_BOOT_COMPLETED": "Cihaz Açılışında Otomatik Başlama",
    "android.permission.READ_SMS": "SMS Mesajlarını Okuma",
    "android.permission.SEND_SMS": "Arka Planda SMS Gönderme",
    "android.permission.SYSTEM_ALERT_WINDOW": "Diğer Uygulamaların Üzerinde Görünme",
    "android.permission.REQUEST_INSTALL_PACKAGES": "Dışarıdan Başka APK İndirip Kurma",
    "android.permission.PACKAGE_USAGE_STATS": "Diğer Uygulamaların Kullanımını İzleme",
    "android.permission.QUERY_ALL_PACKAGES": "Yüklü Tüm Uygulamaları Tarama (Sniffer)",
}

AD_PERMS = {
    "com.google.android.gms.permission.AD_ID": "Google Reklam Kimliği (İzleme)",
    "android.permission.ACCESS_ADSERVICES_AD_ID": "Android AdServices Reklam Kimliği",
    "android.permission.ACCESS_ADSERVICES_ATTRIBUTION": "Reklam İlişkilendirme & Takip",
    "android.permission.ACCESS_ADSERVICES_TOPICS": "İlgi Alanı & Reklam Hedefleme",
    "com.android.vending.BILLING": "Google Play Satın Alma / Ödeme Arayüzü",
}


def extract_strings_from_binary_manifest(manifest_bytes: bytes) -> List[str]:
    """Extract readable UTF-8 / UTF-16 strings from AXML (Binary AndroidManifest)."""
    strings = []
    # Match UTF-8 printable strings of length >= 3
    for s in re.findall(rb"[\x20-\x7e]{3,}", manifest_bytes):
        try:
            strings.append(s.decode("utf-8", errors="ignore"))
        except Exception:
            pass
    # Match UTF-16-LE strings
    for s in re.findall(rb"(?:[\x20-\x7e]\x00){3,}", manifest_bytes):
        try:
            strings.append(s.decode("utf-16le", errors="ignore"))
        except Exception:
            pass
    return list(set(strings))


def fast_apk_pre_audit(apk_path: str) -> Dict[str, Any]:
    """Perform lightning fast pre-audit without apktool or decompile."""
    if not os.path.exists(apk_path):
        return {"success": False, "error": f"Dosya bulunamadı: {apk_path}"}

    file_size = os.path.getsize(apk_path)
    h = hashlib.sha256()
    with open(apk_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    sha256 = h.hexdigest()

    package_name = ""
    version_name = ""
    version_code = ""
    permissions = []
    architectures = set()
    is_tv_compatible = False
    has_leanback_launcher = False

    detected_ads = []
    detected_iap = []

    try:
        with zipfile.ZipFile(apk_path, "r") as zf:
            file_names = zf.namelist()

            # Native libs architectures
            for fname in file_names:
                if fname.startswith("lib/"):
                    parts = fname.split("/")
                    if len(parts) > 1 and parts[1]:
                        architectures.add(parts[1])

            # Binary AndroidManifest
            if "AndroidManifest.xml" in file_names:
                manifest_data = zf.read("AndroidManifest.xml")
                manifest_strings = extract_strings_from_binary_manifest(manifest_data)

                # Extract permissions
                for s in manifest_strings:
                    if "permission." in s or s.endswith(".BILLING") or "permission" in s.lower():
                        clean_perm = s.strip()
                        if "." in clean_perm and clean_perm not in permissions:
                            permissions.append(clean_perm)

                    if "android.software.leanback" in s:
                        is_tv_compatible = True
                    if "LEANBACK_LAUNCHER" in s:
                        has_leanback_launcher = True

                # Guess package name (heuristic: look for reverse domain format)
                candidates = []
                for s in manifest_strings:
                    if re.match(r"^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*){2,}$", s):
                        if not any(s.startswith(skip) for skip in ["android.", "com.google.", "com.android.", "androidx."]):
                            candidates.append(s)

                if candidates:
                    package_name = sorted(candidates, key=lambda x: len(x))[0]

                # Guess version name (e.g. 1.0.2, 3.4.1)
                for s in manifest_strings:
                    if re.match(r"^\d+\.\d+(\.\d+)?(-[a-zA-Z0-9_.]+)?$", s):
                        version_name = s
                        break

            # Fast scan DEX files (check up to 4 DEX files)
            dex_files = [f for f in file_names if f.endswith(".dex")][:4]
            for dex_name in dex_files:
                dex_data = zf.read(dex_name)

                # Check Ad networks
                for ad_name, sigs in AD_NETWORK_SIGNATURES.items():
                    if ad_name not in detected_ads:
                        for sig in sigs:
                            if sig in dex_data:
                                detected_ads.append(ad_name)
                                break

                # Check IAP
                for iap_name, sigs in IAP_SIGNATURES.items():
                    if iap_name not in detected_iap:
                        for sig in sigs:
                            if sig in dex_data:
                                detected_iap.append(iap_name)
                                break

    except Exception as e:
        return {"success": False, "error": f"APK analizi başarısız: {str(e)}"}

    # Categorize permissions
    dangerous_list = []
    ad_list = []

    for p in permissions:
        if p in DANGEROUS_PERMS:
            dangerous_list.append({"name": p, "description": DANGEROUS_PERMS[p], "selected": True})
        elif p in AD_PERMS:
            ad_list.append({"name": p, "description": AD_PERMS[p], "selected": True})

    if not package_name:
        package_name = os.path.splitext(os.path.basename(apk_path))[0].split("-")[0].split("_")[0]

    return {
        "success": True,
        "apk_path": apk_path,
        "file_name": os.path.basename(apk_path),
        "file_size": file_size,
        "file_size_mb": round(file_size / (1024 * 1024), 2),
        "sha256": sha256,
        "package_name": package_name,
        "version_name": version_name or "1.0.0",
        "architectures": sorted(list(architectures)),
        "tv_compatibility": {
            "is_tv_ready": is_tv_compatible or has_leanback_launcher,
            "has_leanback_launcher": has_leanback_launcher,
            "has_touchscreen_not_required": is_tv_compatible,
        },
        "permissions": {
            "dangerous": dangerous_list,
            "ad_related": ad_list,
            "total_count": len(permissions),
        },
        "detected_features": {
            "has_billing": len(detected_iap) > 0,
            "billing_type": detected_iap[0] if detected_iap else None,
            "has_ads": len(detected_ads) > 0,
            "ad_networks": detected_ads,
            "is_already_modded": False,
        },
        "recommended_action": "full_mod" if detected_ads or detected_iap else "sanitize_only",
    }


if __name__ == "__main__":
    target_apk = sys.argv[1] if len(sys.argv) > 1 else ""
    if not target_apk:
        print(json.dumps({"error": "Lütfen bir APK dosyası belirtin."}))
        sys.exit(1)
    res = fast_apk_pre_audit(target_apk)
    print(json.dumps(res, indent=2, ensure_ascii=False))
