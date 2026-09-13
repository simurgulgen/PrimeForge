#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Morphe patcher execution engine.

Integrates Morphe Desktop CLI and .mpp (Morphe Patch Package) bundles.
Supports official Morphe patches (YouTube, Reddit, Twitter, Universal)
as well as custom community patch repositories.
"""
import json
import os
import shutil
import subprocess
import sys
import urllib.request

MORPHE_DESKTOP_URL = "https://github.com/MorpheApp/morphe-desktop/releases/download/v1.15.1/morphe-desktop-1.15.1-all.jar"
MORPHE_PATCHES_URL = "https://github.com/MorpheApp/morphe-patches/releases/download/v1.42.0/patches-1.42.0.mpp"


def download_file(url: str, dest_path: str) -> str:
    """Download a file with User-Agent header and progress reporting."""
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 100000:
        return dest_path

    os.makedirs(os.path.dirname(os.path.abspath(dest_path)), exist_ok=True)
    print(f"📥 Downloading: {url} -> {dest_path}")
    req = urllib.request.Request(url, headers={"User-Agent": "PrimeForge-Engine/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp, open(dest_path, "wb") as out:
        shutil.copyfileobj(resp, out)
    print(f"✅ Downloaded ({os.path.getsize(dest_path)} bytes)")
    return dest_path


def ensure_morphe_tools(cache_dir: str = "cache/morphe") -> tuple:
    """Ensure morphe-desktop.jar and patches.mpp are available."""
    os.makedirs(cache_dir, exist_ok=True)
    jar_path = os.path.join(cache_dir, "morphe-desktop.jar")
    mpp_path = os.path.join(cache_dir, "patches.mpp")

    try:
        if not os.path.exists(jar_path):
            download_file(MORPHE_DESKTOP_URL, jar_path)
        if not os.path.exists(mpp_path):
            download_file(MORPHE_PATCHES_URL, mpp_path)
        return jar_path, mpp_path
    except Exception as e:
        print(f"⚠️ Warning: Could not download Morphe tools: {e}")
        return None, None


def is_java_available() -> bool:
    """Check if Java is installed and accessible."""
    try:
        res = subprocess.run(["java", "-version"], capture_output=True, text=True, timeout=10)
        return res.returncode == 0
    except Exception:
        return False


def apply_morphe_patches(
    input_apk: str,
    output_apk: str,
    enabled_patches: list = None,
    custom_mpp_path: str = None,
) -> dict:
    """Apply Morphe patches to input APK using Morphe Desktop CLI.

    Args:
        input_apk: Path to clean APK.
        output_apk: Target destination for patched APK.
        enabled_patches: List of patch names to explicitly enable (e.g. ['hide-ads', 'clone-app']).
        custom_mpp_path: Optional path or URL to an external .mpp patch bundle.
    """
    if not is_java_available():
        return {
            "status": "skipped",
            "reason": "Java runtime environment is not available on this runner.",
            "output_apk": input_apk,
        }

    jar_path, default_mpp = ensure_morphe_tools()
    if not jar_path or not os.path.exists(jar_path):
        return {
            "status": "skipped",
            "reason": "Morphe desktop jar could not be downloaded.",
            "output_apk": input_apk,
        }

    mpp_path = custom_mpp_path or default_mpp
    if not mpp_path or not os.path.exists(mpp_path):
        return {
            "status": "skipped",
            "reason": "Morphe patches .mpp package could not be downloaded.",
            "output_apk": input_apk,
        }

    cmd = ["java", "-jar", jar_path, "patch", "-p", mpp_path, "-o", output_apk]

    if enabled_patches:
        for patch in enabled_patches:
            clean_patch = patch.strip()
            if clean_patch:
                cmd.extend(["-e", clean_patch])

    cmd.append(input_apk)

    print(f"\n🧩 Running Morphe CLI: {' '.join(cmd)}")
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        print(res.stdout)
        if res.returncode != 0:
            print(f"⚠️ Morphe patcher warning/stderr:\n{res.stderr}")
            return {
                "status": "error",
                "stderr": res.stderr,
                "stdout": res.stdout,
                "output_apk": input_apk,
            }

        if os.path.exists(output_apk) and os.path.getsize(output_apk) > 1000:
            print(f"🎉 Morphe patching succeeded! Output: {output_apk}")
            return {
                "status": "success",
                "output_apk": output_apk,
                "enabled_patches": enabled_patches or ["default_all"],
            }
        else:
            return {
                "status": "failed",
                "reason": "Output APK was not created by Morphe CLI.",
                "output_apk": input_apk,
            }
    except Exception as e:
        print(f"❌ Morphe patch execution failed with exception: {e}")
        return {
            "status": "exception",
            "error": str(e),
            "output_apk": input_apk,
        }


if __name__ == "__main__":
    if len(sys.argv) > 1:
        in_apk = sys.argv[1]
        out_apk = sys.argv[2] if len(sys.argv) > 2 else "output/morphe_patched.apk"
        res = apply_morphe_patches(in_apk, out_apk)
        print(json.dumps(res, indent=2))
    else:
        print("Usage: python morphe_engine.py input.apk output.apk")
