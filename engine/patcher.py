# -*- coding: utf-8 -*-
"""Smali patcher engine.

Applies smali-level patches based on YAML profile definitions.
Supports: return_true, return_false, return_void, empty_list, return_unit,
return_boolean_object_true, boolean_getters_to_false, integer_overrides,
methods_return_false, methods_return_void, raw_replacements, regex_replacements.
"""
import os
import re
import sys
from pathlib import Path

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


def find_smali_class(decompiled_dir: str, class_name: str) -> list:
    """Find all smali files matching a class name or class path."""
    results = []
    smali_dirs = [d for d in os.listdir(decompiled_dir) if d.startswith("smali")]

    clean_name = class_name.lstrip("L").rstrip(";").replace(".", "/")
    stem_name = clean_name.split("/")[-1]

    for sdir in smali_dirs:
        sdir_path = os.path.join(decompiled_dir, sdir)
        for smali_file in Path(sdir_path).rglob("*.smali"):
            str_path = str(smali_file).replace("\\", "/")
            if smali_file.stem == stem_name or clean_name in str_path:
                results.append(str(smali_file))
                continue
            try:
                with open(smali_file, "r", encoding="utf-8") as f:
                    first_lines = f.read(2048)
                if f'.source "{stem_name}' in first_lines or (f'.class ' in first_lines and stem_name in first_lines):
                    results.append(str(smali_file))
            except Exception:
                pass

    return list(set(results))


def patch_method_return_true(content: str, method_name: str) -> tuple:
    """Patch a boolean method to always return true (1)."""
    pattern = rf'(\.method\s+[^\n]*\b{re.escape(method_name)}\b[^\n]*\)Z\s*)(.*?)(\.end method)'
    def replacer(m):
        return f"{m.group(1)}\n    .locals 1\n\n    const/4 v0, 0x1\n    return v0\n{m.group(3)}"
    new_content, count = re.subn(pattern, replacer, content, flags=re.DOTALL)
    return new_content, count


def patch_method_return_false(content: str, method_name: str) -> tuple:
    """Patch a boolean method to always return false (0)."""
    pattern = rf'(\.method\s+[^\n]*\b{re.escape(method_name)}\b[^\n]*\)Z\s*)(.*?)(\.end method)'
    def replacer(m):
        return f"{m.group(1)}\n    .locals 1\n\n    const/4 v0, 0x0\n    return v0\n{m.group(3)}"
    new_content, count = re.subn(pattern, replacer, content, flags=re.DOTALL)
    return new_content, count


def patch_method_return_void(content: str, method_name: str) -> tuple:
    """Patch a void method to immediately return."""
    pattern = rf'(\.method\s+[^\n]*\b{re.escape(method_name)}\b[^\n]*\)V\s*)(.*?)(\.end method)'
    def replacer(m):
        return f"{m.group(1)}\n    .locals 0\n\n    return-void\n{m.group(3)}"
    new_content, count = re.subn(pattern, replacer, content, flags=re.DOTALL)
    return new_content, count


def patch_method_empty_list(content: str, method_name: str) -> tuple:
    """Patch a method returning List to return emptyList()."""
    pattern = rf'(\.method\s+[^\n]*\b{re.escape(method_name)}\b[^\n]*\)Ljava/util/List;\s*)(.*?)(\.end method)'
    def replacer(m):
        return (
            f"{m.group(1)}\n"
            f"    .locals 1\n\n"
            f"    invoke-static {{}}, Lkotlin/collections/CollectionsKt;->emptyList()Ljava/util/List;\n"
            f"    move-result-object v0\n"
            f"    return-object v0\n"
            f"{m.group(3)}"
        )
    new_content, count = re.subn(pattern, replacer, content, flags=re.DOTALL)
    return new_content, count


