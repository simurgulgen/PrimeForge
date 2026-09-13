# -*- coding: utf-8 -*-
"""Supabase client for PrimeForge job and profile management."""
import json
import os
import ssl
import urllib.request
from datetime import datetime, timezone

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://mdorxlwvitfixbzajksw.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE


def _request(endpoint, method="GET", data=None, extra_headers=None):
    """Make a request to Supabase REST API."""
    if not SUPABASE_KEY:
        print("⚠️ SUPABASE_KEY not set, skipping remote db call")
        return {}
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    if extra_headers:
        headers.update(extra_headers)

    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30, context=_ctx) as resp:
            content = resp.read().decode("utf-8")
            return json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        print(f"Supabase error {e.code}: {error_body}")
        raise
    except Exception as e:
        print(f"Supabase request failed: {e}")
        return {}


def create_job(apk_url, action="full_mod", github_run_id=""):
    data = {"apk_url": apk_url, "action": action, "status": "pending", "github_run_id": github_run_id}
    result = _request("forge_jobs", method="POST", data=data)
    return result[0] if isinstance(result, list) and result else result


def update_job(job_id, updates):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    return _request(f"forge_jobs?id=eq.{job_id}", method="PATCH", data=updates)


def get_job(job_id):
    result = _request(f"forge_jobs?id=eq.{job_id}")
    return result[0] if isinstance(result, list) and result else {}


def get_profile(package_name):
    result = _request(f"forge_profiles?package_name=eq.{package_name}")
    return result[0] if isinstance(result, list) and result else {}


def upsert_profile(package_name, profile_name, profile_yaml, modding_guide="", auto_apply=True):
    """Upsert profile into forge_profiles table."""
    now = datetime.now(timezone.utc).isoformat()
    existing = get_profile(package_name)
    success_count = (existing.get("success_count", 0) + 1) if existing else 1

    data = {
        "package_name": package_name,
        "profile_name": profile_name,
        "auto_apply": auto_apply,
        "profile_yaml": profile_yaml,
        "modding_guide": modding_guide,
        "last_used_at": now,
        "updated_at": now,
        "success_count": success_count
    }
    extra_headers = {"Prefer": "resolution=merge-duplicates,return=representation"}
    result = _request("forge_profiles", method="POST", data=data, extra_headers=extra_headers)
    return result[0] if isinstance(result, list) and result else result


def update_listing(listing_id, updates):
    return _request(f"listings?id=eq.{listing_id}", method="PATCH", data=updates)


def find_listing_by_package(package_name):
    result = _request(f'listings?"packageName"=eq.{package_name}&select=id,title,"packageName",version,"fileUrl",status')
    return result[0] if isinstance(result, list) and result else {}


def get_all_listings(limit=100):
    """Fetch active listings from PrimeStore catalog."""
    result = _request(f'listings?status=eq.published&select=id,title,"packageName",version,"fileUrl",icon_url&order=created_at.desc&limit={limit}')
    return result if isinstance(result, list) else []
