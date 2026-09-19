# -*- coding: utf-8 -*-
"""PrimeForge AI Advisor & Auto-Pilot Engine.

Direct Python interface to AI providers (Gemini, Groq, DeepSeek, NVIDIA NIM, Anthropic, OpenCode Zen).
Provides autonomous intelligence during APK modding:
- Profile generation for unknown applications
- Obfuscated class / method deobfuscation
- Smali patch recovery and alternative regex generation
- Test crash analysis and logcat diagnostics
"""
import json
import os
import re
import ssl
import sys
import urllib.request
import urllib.error
import yaml
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

_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE

MANDATORY_SYSTEM_PROMPT = """Sen PrimeForge'un Kıdemli Android Güvenlik, Tersine Mühendislik ve Smali Kodlama Asistanısın.
Android APK analizleri, smali baypas yamaları, reklam/DRM temizliği, Android TV kumanda (DPAD) optimizasyonu konularında uzmanlaşmış yapay zeka oto-pilotusun.
İstenen çıktıları eksiksiz, teknik doğruluğu tam ve doğrudan uygulanabilir formatta sağlarsın.
"""

def get_available_ai_config() -> dict:
    """Resolve active AI provider, model and API key from Supabase forge_settings and env."""
    config = {
        "provider": None,
        "model": None,
        "api_key": None,
        "base_url": None,
        "keys": {},
    }

    # 1. Check Supabase forge_settings
    try:
        from engine.supabase_client import get_ai_settings
        db_settings = get_ai_settings()
        if db_settings:
            config["provider"] = db_settings.get("provider")
            config["model"] = db_settings.get("model")
            config["base_url"] = db_settings.get("baseUrl")
            if isinstance(db_settings.get("keys"), dict):
                config["keys"].update(db_settings["keys"])
            if db_settings.get("apiKey"):
                config["api_key"] = db_settings["apiKey"].strip()
    except Exception as e:
        print(f"⚠️ Failed to check Supabase AI settings: {e}")

    # 2. Check Environment Variables (Overrides/Complements)
    env_keys = {
        "gemini": os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"),
        "groq": os.environ.get("GROQ_API_KEY"),
        "deepseek": os.environ.get("DEEPSEEK_API_KEY"),
        "nvidia_nim": os.environ.get("NVIDIA_NIM_API_KEY"),
        "opencodezen": os.environ.get("OPENCODE_API_KEY") or os.environ.get("OPENCODEZEN_API_TOKEN") or os.environ.get("OPENCODE_TOKEN"),
        "anthropic": os.environ.get("ANTHROPIC_API_KEY"),
        "custom_openai": os.environ.get("OPENAI_API_KEY"),
    }
    for prov, key in env_keys.items():
        if key and key.strip():
            config["keys"][prov] = key.strip()

    # Determine default provider if not set or invalid
    active_prov = config["provider"]
    if not active_prov or not (config["keys"].get(active_prov) or (active_prov == config["provider"] and config["api_key"])):
        # Auto-pick best available provider
        priority = ["gemini", "groq", "deepseek", "nvidia_nim", "opencodezen", "anthropic", "custom_openai"]
        for p in priority:
            if config["keys"].get(p):
                active_prov = p
                break

    if active_prov:
        config["provider"] = active_prov
        config["api_key"] = config["keys"].get(active_prov) or config["api_key"]
        if not config["model"]:
            defaults = {
                "gemini": "gemini-2.0-flash",
                "groq": "llama-3.3-70b-versatile",
                "deepseek": "deepseek-chat",
                "nvidia_nim": "nvidia/nemotron-3-super-120b-a12b",
                "opencodezen": "hy3-free",
                "anthropic": "claude-3-5-sonnet-20241022",
                "custom_openai": "gpt-4o-mini",
            }
            config["model"] = defaults.get(active_prov, "gemini-2.0-flash")

    return config


def is_ai_available() -> bool:
    """Check if any AI provider is configured and available."""
    cfg = get_available_ai_config()
    return bool(cfg.get("provider") and cfg.get("api_key"))