def patch_method_return_unit(content: str, method_name: str) -> tuple:
    """Patch a Kotlin coroutine/method to return Unit."""
    pattern = rf'(\.method\s+[^\n]*\b{re.escape(method_name)}\b[^\n]*\)Ljava/lang/Object;\s*)(.*?)(\.end method)'
    def replacer(m):
        return (
            f"{m.group(1)}\n"
            f"    .locals 1\n\n"
            f"    sget-object v0, Lkotlin/Unit;->INSTANCE:Lkotlin/Unit;\n"
            f"    return-object v0\n"
            f"{m.group(3)}"
        )
    new_content, count = re.subn(pattern, replacer, content, flags=re.DOTALL)
    return new_content, count


def patch_method_return_boolean_object_true(content: str, method_name: str) -> tuple:
    """Patch a method returning Boolean object to return Boolean.TRUE."""
    pattern = rf'(\.method\s+[^\n]*\b{re.escape(method_name)}\b[^\n]*\)Ljava/lang/Boolean;\s*)(.*?)(\.end method)'
    def replacer(m):
        return (
            f"{m.group(1)}\n"
            f"    .locals 1\n\n"
            f"    sget-object v0, Ljava/lang/Boolean;->TRUE:Ljava/lang/Boolean;\n"
            f"    return-object v0\n"
            f"{m.group(3)}"
        )
    new_content, count = re.subn(pattern, replacer, content, flags=re.DOTALL)
    return new_content, count


def patch_integer_return(content: str, method_name: str, value: int) -> tuple:
    """Patch an integer method to return a specific value."""
    pattern = rf'(\.method\s+[^\n]*\b{re.escape(method_name)}\b[^\n]*\)I\s*)(.*?)(\.end method)'
    hex_val = hex(value)
    def replacer(m):
        if value <= 7:
            return f"{m.group(1)}\n    .locals 1\n\n    const/4 v0, {hex_val}\n    return v0\n{m.group(3)}"
        elif value <= 32767:
            return f"{m.group(1)}\n    .locals 1\n\n    const/16 v0, {hex_val}\n    return v0\n{m.group(3)}"
        else:
            return f"{m.group(1)}\n    .locals 1\n\n    const v0, {hex_val}\n    return v0\n{m.group(3)}"
    new_content, count = re.subn(pattern, replacer, content, flags=re.DOTALL)
    return new_content, count


