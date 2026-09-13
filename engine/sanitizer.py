# -*- coding: utf-8 -*-
"""AndroidManifest.xml sanitizer.

Removes dangerous permissions, ad-related permissions,
queries blocks, and fixes debuggable flag based on profile rules.
"""
import os
import re


def sanitize_manifest(decompiled_dir: str, profile: dict) -> dict:
    """Clean AndroidManifest.xml based on profile rules."""
    manifest_path = os.path.join(decompiled_dir, "AndroidManifest.xml")
    if not os.path.exists(manifest_path):
        return {"error": "AndroidManifest.xml not found"}

    with open(manifest_path, "r", encoding="utf-8") as f:
        content = f.read()

    original = content
    changes = []

    cleanup = profile.get("manifest_cleanup", {})

    # 1. Remove specified permissions
    remove_perms = cleanup.get("remove_permissions", [])
    for perm in remove_perms:
        pattern = rf'\s*<uses-permission[^>]*android:name="{re.escape(perm)}"[^/]*/?>[\t ]*\n?'
        if re.search(pattern, content):
            content = re.sub(pattern, '\n', content)
            changes.append(f"Removed permission: {perm}")

    # 2. Remove queries block if specified
    if cleanup.get("remove_queries", False) or cleanup.get("remove_queries_block", False):
        pattern = r'\s*<queries>.*?</queries>\s*'
        if re.search(pattern, content, re.DOTALL):
            content = re.sub(pattern, '\n', content, flags=re.DOTALL)
            changes.append("Removed <queries> block")

    # 3. Fix debuggable flag
    if cleanup.get("disable_debuggable", True) or cleanup.get("set_debuggable_false", False):
        if 'android:debuggable="true"' in content:
            content = content.replace('android:debuggable="true"', 'android:debuggable="false"')
            changes.append("Set debuggable=false")

    # 4. Leanback required false
    if cleanup.get("set_leanback_not_required", False):
        if 'android:software.leanback" android:required="true"' in content:
            content = content.replace('android:software.leanback" android:required="true"',
                                      'android:software.leanback" android:required="false"')
            changes.append("Set leanback required=false")

    # 5. Remove receivers
    remove_receivers = cleanup.get("remove_receivers", [])
    for rec in remove_receivers:
        pattern = rf'\s*<receiver[^>]*android:name="{re.escape(rec)}"[^>]*>.*?</receiver>\s*'
        if re.search(pattern, content, re.DOTALL):
            content = re.sub(pattern, '\n', content, flags=re.DOTALL)
            changes.append(f"Removed receiver block: {rec}")
        pattern2 = rf'\s*<receiver[^>]*android:name="{re.escape(rec)}"[^/]*/?>[\t ]*\n?'
        if re.search(pattern2, content):
            content = re.sub(pattern2, '\n', content)
            changes.append(f"Removed receiver tag: {rec}")

    # 6. Remove specific components
    remove_components = cleanup.get("remove_components", [])
    for comp in remove_components:
        for tag in ["activity", "service", "receiver", "provider"]:
            pattern = rf'\s*<{tag}[^>]*android:name="[^"]*{re.escape(comp)}[^"]*"[^/]*/?>[\t ]*\n?'
            if re.search(pattern, content):
                content = re.sub(pattern, '\n', content)
                changes.append(f"Removed {tag}: {comp}")
            pattern = rf'\s*<{tag}[^>]*android:name="[^"]*{re.escape(comp)}[^"]*"[^>]*>.*?</{tag}>\s*'
            if re.search(pattern, content, re.DOTALL):
                content = re.sub(pattern, '\n', content, flags=re.DOTALL)
                changes.append(f"Removed {tag} block: {comp}")

    # Write back
    if content != original:
        with open(manifest_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"🧹 Manifest sanitized: {len(changes)} changes")
    else:
        print("ℹ️ No manifest changes needed")

    return {"changes": changes, "total_changes": len(changes)}


def bump_version(decompiled_dir: str, profile: dict) -> dict:
    """Bump version code/name in apktool.yml."""
    yml_path = os.path.join(decompiled_dir, "apktool.yml")
    if not os.path.exists(yml_path):
        return {"error": "apktool.yml not found"}

    with open(yml_path, "r", encoding="utf-8") as f:
        content = f.read()

    changes = []
    version_bump = profile.get("version_bump", {})

    # Bump version code (must be an unquoted integer for apktool / brut.yaml parser)
    new_vc = version_bump.get("version_code", 9999)
    try:
        new_vc_int = int(str(new_vc).strip("'\""))
    except Exception:
        new_vc_int = 9999
    content = re.sub(r'versionCode:\s*[\'"]?\S+?[\'"]?', f"versionCode: {new_vc_int}", content)
    changes.append(f"versionCode → {new_vc_int}")

    # Append suffix to version name (clean unquoted format)
    suffix = version_bump.get("version_name_suffix", " (Prime Mod)")
    match = re.search(r"versionName:\s*['\"]?([^'\"\r\n]+)", content)
    if match:
        old_name = match.group(1).strip().strip("'\"")
        if suffix not in old_name:
            new_name = old_name + suffix
            content = re.sub(
                r"versionName:\s*['\"]?[^\r\n]+",
                f"versionName: {new_name}",
                content,
            )
            changes.append(f"versionName → {new_name}")

    with open(yml_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"📦 Version bumped: {', '.join(changes)}")
    return {"changes": changes}
