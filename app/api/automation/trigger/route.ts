import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAppCredentials } from '@/lib/credentials';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

async function triggerGitHubWorkflow(eventType: string, clientPayload: any = {}, token?: string, repo?: string) {
  const activeToken = token || process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || process.env.GITHUB_DATA_PAT || '';
  const activeRepo = repo || process.env.GITHUB_REPO || 'simurgulgen/PrimeForge';

  if (!activeToken) {
    return { success: false, error: 'GitHub Token tanımlı değil (Supabase forge_settings veya GITHUB_TOKEN)' };
  }

  const url = `https://api.github.com/repos/${activeRepo}/dispatches`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${activeToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: eventType,
        client_payload: clientPayload,
      }),
    });

    if (res.status === 204) {
      return { success: true };
    }
    const errText = await res.text();
    return { success: false, error: `GitHub API ${res.status}: ${errText}` };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Bilinmeyen hata' };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Eylem (action) belirtilmedi' }, { status: 400 });
    }

    const creds = await getAppCredentials();
    let result: any = { action, triggered_at: new Date().toISOString() };

    if (action === 'check_updates') {
      const ghRes = await triggerGitHubWorkflow(
        'scheduled-update-check',
        { triggered_by: 'primeforge_web_ui', timestamp: Date.now() },
        creds.githubToken,
        creds.githubRepo
      );
      result.github = ghRes;
      result.message = ghRes.success
        ? '⚡ GitHub Actions Güncelleme Denetçisi tetiklendi.'
        : `⚠️ Tetikleme uyarısı: ${ghRes.error}`;
    } else if (action === 'health_check') {
      const ghRes = await triggerGitHubWorkflow(
        'stream-health-check',
        { triggered_by: 'primeforge_web_ui', timestamp: Date.now() },
        creds.githubToken,
        creds.githubRepo
      );
      result.github = ghRes;
      result.message = ghRes.success
        ? '📺 4 Saatlik Stream Health Check iş akışı başlatıldı.'
        : `⚠️ Tetikleme uyarısı: ${ghRes.error}`;
    } else if (action === 'nightly_scan') {
      const ghRes = await triggerGitHubWorkflow(
        'nightly_iptv_pool_scan',
        { triggered_by: 'primeforge_web_ui', timestamp: Date.now() },
        creds.githubToken,
        creds.githubRepo
      );
      result.github = ghRes;
      result.message = ghRes.success
        ? '🌙 Gece IPTV Taraması iş akışı başlatıldı.'
        : `⚠️ Tetikleme uyarısı: ${ghRes.error}`;
    } else if (action === 'sync_kv') {
      // Mevcut havuz dosyasını bulup KV API'ye bas
      const candidates = [
        path.join(process.cwd(), 'data', 'wars_iptv_pool.json'),
        path.join(process.cwd(), '..', 'data', 'wars_iptv_pool.json'),
      ];
      let accounts: any[] = [];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          try {
            const raw = fs.readFileSync(p, 'utf-8');
            const parsed = JSON.parse(raw);
            accounts = Array.isArray(parsed) ? parsed : (parsed.accounts || []);
            break;
          } catch (_) {}
        }
      }

      if (accounts.length > 0) {
        try {
          const syncRes = await fetch('https://api.primestore.world/iptv/sync-pool', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-PrimeStore-Client': 'primeforge',
              'X-PrimeStore-Secret': 'primestore_admin_2026',
            },
            body: JSON.stringify({ accounts }),
          });
          const resData = await syncRes.json().catch(() => ({}));
          result.kv = { success: syncRes.ok, data: resData, count: accounts.length };
          result.message = syncRes.ok
            ? `☁️ ${accounts.length} hesap Cloudflare Worker KV'ye başarıyla senkronize edildi.`
            : `❌ KV Hatası: ${syncRes.statusText}`;
        } catch (e: any) {
          result.kv = { success: false, error: e?.message };
          result.message = `❌ KV bağlantı hatası: ${e?.message}`;
        }
      } else {
        result.message = '⚠️ Senkronize edilecek havuz verisi bulunamadı.';
      }
    } else if (action === 'test_nim') {
      // NIM API bağlantı testi
      const nimKey = creds.nimApiKey;
      if (!nimKey) {
        result.nim = { success: false, error: 'NVIDIA NIM anahtarı bulunamadı (forge_settings veya env)' };
        result.message = '⚠️ NVIDIA NIM API anahtarı tanımlanmamış. Lütfen Supabase ayarlarına ekleyin.';
      } else {
        const startT = Date.now();
        try {
          const nimRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${nimKey}`,
            },
            body: JSON.stringify({
              model: creds.nimModel || 'nvidia/nemotron-3-super-120b-a12b',
              messages: [{ role: 'user', content: 'Say "NIM_ACTIVE_OK" and nothing else.' }],
              max_tokens: 10,
              temperature: 0.1,
            }),
          });
          const latency = Date.now() - startT;
          if (nimRes.ok) {
            const data = await nimRes.json();
            const reply = data?.choices?.[0]?.message?.content || '';
            result.nim = { success: true, latencyMs: latency, reply };
            result.message = `🧠 NVIDIA NIM aktif ve çalışıyor! Yanıt süresi: ${latency}ms (Model: ${creds.nimModel})`;
          } else {
            result.nim = { success: false, status: nimRes.status, latencyMs: latency };
            result.message = `⚠️ NIM API hatası: HTTP ${nimRes.status}`;
          }
        } catch (e: any) {
          result.nim = { success: false, error: e?.message };
          result.message = `❌ NIM bağlantı hatası: ${e?.message}`;
        }
      }
    } else if (action === 'save_credentials') {
      const { github_token, github_repo, nvidia_nim_key } = body;
      const updates: any = {};

      if (github_token || github_repo) {
        await supabase.from('forge_settings').upsert({
          key: 'github_settings',
          value: {
            token: github_token || creds.githubToken,
            repo: github_repo || creds.githubRepo,
          },
          updated_at: new Date().toISOString(),
        });
        updates.github = true;
      }

      if (nvidia_nim_key) {
        const { data: existingAi } = await supabase
          .from('forge_settings')
          .select('value')
          .eq('key', 'ai_studio_settings')
          .maybeSingle();

        const curVal = existingAi?.value || {};
        const curKeys = curVal.keys || {};
        curKeys.nvidia_nim = nvidia_nim_key;

        await supabase.from('forge_settings').upsert({
          key: 'ai_studio_settings',
          value: {
            ...curVal,
            apiKey: nvidia_nim_key,
            provider: 'nvidia_nim',
            model: curVal.model || 'nvidia/nemotron-3-super-120b-a12b',
            keys: curKeys,
          },
          updated_at: new Date().toISOString(),
        });
        updates.nim = true;
      }

      result.updates = updates;
      result.message = '✅ API Anahtarları ve GitHub ayarları Supabase veritabanına başarıyla kaydedildi!';
    } else {
      return NextResponse.json({ error: 'Geçersiz eylem' }, { status: 400 });
    }

    // Supabase automation_runs tablosuna kaydet
    try {
      await supabase.from('automation_runs').insert({
        run_type: action,
        status: 'triggered',
        summary: result,
      });
    } catch (_) {}

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Eylem tetiklenemedi' },
      { status: 500 }
    );
  }
}