def _call_gemini_api(model: str, api_key: str, prompt: str, system: str, max_tokens: int = 3000, temp: float = 0.3) -> str:
    """Execute request against Google Gemini REST API."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": temp,
            "maxOutputTokens": max_tokens,
        },
    }
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=45, context=_ctx) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        candidate = res.get("candidates", [{}])[0]
        parts = candidate.get("content", {}).get("parts", [{}])
        return parts[0].get("text", "")


def _call_openai_compatible_api(endpoint: str, model: str, api_key: str, prompt: str, system: str, max_tokens: int = 3000, temp: float = 0.3) -> str:
    """Execute request against OpenAI-compatible REST API (Groq, DeepSeek, NVIDIA NIM, OpenCode Zen, etc.)."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temp,
        "max_tokens": max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(endpoint, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=45, context=_ctx) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        choices = res.get("choices", [{}])
        return choices[0].get("message", {}).get("content", "")


def _call_anthropic_api(model: str, api_key: str, prompt: str, system: str, max_tokens: int = 3000, temp: float = 0.3) -> str:
    """Execute request against Anthropic Claude API."""
    url = "https://api.anthropic.com/v1/messages"
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": temp,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        payload["system"] = system

    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=45, context=_ctx) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        contents = res.get("content", [{}])
        return contents[0].get("text", "")


def ask_ai(prompt: str, system_instruction: str = None, max_tokens: int = 3000, temp: float = 0.3) -> str:
    """Execute an AI request using the active provider with automatic fallback to secondary providers."""
    cfg = get_available_ai_config()
    system = f"{MANDATORY_SYSTEM_PROMPT}\n\n{system_instruction or ''}"

    primary_prov = cfg.get("provider")
    primary_key = cfg.get("api_key")
    primary_model = cfg.get("model")

    if not primary_prov or not primary_key:
        raise RuntimeError("Hiçbir AI Provider veya API Key tanımlı değil!")

    # Build queue of (provider, model, key) to try
    queue = [(primary_prov, primary_model, primary_key, cfg.get("base_url"))]

    # Add other available providers as fallbacks
    fallback_defaults = {
        "gemini": "gemini-2.0-flash",
        "groq": "llama-3.3-70b-versatile",
        "deepseek": "deepseek-chat",
        "nvidia_nim": "nvidia/nemotron-3-super-120b-a12b",
        "opencodezen": "hy3-free",
        "anthropic": "claude-3-5-sonnet-20241022",
    }
    for prov, k in cfg.get("keys", {}).items():
        if prov != primary_prov and k:
            queue.append((prov, fallback_defaults.get(prov, "gemini-2.0-flash"), k, None))

    last_error = None
    for prov, model, key, base_url in queue:
        try:
            print(f"🤖 AI Çağrısı yapılıyor: {prov} ({model})...")
            if prov == "gemini":
                return _call_gemini_api(model, key, prompt, system, max_tokens, temp)
            elif prov == "anthropic":
                return _call_anthropic_api(model, key, prompt, system, max_tokens, temp)
            elif prov == "groq":
                return _call_openai_compatible_api("https://api.groq.com/openai/v1/chat/completions", model, key, prompt, system, max_tokens, temp)
            elif prov == "deepseek":
                return _call_openai_compatible_api("https://api.deepseek.com/v1/chat/completions", model, key, prompt, system, max_tokens, temp)
            elif prov == "nvidia_nim":
                return _call_openai_compatible_api("https://integrate.api.nvidia.com/v1/chat/completions", model, key, prompt, system, max_tokens, temp)
            elif prov == "opencodezen":
                ep = f"{(base_url or 'https://api.opencode.ai/v1').rstrip('/')}/chat/completions"
                return _call_openai_compatible_api(ep, model, key, prompt, system, max_tokens, temp)
            elif prov == "custom_openai":
                ep = f"{(base_url or 'http://localhost:11434/v1').rstrip('/')}/chat/completions"
                return _call_openai_compatible_api(ep, model, key, prompt, system, max_tokens, temp)
            else:
                raise ValueError(f"Bilinmeyen provider: {prov}")
        except Exception as e:
            print(f"⚠️ AI provider {prov} hatası: {e}")
            last_error = e
            continue

    raise RuntimeError(f"Tüm AI provider denemeleri başarısız oldu. Son hata: {last_error}")


