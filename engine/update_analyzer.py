#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PrimeForge Update Mechanism Analyzer
Inspects smali code, strings, and network configurations to determine how
the target application checks for new versions (Custom API, GitHub Releases,
Firebase Remote Config, or Google Play In-App Updates).
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


class UpdateAnalyzer:
    def __init__(self, decompiled_dir: str, package_name: str = ""):
        self.decompiled_dir = os.path.abspath(decompiled_dir)
        self.package_name = package_name
        self.smali_dirs = [d for d in os.listdir(self.decompiled_dir) if d.startswith("smali")]

    def find_update_urls_and_endpoints(self) -> List[Dict[str, str]]:
        """Search smali files for URLs related to update, version, release, or upgrade."""
        endpoints = []
        url_pattern = re.compile(
            r'const-string\s+[vp]\d+,\s*"(https?://[^"\s]+(?:update|version|upgrade|release|app|api)[^"\s]*)"',
            re.IGNORECASE
        )
        github_pattern = re.compile(
            r'const-string\s+[vp]\d+,\s*"(https?://(?:api\.)?github\.com/[^"\s]+)"',
            re.IGNORECASE
        )

        seen_urls = set()

        for sdir in self.smali_dirs:
            sdir_path = os.path.join(self.decompiled_dir, sdir)
            for path in Path(sdir_path).rglob("*.smali"):
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()

                    # Match regular update endpoints
                    for m in url_pattern.finditer(content):
                        url = m.group(1)
                        if url not in seen_urls and not any(skip in url for skip in ["schemas.android", "google.com/recaptcha"]):
                            seen_urls.add(url)
                            endpoints.append({
                                "type": "custom_endpoint",
                                "url": url,
                                "source_class": path.stem
                            })

                    # Match GitHub release URLs
                    for m in github_pattern.finditer(content):
                        url = m.group(1)
                        if url not in seen_urls:
                            seen_urls.add(url)
                            endpoints.append({
                                "type": "github_release",
                                "url": url,
                                "source_class": path.stem
                            })
                except Exception:
                    continue

        return endpoints

    def detect_play_core(self) -> bool:
        """Check if Google Play In-App Update SDK is present."""
        for sdir in self.smali_dirs:
            play_core_dir = os.path.join(self.decompiled_dir, sdir, "com", "google", "android", "play", "core", "appupdate")
            if os.path.isdir(play_core_dir):
                return True
        return False

    def detect_firebase_remote_config(self) -> bool:
        """Check if Firebase Remote Config is used for update flagging."""
        for sdir in self.smali_dirs:
            firebase_dir = os.path.join(self.decompiled_dir, sdir, "com", "google", "firebase", "remoteconfig")
            if os.path.isdir(firebase_dir):
                return True
        return False

    def scan_update_classes(self) -> List[str]:
        """Find smali classes dedicated to update / ota logic."""
        update_classes = []
        for sdir in self.smali_dirs:
            sdir_path = os.path.join(self.decompiled_dir, sdir)
            for path in Path(sdir_path).rglob("*.smali"):
                name = path.stem.lower()
                if any(term in name for term in ["updatechecker", "updatemanager", "versionchecker", "checkupdate", "otaupdate", "appupdater"]):
                    update_classes.append(path.stem)
        return list(set(update_classes))[:10]

    def scan_json_keys(self) -> List[str]:
        """Scan smali for JSON keys frequently used in update responses."""
        found_keys = set()
        common_keys = [
            "versionCode", "version_code", "versionName", "version_name",
            "apk_url", "apkUrl", "download_url", "downloadUrl", "changelog",
            "force_update", "mandatory"
        ]
        key_pattern = re.compile(
            r'const-string\s+[vp]\d+,\s*"(' + '|'.join(common_keys) + r')"'
        )

        for sdir in self.smali_dirs:
            sdir_path = os.path.join(self.decompiled_dir, sdir)
            for path in Path(sdir_path).rglob("*.smali"):
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        for line in f:
                            m = key_pattern.search(line)
                            if m:
                                found_keys.add(m.group(1))
                except Exception:
                    pass

        return list(found_keys)

    def analyze(self) -> Dict[str, Any]:
        """Produce full update mechanism analysis."""
        print(f"🔍 Analyzing update mechanism in: {os.path.basename(self.decompiled_dir)}...")

        endpoints = self.find_update_urls_and_endpoints()
        has_play_core = self.detect_play_core()
        has_firebase = self.detect_firebase_remote_config()
        classes = self.scan_update_classes()
        json_keys = self.scan_json_keys()

        mechanism_type = "NONE"
        strategy = {}

        # Prioritize GitHub or Custom Endpoints
        github_endpoints = [e for e in endpoints if e["type"] == "github_release"]
        custom_endpoints = [e for e in endpoints if e["type"] == "custom_endpoint"]

        if github_endpoints:
            mechanism_type = "GITHUB_RELEASES"
            strategy = {
                "type": "github_releases",
                "url": github_endpoints[0]["url"]
            }
        elif custom_endpoints:
            mechanism_type = "CUSTOM_API_ENDPOINT"
            strategy = {
                "type": "http_json_get",
                "endpoint": custom_endpoints[0]["url"],
                "version_key": "versionCode" if "versionCode" in json_keys else "version",
                "apk_key": "apk_url" if "apk_url" in json_keys else "download_url"
            }
        elif has_play_core:
            mechanism_type = "GOOGLE_PLAY_IN_APP_UPDATE"
            strategy = {
                "type": "play_store_query",
                "package_name": self.package_name
            }
        elif has_firebase:
            mechanism_type = "FIREBASE_REMOTE_CONFIG"
            strategy = {
                "type": "firebase_remote",
                "keys": json_keys
            }

        result = {
            "has_update_mechanism": mechanism_type != "NONE",
            "mechanism_type": mechanism_type,
            "detected_endpoints": endpoints[:5],
            "detected_update_classes": classes,
            "detected_json_keys": json_keys,
            "has_play_core": has_play_core,
            "has_firebase_config": has_firebase,
            "suggested_update_strategy": strategy
        }

        print(f"  📡 Mechanism Detected: {mechanism_type}")
        if endpoints:
            print(f"  🔗 Primary Endpoint: {endpoints[0]['url']}")

        return result


def analyze_decompiled_updates(decompiled_dir: str, package_name: str = "") -> Dict[str, Any]:
    analyzer = UpdateAnalyzer(decompiled_dir, package_name)
    return analyzer.analyze()


if __name__ == "__main__":
    import sys
    d_dir = sys.argv[1] if len(sys.argv) > 1 else "decompiled"
    pkg = sys.argv[2] if len(sys.argv) > 2 else ""
    res = analyze_decompiled_updates(d_dir, pkg)
    print(json.dumps(res, indent=2, ensure_ascii=False))
