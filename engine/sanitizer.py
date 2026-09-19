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

    # Bump version code (must be an unquoted 32-bit signed integer for apktool / brut.yaml parser)
    new_vc = version_bump.get("version_code", 9999)
    try:
        new_vc_int = int(str(new_vc).strip("'\""))
        if new_vc_int > 2147483647 or new_vc_int < 0:
            new_vc_int = 9999
    except Exception:
        new_vc_int = 9999
    content = re.sub(r'versionCode:\s*[^\r\n]+', f"versionCode: {new_vc_int}", content)
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


def sanitize_native_libraries(decompiled_dir: str, profile: dict) -> list:
    """Remove suspicious/tracking/ad native libraries (.so) that trigger VirusTotal."""
    remove_libs = profile.get("remove_native_libs", [])
    if not remove_libs:
        return []

    changes = []
    lib_root = os.path.join(decompiled_dir, "lib")
    if os.path.isdir(lib_root):
        for root, dirs, files in os.walk(lib_root):
            for f in files:
                for target in remove_libs:
                    if target.lower() in f.lower():
                        p = os.path.join(root, f)
                        try:
                            os.remove(p)
                            rel = os.path.relpath(p, decompiled_dir)
                            changes.append(f"Removed native lib: {rel}")
                            print(f"  🛡️ Removed VirusTotal trigger lib: {rel}")
                        except Exception as e:
                            print(f"  ⚠️ Could not remove {p}: {e}")

    if changes:
        print(f"🛡️ Native libraries sanitized: {len(changes)} files removed for VirusTotal cleanliness")
    return changes


def inject_tv_dpad_support(decompiled_dir: str, profile: dict = None) -> dict:
    """Make mobile apps Android TV & DPAD remote control compatible.
    
    1. Injects Leanback & touchscreen=false features to AndroidManifest.xml
    2. Injects LEANBACK_LAUNCHER category so the app appears on Android TV Home
    3. Scans layout XMLs to ensure clickable buttons have android:focusable="true"
    """
    manifest_path = os.path.join(decompiled_dir, "AndroidManifest.xml")
    if not os.path.exists(manifest_path):
        return {"error": "AndroidManifest.xml not found"}

    changes = []
    with open(manifest_path, "r", encoding="utf-8") as f:
        content = f.read()

    original = content

    # 1. Add leanback & touchscreen features
    if 'android.software.leanback' not in content:
        feature_block = (
            '\n    <uses-feature android:name="android.software.leanback" android:required="false" />\n'
            '    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />\n'
        )
        content = content.replace("</manifest>", f"{feature_block}</manifest>")
        changes.append("Injected leanback & touchscreen=false features")

    # 2. Add LEANBACK_LAUNCHER to MAIN activity
    if "android.intent.category.LEANBACK_LAUNCHER" not in content:
        # Find intent-filter with android.intent.action.MAIN
        pattern = r'(<intent-filter[^>]*>.*?<action[^>]*android:name="android\.intent\.action\.MAIN"[^>]*>.*?</intent-filter>)'
        match = re.search(pattern, content, flags=re.DOTALL)
        if match:
            filter_block = match.group(1)
            leanback_cat = '    <category android:name="android.intent.category.LEANBACK_LAUNCHER" />\n    '
            # Insert before </intent-filter>
            new_filter = filter_block.replace("</intent-filter>", f"{leanback_cat}</intent-filter>")
            content = content.replace(filter_block, new_filter, 1)
            changes.append("Injected LEANBACK_LAUNCHER category to MainActivity")

    if content != original:
        with open(manifest_path, "w", encoding="utf-8") as f:
            f.write(content)

    # 3. Scan layout files and enforce focusable="true" on clickable views
    layout_dirs = [d for d in os.listdir(decompiled_dir) if d.startswith("res") and os.path.isdir(os.path.join(decompiled_dir, d))]
    dpad_fixed_views = 0
    for rdir in layout_dirs:
        res_path = os.path.join(decompiled_dir, rdir)
        for root, dirs, files in os.walk(res_path):
            if "layout" in root:
                for fname in files:
                    if fname.endswith(".xml"):
                        lpath = os.path.join(root, fname)
                        try:
                            with open(lpath, "r", encoding="utf-8") as lf:
                                lcontent = lf.read()
                            # If clickable is true but focusable missing, add focusable="true"
                            if 'android:clickable="true"' in lcontent and 'android:focusable' not in lcontent:
                                lcontent = lcontent.replace('android:clickable="true"', 'android:clickable="true" android:focusable="true"')
                                with open(lpath, "w", encoding="utf-8") as lf:
                                    lf.write(lcontent)
                                dpad_fixed_views += 1
                        except Exception:
                            pass

    if dpad_fixed_views > 0:
        changes.append(f"Enforced DPAD focusable on {dpad_fixed_views} clickable layout elements")

    print(f"📺 Android TV DPAD Enjektörü: {len(changes)} iyileştirme uygulandı.")
    return {"changes": changes, "total": len(changes)}


