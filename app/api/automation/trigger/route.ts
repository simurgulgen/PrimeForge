import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const GITHUB_REPO = process.env.GITHUB_REPO || 'simurgulgen/PrimeForge';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

async function triggerGitHubWorkflow(eventType: string, clientPayload: any = {}) {
  if (!GITHUB_TOKEN) {
    return { success: false, error: 'GITHUB_TOKEN sunucuda tanımlı değil' };
  }

  const url = `https://api.github.com/repos/${GITHUB_REPO}/dispatches`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
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

    let result: any = { action, triggered_at: new Date().toISOString() };

    if (action === 'check_updates') {
      const ghRes = await triggerGitHubWorkflow('scheduled-update-check', {
        triggered_by: 'primeforge_web_ui',
        timestamp: Date.now(),
      });
      result.github = ghRes;
      result.message = ghRes.success
        ? '⚡ GitHub Actions Güncelleme Denetçisi tetiklendi.'
        : `⚠️ Tetikleme uyarısı: ${ghRes.error}`;
    } else if (action === 'health_check') {
      const ghRes = await triggerGitHubWorkflow('stream-health-check', {
        triggered_by: 'primeforge_web_ui',
        timestamp: Date.now(),
      });
      result.github = ghRes;
      result.message = ghRes.success
        ? '📺 4 Saatlik Stream Health Check iş akışı başlatıldı.'
        : `⚠️ Tetikleme uyarısı: ${ghRes.error}`;
    } else if (action === 'nightly_scan') {
      const ghRes = await triggerGitHubWorkflow('nightly_iptv_pool_scan', {
        triggered_by: 'primeforge_web_ui',
        timestamp: Date.now(),
      });
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
      const nimKey = process.env.NVIDIA_NIM_API_KEY || process.env.NIM_API_KEY || '';
      if (!nimKey) {
        result.nim = { success: false, error: 'NVIDIA_NIM_API_KEY ortam değişkeni eksik' };
        result.message = '⚠️ NVIDIA NIM API anahtarı tanımlanmamış.';
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
              model: 'nvidia/nemotron-3-super-120b-a12b',
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
            result.message = `🧠 NVIDIA NIM aktif! Yanıt süresi: ${latency}ms`;
          } else {
            result.nim = { success: false, status: nimRes.status, latencyMs: latency };
            result.message = `⚠️ NIM API hatası: HTTP ${nimRes.status}`;
          }
        } catch (e: any) {
          result.nim = { success: false, error: e?.message };
          result.message = `❌ NIM bağlantı hatası: ${e?.message}`;
        }
      }
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
