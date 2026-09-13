# -*- coding: utf-8 -*-
"""APK recompilation, alignment and signing."""
import hashlib
import os
import re
import subprocess
import xml.etree.ElementTree as ET


def sanitize_broken_xml(file_path: str, folder_name: str = "") -> bool:
    """Replace a malformed/binary XML file with a valid XML skeleton."""
    try:
        if not folder_name:
            folder_name = os.path.basename(os.path.dirname(file_path))
        if folder_name.startswith("layout"):
            dummy = b'<?xml version="1.0" encoding="utf-8"?>\n<merge xmlns:android="http://schemas.android.com/apk/res/android" />\n'
        elif folder_name.startswith("xml"):
            dummy = b'<?xml version="1.0" encoding="utf-8"?>\n<PreferenceScreen xmlns:android="http://schemas.android.com/apk/res/android" />\n'
        elif folder_name.startswith("drawable"):
            dummy = b'<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" />\n'
        elif folder_name.startswith("menu"):
            dummy = b'<?xml version="1.0" encoding="utf-8"?>\n<menu xmlns:android="http://schemas.android.com/apk/res/android" />\n'
        elif folder_name.startswith("anim"):
            dummy = b'<?xml version="1.0" encoding="utf-8"?>\n<set xmlns:android="http://schemas.android.com/apk/res/android" />\n'
        elif folder_name.startswith("transition"):
            dummy = b'<?xml version="1.0" encoding="utf-8"?>\n<transitionSet xmlns:android="http://schemas.android.com/apk/res/android" />\n'
        else:
            dummy = b'<?xml version="1.0" encoding="utf-8"?>\n<resources />\n'
        with open(file_path, "wb") as fp:
            fp.write(dummy)
        return True
    except Exception:
        return False


def clean_apktool_duplicate_resources(decompiled_dir: str):
    """Remove corrupted APKTOOL_DUPLICATE_* dummy files and fix binary/malformed XMLs produced by apktool on obfuscated APKs."""
    res_dir = os.path.join(decompiled_dir, "res")
    if not os.path.isdir(res_dir):
        return
    removed = 0
    fixed_xmls = 0
    for root, dirs, files in os.walk(res_dir):
        for f in files:
            file_path = os.path.join(root, f)
            # 1. Clean APKTOOL_DUPLICATE files
            if "APKTOOL_DUPLICATE" in f:
                try:
                    os.remove(file_path)
                    removed += 1
                except Exception:
                    pass
                continue

            # 2. Check for invalid binary or malformed XML files (obfuscator trap for aapt2)
            if f.endswith(".xml"):
                is_valid = False
                try:
                    ET.parse(file_path)
                    is_valid = True
                except Exception:
                    is_valid = False

                if not is_valid:
                    folder = os.path.basename(root)
                    if sanitize_broken_xml(file_path, folder):
                        fixed_xmls += 1

    if removed > 0:
        print(f"🧹 Cleaned {removed} invalid APKTOOL_DUPLICATE resource dummy files.")
    if fixed_xmls > 0:
        print(f"🔧 Sanitized {fixed_xmls} malformed/binary XML trap files into valid XML skeletons.")


