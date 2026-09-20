# engine/bundle_handler.py
# Handles APKS, XAPK, and split APK archives for multi-architecture building

import os
import zipfile
import shutil
import tempfile
import re
from typing import Dict, List, Optional, Tuple

SUPPORTED_ARCHS = ["arm64-v8a", "armeabi-v7a", "x86_64", "x86"]

class BundleHandler:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.is_valid_zip = zipfile.is_zipfile(file_path)

    def is_bundle(self) -> bool:
        """Determines if the given file is an APKS, XAPK, or ZIP bundle of split APKs."""
        if not self.is_valid_zip:
            return False
        
        ext = os.path.splitext(self.file_path)[1].lower()
        if ext in [".apks", ".xapk"]:
            return True

        # Check internal entries
        try:
            with zipfile.ZipFile(self.file_path, "r") as z:
                names = z.namelist()
                has_sub_apks = sum(1 for n in names if n.lower().endswith(".apk")) > 1
                has_splits = any("split" in n.lower() or "config." in n.lower() for n in names)
                return has_sub_apks or has_splits
        except Exception:
            return False

    def inspect_architectures(self) -> List[str]:
        """Detects which native architectures are present in the bundle or APK."""
        if not self.is_valid_zip:
            return ["arm64-v8a"]

        archs = set()
        try:
            with zipfile.ZipFile(self.file_path, "r") as z:
                for name in z.namelist():
                    lower = name.lower()
                    for arch in SUPPORTED_ARCHS:
                        # Direct lib folder match or split apk name match
                        clean_arch = arch.replace("-", "_")
                        if f"lib/{arch}/" in lower or f"config.{arch}" in lower or f"config.{clean_arch}" in lower or f"-{arch}." in lower or f"-{clean_arch}." in lower:
                            archs.add(arch)
        except Exception as e:
            print(f"⚠️ Error reading bundle architectures: {e}")

        # Default fallback
        if not archs:
            archs.add("arm64-v8a")

        return sorted(list(archs))

    def extract_bundle_splits(self, output_dir: str) -> Dict[str, List[str]]:
        """
        Extracts all APKs from bundle and groups them by architecture:
        returns { 'base': [base_apk], 'arm64-v8a': [split_apks], 'armeabi-v7a': [split_apks], ... }
        """
        os.makedirs(output_dir, exist_ok=True)
        results: Dict[str, List[str]] = {"base": [], "universal": []}
        for arch in SUPPORTED_ARCHS:
            results[arch] = []

        with zipfile.ZipFile(self.file_path, "r") as z:
            for item in z.infolist():
                name = item.filename
                if not name.lower().endswith(".apk"):
                    continue

                extracted_path = os.path.join(output_dir, os.path.basename(name))
                with z.open(item) as src, open(extracted_path, "wb") as dst:
                    shutil.copyfileobj(src, dst)

                lower = name.lower()
                matched_arch = None
                for arch in SUPPORTED_ARCHS:
                    clean_arch = arch.replace("-", "_")
                    if arch in lower or clean_arch in lower:
                        matched_arch = arch
                        break

                if matched_arch:
                    results[matched_arch].append(extracted_path)
                elif "base" in lower or "master" in lower:
                    results["base"].append(extracted_path)
                else:
                    results["universal"].append(extracted_path)

        return results

    def get_best_standalone_or_base(self, target_arch: str = "arm64-v8a", work_dir: Optional[str] = None) -> str:
        """
        If this is a bundle, returns the path to the best APK to decompile and patch
        (e.g. standalone APK for arch, or base APK). If single APK, returns original path.
        """
        if not self.is_bundle():
            return self.file_path

        work_dir = work_dir or tempfile.mkdtemp(prefix="primeforge_bundle_")
        splits = self.extract_bundle_splits(work_dir)

        # Check if a standalone APK for target_arch was present
        if splits.get(target_arch):
            for path in splits[target_arch]:
                if "standalone" in os.path.basename(path).lower():
                    print(f"📦 Found standalone APK for {target_arch}: {path}")
                    return path

        # Otherwise return base APK
        if splits.get("base"):
            print(f"📦 Using Base APK from bundle: {splits['base'][0]}")
            return splits["base"][0]

        # Or first APK in universal
        if splits.get("universal"):
            print(f"📦 Using APK from bundle: {splits['universal'][0]}")
            return splits["universal"][0]

        return self.file_path


def process_target_bundle(apk_or_bundle_path: str, target_arch: str = "arm64-v8a") -> Tuple[str, bool, List[str]]:
    """
    Convenience function:
    Returns (apk_to_patch, is_bundle, detected_architectures)
    """
    handler = BundleHandler(apk_or_bundle_path)
    is_bundle = handler.is_bundle()
    archs = handler.inspect_architectures()
    if is_bundle:
        resolved_apk = handler.get_best_standalone_or_base(target_arch)
        return resolved_apk, True, archs
    return apk_or_bundle_path, False, archs