def _extract_yaml_or_json(text: str) -> dict:
    """Safely extract YAML or JSON data from AI response text."""
    # 1. Try markdown code block extraction
    code_block_match = re.search(r'```(?:yaml|json)?\s*\n(.*?)\n```', text, re.DOTALL)
    if code_block_match:
        content = code_block_match.group(1).strip()
        try:
            return yaml.safe_load(content) or {}
        except Exception:
            try:
                return json.loads(content) or {}
            except Exception:
                pass

    # 2. Try raw YAML safe load
    try:
        parsed = yaml.safe_load(text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    # 3. Try finding first '{' and last '}'
    brace_match = re.search(r'\{.*\}', text, re.DOTALL)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except Exception:
            pass

    return {}


def ai_generate_profile(analysis_report: dict) -> dict:
    """Generate a complete PrimeForge YAML profile for an unknown application using AI.
    
    Returns a dict representation of the YAML profile with auto_apply=True.
    """
    pkg = analysis_report.get("package_name", "unknown")
    app_label = analysis_report.get("app_label") or analysis_report.get("app_name") or pkg
    ver = analysis_report.get("version_name", "1.0")
    ads = analysis_report.get("ad_networks", [])
    drm = analysis_report.get("drm_systems", [])
    dangerous_perms = analysis_report.get("permissions", {}).get("dangerous", [])
    all_perms = analysis_report.get("permissions", {}).get("all", [])
    obf = analysis_report.get("obfuscation", {})
    archs = analysis_report.get("architectures", [])

    prompt = f"""Aşağıdaki Android APK statik analiz raporuna dayanarak, PrimeForge pipeline'ı için eksiksiz ve geçerli bir YAML modlama profili üret.

APK BİLGİLERİ:
- Paket Adı: {pkg}
- Uygulama Başlığı: {app_label}
- Sürüm: {ver}
- Desteklenen Mimariler: {archs}
- Tespit Edilen Reklam Ağları: {[a['name'] for a in ads]}
- Tespit Edilen DRM/Lisans Sistemleri: {[d['name'] for d in drm]}
- Tehlikeli İzinler: {dangerous_perms}
- Toplam İzinler: {all_perms[:30]}
- Karıştırma / Koruma: {obf.get('level', 'normal')} ({obf.get('detector', 'Bilinmiyor')})

GÖREV:
PrimeForge için YAML formatında bir modlama profili üret.
Profil şunları İÇERMELİDİR:
1. `name`: Başlık (örn: "{app_label} Prime Mod")
2. `package`: "{pkg}"
3. `extends`: "_base"
4. `auto_apply`: true
5. `mod_features`: Yapılan modifikasyonların listesi (id, name, description, default: true)
6. `manifest_cleanup`:
   - `remove_permissions`: Kaldırılacak zararlı/izleme izinleri (reklam ID, billing, get_install_referrer, konum vs.)
7. `smali_patches`:
   - Eğer Google Play Billing varsa:
     - BillingResult.getResponseCode -> return_zero
     - Purchase.getPurchaseState -> return_one
   - Eğer RevenueCat varsa:
     - CustomerInfo veya Purchases metotları için patch_type
   - Tespit edilen reklam ağları için (AdMob, UnityAds, AppLovin vs.) reklam yükleme veya gösterme metotlarını nötralize eden yamalar.
8. `test`:
   - `launch_timeout_seconds`: 15
   - `expect_no_crash`: true
   - `tv_dpad_verify`: true

YANIT FORMATI:
YALNIZCA geçerli YAML formatında bir kod bloğu (```yaml ... ```) içinde yanıt ver. Açıklama yazma.
"""

    try:
        raw_response = ask_ai(prompt, system_instruction="Android tersine mühendislik uzmanı olarak yalnızca geçerli YAML formatında profil döndür.")
        profile_dict = _extract_yaml_or_json(raw_response)
    except Exception as e:
        print(f"⚠️ AI profil üretimi çağrısında hata: {e}. Akıllı varsayılan şablon oluşturuluyor...")
        profile_dict = {}

    # Validate or enrich mandatory keys
    if not isinstance(profile_dict, dict) or not profile_dict.get("package"):
        print("⚠️ AI yanıtından tam profil çıkarılamadı, güvenli varsayılan şablon oluşturuluyor...")
        profile_dict = {
            "name": f"{app_label} Prime Mod (AI Generated)",
            "package": pkg,
            "extends": "_base",
            "auto_apply": True,
            "mod_features": [
                {
                    "id": "strip_trackers",
                    "name": "Takipçi ve Reklam İzinlerini Temizle",
                    "description": "AD_ID, izleme ve arka plan veri toplama izinlerini temizler.",
                    "default": True,
                },
                {
                    "id": "standard_billing_patch",
                    "name": "Standart In-App Billing Baypas",
                    "description": "Google Play BillingResult yanıtını OK olarak simüle eder.",
                    "default": True,
                }
            ],
            "smali_patches": [
                {
                    "description": "BillingResult.getResponseCode -> OK (0)",
                    "target_class": "BillingResult",
                    "method": "getResponseCode",
                    "patch_type": "return_zero",
                },
                {
                    "description": "Purchase.getPurchaseState -> PURCHASED (1)",
                    "target_class": "Purchase",
                    "method": "getPurchaseState",
                    "patch_type": "return_one",
                }
            ],
            "manifest_cleanup": {
                "remove_permissions": [
                    "com.google.android.gms.permission.AD_ID",
                    "com.android.vending.BILLING",
                    "com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE",
                ] + [p for p in dangerous_perms if "LOCATION" in p or "CAMERA" in p or "RECORD" in p],
            },
            "test": {
                "launch_timeout_seconds": 15,
                "expect_no_crash": True,
                "tv_dpad_verify": True,
            }
        }
    else:
        profile_dict["auto_apply"] = True
        if "package" not in profile_dict:
            profile_dict["package"] = pkg
        if "extends" not in profile_dict:
            profile_dict["extends"] = "_base"

    return profile_dict


def ai_resolve_obfuscation(decompiled_dir: str, target_class: str, context_info: str = "") -> str:
    """Use AI to find an obfuscated class when a standard class name cannot be found.
    
    Scans smali files for key string signatures and asks AI which class implements the target behavior.
    Returns the resolved class name / path, or None.
    """
    if not os.path.exists(decompiled_dir):
        return None

    # Search for keywords in smali directories
    keywords = ["billing", "purchase", "sku", "subs", "subscription", "license", "licensing", "ispremium", "ispro", "issubscribed"]
    clean_target = target_class.lower()
    for kw in [clean_target, "billingresult", "purchase", "premium"]:
        if kw not in keywords:
            keywords.append(kw)

    candidates = []
    smali_dirs = [d for d in os.listdir(decompiled_dir) if d.startswith("smali")]
    for sdir in smali_dirs:
        sdir_path = os.path.join(decompiled_dir, sdir)
        for smali_file in Path(sdir_path).rglob("*.smali"):
            if len(candidates) >= 15:
                break
            try:
                with open(smali_file, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read(4096)
                matches = [kw for kw in keywords if kw in content.lower()]
                if len(matches) >= 2 or clean_target in content.lower():
                    first_lines = "\n".join(content.splitlines()[:25])
                    candidates.append({
                        "file": str(smali_file).replace("\\", "/"),
                        "preview": first_lines
                    })
            except Exception:
                continue

    if not candidates:
        return None

    prompt = f"""Android uygulamasında karıştırılmış (obfuscated) bir smali sınıfı arıyoruz.
Aranan Hedef Kavram/Sınıf: {target_class}
Ek Bağlam: {context_info}

Aşağıda potansiyel eşleşen smali dosyaları ve sınıf başlıkları yer almaktadır:
{json.dumps(candidates, indent=2, ensure_ascii=False)}

GÖREV:
Yukarıdaki adaylardan hangisinin '{target_class}' (veya eşdeğer lisans/satın alma/reklam/güvenlik mekanizması) olduğunu belirle.
Yanıtında YALNIZCA en uygun dosyanın yolunu veya sınıf adını (örn: "smali/a/b/c.smali" veya "Lcom/foo/bar;") tek bir satırda döndür.
Eşleşen yoksa "NONE" yaz.
"""
    try:
        res = ask_ai(prompt, max_tokens=100, temp=0.1).strip()
        lines = [line.strip() for line in res.splitlines() if line.strip()]
        for line in lines:
            if "NONE" in line.upper():
                return None
            for c in candidates:
                if c["file"] in line or Path(c["file"]).name in line or Path(c["file"]).stem in line:
                    print(f"💡 AI Obfuscation Çözüldü: {target_class} -> {c['file']}")
                    return c["file"]
    except Exception as e:
        print(f"⚠️ AI obfuscation resolution failed: {e}")

    return None


def ai_suggest_patch_fix(smali_content: str, patch_def: dict, error_reason: str = "") -> dict:
    """Suggest an alternative method name, return type, or regex patch when a patch fails to match.
    
    Returns a suggestion dict or None.
    """
    desc = patch_def.get("description", "patch")
    target_class = patch_def.get("target_class", "")
    method = patch_def.get("method", "")
    patch_type = patch_def.get("patch_type", "")

    # Extract all .method definitions from the smali content
    method_lines = [line.strip() for line in smali_content.splitlines() if line.strip().startswith(".method")]

    prompt = f"""PrimeForge smali yama uygulamasında bir kural 0 eşleşme verdi (uygulanamadı).
Yama Tanımı:
- Açıklama: {desc}
- Hedef Sınıf: {target_class}
- Hedef Metot: {method}
- Yama Türü: {patch_type}
- Hata Nedeni: {error_reason or 'Metot imzası veya adı smali dosyasında bulunamadı'}

Hedef Smali Sınıfındaki Mevcut Metot İmzaları:
{json.dumps(method_lines[:50], indent=2)}

GÖREV:
Bu sınıftaki mevcut metotlardan hangisinin istenen davranışı temsil ettiğini veya regex ile nasıl yamalanacağını belirle.
Aşağıdaki JSON formatında yanıt ver:
```json
{{
  "alternative_method": "metot_adi",
  "recommended_patch_type": "return_zero | return_one | return_true | return_false | return_void",
  "regex_replacement": {{
    "pattern": "regex_deseni",
    "replace": "yenisi"
  }},
  "explanation": "kısa açıklama"
}}
```
"""
    try:
        res = ask_ai(prompt, max_tokens=500, temp=0.2)
        parsed = _extract_yaml_or_json(res)
        if isinstance(parsed, dict) and (parsed.get("alternative_method") or parsed.get("regex_replacement")):
            print(f"💡 AI Yama Düzeltme Önerisi: {parsed.get('alternative_method')} ({parsed.get('recommended_patch_type')})")
            return parsed
    except Exception as e:
        print(f"⚠️ AI suggest patch fix failed: {e}")

    return None


def ai_interpret_test(test_report: dict, logcat_text: str = "") -> dict:
    """Analyze emulator test results and logcat output to explain failures and suggest fixes."""
    status = test_report.get("status", "UNKNOWN")
    crashed = test_report.get("crashed", False)
    pkg = test_report.get("package_name", "")

    prompt = f"""PrimeForge emülatör test sonuçlarını analiz et:
Paket: {pkg}
Durum: {status}
Çökme Var mı: {crashed}

Logcat / Hata Çıktısı:
{logcat_text[:3000]}

GÖREV:
Çökmenin veya hatanın temel nedenini (Root Cause) tespit et ve modlama tarafında (smali veya manifest) nasıl çözülebileceğini JSON olarak yanıtla:
```json
{{
  "root_cause": "Hatanın temel sebebi",
  "crash_type": "NullPointerException / SecurityException / ClassNotFoundException / Diğer",
  "proposed_fix": "Uygulanması gereken düzeltme adımı",
  "recommended_profile_action": "sanitize_adjustment / patch_adjustment"
}}
```
"""
    try:
        res = ask_ai(prompt, max_tokens=600, temp=0.2)
        return _extract_yaml_or_json(res)
    except Exception as e:
        print(f"⚠️ AI test interpretation failed: {e}")
        return {"root_cause": "AI analiz başarısız", "proposed_fix": str(e)}


def ai_generate_modding_guide(pipeline_result: dict) -> str:
    """Generate an insightful AI reverse-engineering commentary and modding guide in Markdown."""
    pkg = pipeline_result.get("package_name", "unknown")
    ver = pipeline_result.get("version_name", "1.0.0")
    analysis = pipeline_result.get("analysis", {})
    sanitization = pipeline_result.get("sanitization", {})
    patching = pipeline_result.get("patching", {})

    prompt = f"""PrimeForge ile modlanan aşağıdaki Android uygulaması için geliştirici ve topluluk odaklı, profesyonel bir 'Yapay Zeka Modlama Analizi ve Değerlendirmesi' bölümü oluştur (Markdown formatında).

UYGULAMA BİLGİLERİ:
- Paket: {pkg}
- Sürüm: {ver}
- Mimariler: {analysis.get('architectures', [])}
- Karıştırma (Obfuscation): {analysis.get('obfuscation', {}).get('level', 'normal')}
- Tespit Edilen Reklamlar: {[a.get('name') for a in analysis.get('ad_networks', [])]}
- Tespit Edilen DRM/Lisans: {[d.get('name') for d in analysis.get('drm_systems', [])]}
- Kaldırılan İzinler: {sanitization.get('changes', [])}
- Uygulanan Smali Yamaları: {[p.get('description') for p in patching.get('results', []) if p.get('status') == 'applied']}

GÖREV:
Aşağıdaki başlıkları içeren akıcı, profesyonel bir Türkçe Markdown raporu hazırla:
1. 🧠 Tersine Mühendislik & Güvenlik Özeti (Uygulamanın koruma seviyesi ve zayıf noktaları)
2. 🎯 Baypas Mekanizması Açıklaması (Yapılan smali ve manifest müdahalelerinin mantığı)
3. 🛡️ Kararlılık & Gelecek Güncelleme Tavsiyeleri (Yeni sürüm çıktığında dikkat edilmesi gereken hususlar)

Yalnızca doğrudan Markdown metnini döndür, fazladan selamlaşma veya sohbet cümlesi ekleme.
"""
    try:
        return ask_ai(prompt, system_instruction="Kıdemli Android güvenlik araştırmacısı ve tersine mühendislik uzmanı olarak doğrudan Türkçe Markdown çıktısı sağla.", max_tokens=1200, temp=0.3)
    except Exception as e:
        print(f"⚠️ AI guide generation error: {e}")
        return ""


def ai_preflight_smali_audit(smali_method_code: str, proposed_patch: dict, package_name: str = "") -> dict:
    """Pre-flight validation of a smali patch using FCC-Claude to prevent compile and runtime crashes.
    
    Validates:
    - Register count (.locals 0 vs registers used)
    - Method return type matching ()Z vs ()V vs ()I vs ()L...;)
    - Control flow consistency (:goto_, :cond_ labels)
    - Obfuscation symbol drift
    """
    desc = proposed_patch.get("description", "smali patch")
    patch_type = proposed_patch.get("patch_type", "")
    method = proposed_patch.get("method", "")
    target_class = proposed_patch.get("target_class", "")

    # Fast deterministic pre-check
    deterministic_result = {
        "safe": True,
        "risk_level": "LOW",
        "required_locals": 1,
        "issues": [],
        "autocorrected_patch": dict(proposed_patch),
        "explanation": "Ön denetim doğrulandı.",
    }

    # Extract method signature line
    sig_line = ""
    for line in smali_method_code.splitlines():
        if line.strip().startswith(".method"):
            sig_line = line.strip()
            break

    # Determine expected return type
    ret_type = "V"
    if ")Z" in sig_line:
        ret_type = "Z"
    elif ")I" in sig_line:
        ret_type = "I"
    elif ")V" in sig_line:
        ret_type = "V"
    elif ")L" in sig_line:
        ret_type = "L"

    # Type mismatch detection
    if patch_type in ["return_true", "return_false"] and ret_type == "V":
        deterministic_result["safe"] = False
        deterministic_result["risk_level"] = "HIGH"
        deterministic_result["issues"].append("Tip Uyuşmazlığı: Metot void ()V döndürürken patch boolean ()Z bekliyor.")
        deterministic_result["autocorrected_patch"]["patch_type"] = "return_void"
        deterministic_result["explanation"] = "Metot void olduğu için return_void olarak düzeltildi."
    elif patch_type == "return_void" and ret_type == "Z":
        deterministic_result["safe"] = False
        deterministic_result["risk_level"] = "HIGH"
        deterministic_result["issues"].append("Tip Uyuşmazlığı: Metot boolean ()Z döndürürken patch return_void yapmaya çalışıyor.")
        deterministic_result["autocorrected_patch"]["patch_type"] = "return_false"
        deterministic_result["explanation"] = "Metot boolean beklediği için return_false olarak düzeltildi."

    # If AI is available, run deep LLM pre-flight audit with FCC-Claude
    if is_ai_available():
        prompt = f"""PrimeForge Smali Pre-Flight Hata Önleme ve Derleme Doğrulaması.
APK Paketi: {package_name or 'Bilinmiyor'}
Hedef Sınıf: {target_class}
Yama Tanımı: {json.dumps(proposed_patch, indent=2)}

Hedef Smali Metot Kodu:
```smali
{smali_method_code[:2500]}
```

GÖREV:
Bu yamayı doğrudan bu metoda uyguladığımızda:
1. Apktool yeniden derlerken syntax/bytecode hatası verir mi?
2. .locals veya register sayısı yetersizliği (VerifyError) oluşur mu?
3. Dönüş tipi ()Z, ()V, ()I veya ()L nesnesi ile yama uyuşuyor mu?
4. Kod içerisinde unhandled NullPointerException veya bozuk goto etiketi riski var mı?

Aşağıdaki JSON formatında yanıt ver:
```json
{{
  "safe": true,
  "risk_level": "LOW | MEDIUM | HIGH",
  "required_locals": 1,
  "issues": ["Tespit edilen riskler"],
  "autocorrected_patch": {{
    "patch_type": "return_true | return_false | return_void | empty_list | vb",
    "method": "{method}",
    "locals_count": 1
  }},
  "explanation": "Detaylı Türkçe teknik gerekçe ve öneri"
}}
```
"""
        try:
            res = ask_ai(prompt, max_tokens=600, temp=0.1)
            parsed = _extract_yaml_or_json(res)
            if isinstance(parsed, dict) and "safe" in parsed:
                return parsed
        except Exception as e:
            print(f"⚠️ AI pre-flight call note: {e}")

    return deterministic_result


def ai_self_heal_patch(error_log: str, smali_context: str, failed_patch: dict, package_name: str = "") -> dict:
    """Analyze build or emulator test crash and synthesize self-healing patch via FCC-Claude."""
    default_heal = {
        "healed": False,
        "action": "skip_patch",
        "revised_patch": failed_patch,
        "explanation": "Otomatik onarım yapılamadı.",
    }

    if not is_ai_available():
        return default_heal

    target_cls = failed_patch.get("target_class", "")
    target_m = failed_patch.get("method", "")

    prompt = f"""PrimeForge Smali Self-Healing (Kendi Kendini Onaran) Hata Analizcisi.
Uygulama Paketi: {package_name or 'Bilinmiyor'}
Hata Logu / Çökme Raporu:
```
{error_log[-2000:]}
```

Hatalı veya Çöken Yama Tanımı:
{json.dumps(failed_patch, indent=2)}

İlgili Smali Kodu (Varsa):
```smali
{smali_context[:2500]}
```

GÖREV:
Bu çökmenin kök nedenini (örneğin register yetersizliği, VerifyError, bad return opcode, unhandled NPE veya kopuk kontrol akışı) analiz et.
Hatanın giderilmesi için düzeltilmiş yama tanımını aşağıdaki JSON formatında döndür:
```json
{{
  "healed": true,
  "action": "apply_revised_patch | replace_method | skip_patch",
  "root_cause": "Hatanın teknik açıklaması",
  "revised_patch": {{
    "description": "Onarılmış yama",
    "target_class": "{target_cls}",
    "method": "{target_m}",
    "patch_type": "return_true | return_false | return_void | empty_list",
    "locals_count": 1
  }},
  "explanation": "Türkçe teknik gerekçe"
}}
```
"""
    try:
        res = ask_ai(prompt, max_tokens=700, temp=0.1)
        parsed = _extract_yaml_or_json(res)
        if isinstance(parsed, dict) and parsed.get("healed"):
            return parsed
    except Exception as e:
        print(f"⚠️ Self-healing AI call error: {e}")

    return default_heal