def apply_profile_patches(decompiled_dir: str, profile: dict) -> dict:
    """Apply all smali patches defined in a YAML profile."""
    patches = profile.get("smali_patches", [])
    results = []

    for patch_def in patches:
        desc = patch_def.get("description", "unnamed patch")
        target_class = patch_def.get("target_class", "")

        if not target_class:
            results.append({"description": desc, "status": "skipped", "reason": "no target_class"})
            continue

        found_files = find_smali_class(decompiled_dir, target_class)
        if not found_files:
            # AI Fallback 1: Try resolving obfuscated class name
            try:
                from engine.ai_advisor import is_ai_available, ai_resolve_obfuscation
                if is_ai_available():
                    print(f"🤖 Hedef sınıf '{target_class}' bulunamadı. AI ile çözümleniyor...")
                    resolved_file = ai_resolve_obfuscation(decompiled_dir, target_class, desc)
                    if resolved_file and os.path.exists(resolved_file):
                        found_files = [resolved_file]
                        print(f"  ✨ AI sınıfı çözdü: {resolved_file}")
            except Exception as e:
                print(f"⚠️ AI obfuscation fallback error: {e}")

        if not found_files:
            results.append({"description": desc, "status": "not_found", "class": target_class})
            continue

        for smali_path in found_files:
            with open(smali_path, "r", encoding="utf-8") as f:
                content = f.read()

            original = content
            patch_count = 0

            patch_type = patch_def.get("patch_type", "")
            method = patch_def.get("method", "")

            if patch_type == "return_true" and method:
                content, c = patch_method_return_true(content, method)
                patch_count += c
            elif patch_type == "return_false" and method:
                content, c = patch_method_return_false(content, method)
                patch_count += c
            elif patch_type == "return_void" and method:
                content, c = patch_method_return_void(content, method)
                patch_count += c
            elif patch_type == "empty_list" and method:
                content, c = patch_method_empty_list(content, method)
                patch_count += c
            elif patch_type == "return_unit" and method:
                content, c = patch_method_return_unit(content, method)
                patch_count += c
            elif patch_type == "return_boolean_object_true" and method:
                content, c = patch_method_return_boolean_object_true(content, method)
                patch_count += c
            elif patch_type in ["return_zero", "return_0"] and method:
                content, c = patch_integer_return(content, method, 0)
                patch_count += c
            elif patch_type in ["return_one", "return_1"] and method:
                content, c = patch_integer_return(content, method, 1)
                patch_count += c
            elif patch_type in ["integer_return", "integer_value"] and method:
                val = patch_def.get("value", 0)
                content, c = patch_integer_return(content, method, int(val))
                patch_count += c

            for m in patch_def.get("methods_return_false", []):
                content, c = patch_method_return_false(content, m)
                patch_count += c

            for m in patch_def.get("methods_return_void", []):
                content, c = patch_method_return_void(content, m)
                patch_count += c

            for getter in patch_def.get("boolean_getters_to_false", []):
                content, c = patch_method_return_false(content, getter)
                patch_count += c

            for method_name, value in patch_def.get("integer_overrides", {}).items():
                content, c = patch_integer_return(content, method_name, value)
                patch_count += c

            # Raw string replacements
            for item in patch_def.get("raw_replacements", []):
                s = item.get("search", "")
                r = item.get("replace", "")
                if s and s in content:
                    content = content.replace(s, r)
                    patch_count += 1

            # Regex replacements
            for item in patch_def.get("regex_replacements", []):
                p = item.get("pattern", "")
                r = item.get("replace", "")
                if p:
                    content, c = re.subn(p, r, content, flags=re.DOTALL)
                    patch_count += c

            # AI Fallback 2: If no matches and AI available, try suggesting patch fix
            if content == original and patch_def.get("method"):
                try:
                    from engine.ai_advisor import is_ai_available, ai_suggest_patch_fix
                    if is_ai_available():
                        print(f"🤖 '{desc}' 0 eşleşme verdi. AI alternatif yama arıyor...")
                        fix = ai_suggest_patch_fix(content, patch_def)
                        if fix:
                            alt_method = fix.get("alternative_method")
                            rec_type = fix.get("recommended_patch_type")
                            if alt_method:
                                if rec_type == "return_zero":
                                    content, c = patch_integer_return(content, alt_method, 0)
                                    patch_count += c
                                elif rec_type == "return_one":
                                    content, c = patch_integer_return(content, alt_method, 1)
                                    patch_count += c
                                elif rec_type == "return_true":
                                    content, c = patch_method_return_true(content, alt_method)
                                    patch_count += c
                                elif rec_type == "return_false":
                                    content, c = patch_method_return_false(content, alt_method)
                                    patch_count += c
                                elif rec_type == "return_void":
                                    content, c = patch_method_return_void(content, alt_method)
                                    patch_count += c
                            reg = fix.get("regex_replacement")
                            if isinstance(reg, dict) and reg.get("pattern") and reg.get("replace"):
                                content, c = re.subn(reg["pattern"], reg["replace"], content, flags=re.DOTALL)
                                patch_count += c
                            if patch_count > 0:
                                print(f"  ✨ AI yaması uygulandı ({patch_count} yama)")
                except Exception as e:
                    print(f"⚠️ AI patch suggestion fallback error: {e}")

            if content != original:
                with open(smali_path, "w", encoding="utf-8") as f:
                    f.write(content)
                results.append({"description": desc, "status": "applied", "file": smali_path, "patches": patch_count})
                print(f"  ✅ {desc} ({patch_count} patches)")
            else:
                results.append({"description": desc, "status": "no_match", "file": smali_path})
                print(f"  ⚠️ {desc}: no matching methods found")

    applied = sum(1 for r in results if r["status"] == "applied")
    print(f"\n🔧 Patching complete: {applied}/{len(results)} patches applied")
    return {"results": results, "applied": applied, "total": len(results)}