def sanitize_apktool_yml(decompiled_dir: str):
    """Ensure apktool.yml has unquoted versionCode to prevent NumberFormatException in SnakeYAML/Apktool."""
    yml_path = os.path.join(decompiled_dir, "apktool.yml")
    if os.path.isfile(yml_path):
        try:
            with open(yml_path, "r", encoding="utf-8") as f:
                content = f.read()
            # If versionCode is quoted like versionCode: '9999' or versionCode: "9999"
            new_content = re.sub(r"versionCode:\s*['\"](\d+)['\"]", r"versionCode: \1", content)
            if new_content != content:
                with open(yml_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print("🔧 Fixed quoted versionCode in apktool.yml")
        except Exception:
            pass


def recompile(decompiled_dir: str, output_apk: str) -> str:
    """Recompile decompiled APK using apktool with duplicate cleanup and aapt2."""
    sanitize_apktool_yml(decompiled_dir)
    clean_apktool_duplicate_resources(decompiled_dir)

    # Attempt 1: apktool with --use-aapt2
    cmd = ["apktool", "b", "--use-aapt2", decompiled_dir, "-o", output_apk]
    print(f"📦 Recompiling (aapt2): {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=360)

    # Attempt 2: fallback without --use-aapt2 if needed
    if result.returncode != 0:
        print(f"⚠️ apktool aapt2 failed, attempting standard recompile...")
        cmd_std = ["apktool", "b", decompiled_dir, "-o", output_apk]
        result = subprocess.run(cmd_std, capture_output=True, text=True, timeout=360)

    # Attempt 3: If still failing due to corrupt XML files reported in stderr, fix those specific files and retry
    if result.returncode != 0 and result.stderr:
        error_files = set(re.findall(r'(?:W:\s+)?([^\s:]+\.xml)(?::\d+)?:?\s+error:', result.stderr))
        fixed_from_stderr = 0
        for bad_file in error_files:
            if os.path.isfile(bad_file):
                folder = os.path.basename(os.path.dirname(bad_file))
                if sanitize_broken_xml(bad_file, folder):
                    fixed_from_stderr += 1
        if fixed_from_stderr > 0:
            print(f"🔧 AAPT hata çıktısından tespit edilen {fixed_from_stderr} bozuk XML onarıldı, yeniden deneniyor...")
            cmd_retry = ["apktool", "b", decompiled_dir, "-o", output_apk]
            result = subprocess.run(cmd_retry, capture_output=True, text=True, timeout=360)

    if result.returncode != 0:
        raise RuntimeError(f"apktool build failed:\n{result.stderr}")
    print(f"✅ Recompiled to {output_apk}")
    return output_apk


def zipalign(input_apk: str, output_apk: str) -> str:
    """Align APK using zipalign."""
    cmd = ["zipalign", "-p", "-f", "-v", "4", input_apk, output_apk]
    print(f"📐 Aligning...")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"zipalign failed:\n{result.stderr}")
    print(f"✅ Aligned to {output_apk}")
    return output_apk


def sign_apk(input_apk, output_apk, keystore="primestore_release.jks",
             alias="primestore", ks_pass="primestore123", key_pass="primestore123"):
    """Sign APK using apksigner."""
    cmd = [
        "apksigner", "sign",
        "--ks", keystore, "--ks-key-alias", alias,
        "--ks-pass", f"pass:{ks_pass}", "--key-pass", f"pass:{key_pass}",
        "--v1-signing-enabled", "true", "--v2-signing-enabled", "true",
        "--v3-signing-enabled", "true", "--out", output_apk, input_apk,
    ]
    print(f"🔐 Signing with {keystore}...")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"apksigner failed:\n{result.stderr}")
    print(f"✅ Signed: {output_apk}")
    return output_apk


def verify_signature(apk_path: str) -> bool:
    """Verify APK signature."""
    result = subprocess.run(["apksigner", "verify", "--verbose", apk_path],
                            capture_output=True, text=True, timeout=30)
    verified = result.returncode == 0
    print(f"{'✅' if verified else '❌'} Signature {'verified' if verified else 'FAILED'}: {apk_path}")
    return verified


def compute_sha256(file_path: str) -> str:
    """Compute SHA-256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def build_and_sign(decompiled_dir, output_dir="output", keystore="primestore_release.jks",
                   alias="primestore", ks_pass="primestore123"):
    """Full build pipeline: recompile → zipalign → sign → verify."""
    os.makedirs(output_dir, exist_ok=True)
    unaligned = os.path.join(output_dir, "unaligned.apk")
    aligned = os.path.join(output_dir, "aligned.apk")
    signed = os.path.join(output_dir, "modded.apk")

    recompile(decompiled_dir, unaligned)
    zipalign(unaligned, aligned)
    sign_apk(aligned, signed, keystore, alias, ks_pass, ks_pass)
    verified = verify_signature(signed)
    sha256 = compute_sha256(signed)
    file_size = os.path.getsize(signed)

    for f in [unaligned, aligned]:
        if os.path.exists(f):
            os.remove(f)

    return {"apk_path": signed, "sha256": sha256, "file_size": file_size, "verified": verified}
