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
  const headers = {
    Authorization: `Bearer ${activeToken}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event_type: eventType,
        client_payload: clientPayload,
      }),
    });

    if (res.status === 204) {
      // Try to capture the workflow run ID by polling recent runs
      let workflowRunId: number | null = null;
      let workflowUrl: string | null = null;
      
      try {
        // Wait a moment for GitHub to register the run
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const runsRes = await fetch(
          `https://api.github.com/repos/${activeRepo}/actions/runs?event=repository_dispatch&per_page=5`,
          { headers }
        );
        if (runsRes.ok) {
          const runsData = await runsRes.json();
          const recentRun = runsData.workflow_runs?.[0];
          if (recentRun) {
            workflowRunId = recentRun.id;
            workflowUrl = recentRun.html_url;
          }
        }
      } catch (_) {}

      return { 
        success: true, 
        workflow_run_id: workflowRunId,
        workflow_url: workflowUrl,
        repo: activeRepo,
      };
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
    let runStatus = 'triggered';

    if (action === 'check_updates') {
      const ghRes = await triggerGitHubWorkflow(
        'scheduled-update-check',
        { triggered_by: 'primeforge_web_ui', timestamp: Date.now() },
        creds.githubToken,
        creds.githubRepo
      );
      result.github = ghRes;
      result.workflow_run_id = ghRes.workflow_run_id;
      result.workflow_url = ghRes.workflow_url;
      result.message = ghRes.success
        ? `⚡ Güncelleme Denetçisi tetiklendi! ${ghRes.workflow_url ? '' : '(Workflow ID bekleniyor...)'}`
        : `⚠️ Tetikleme uyarısı: ${ghRes.error}`;
      result.details = {
        description: 'GitHub Actions üzerinde PrimeStore katalogundaki tüm uygulamaların güncel sürümleri kontrol ediliyor. NIM AI doğrulaması ile sahte güncellemeler filtreleniyor.',
        next_steps: ['Sonuçlar /updates sayfasında görünecek', 'NIM doğrulaması yapılacak', 'Telegram bildirimi gönderilecek'],
        related_page: '/updates',
        related_page_label: 'Güncellemeler Sayfası',
      };
      runStatus = ghRes.success ? 'running' : 'failed';

    } else if (action === 'health_check') {
      const ghRes = await triggerGitHubWorkflow(
        'stream-health-check',
        { triggered_by: 'primeforge_web_ui', timestamp: Date.now() },
        creds.githubToken,
        creds.githubRepo
      );
      result.github = ghRes;
      result.workflow_run_id = ghRes.workflow_run_id;
      result.workflow_url = ghRes.workflow_url;
      result.message = ghRes.success
        ? '📺 IPTV Sağlık Kontrolü başlatıldı!'
        : `⚠️ Tetikleme uyarısı: ${ghRes.error}`;
      result.details = {
        description: 'Havuzdaki her IPTV hesabı Xtream API ile test ediliyor. Ölü hesaplar 3-strike kuralıyla temizleniyor, 1/1 dolu olanlar korunuyor.',
        next_steps: ['Canlı/ölü hesap ayrımı yapılacak', 'KV senkronize edilecek', 'Telegram raporu gönderilecek'],
        related_page: '/pool',
        related_page_label: 'IPTV Havuzu',
      };
      runStatus = ghRes.success ? 'running' : 'failed';

    } else if (action === 'nightly_scan') {
      const ghRes = await triggerGitHubWorkflow(
        'nightly_iptv_pool_scan',
        { triggered_by: 'primeforge_web_ui', timestamp: Date.now() },
        creds.githubToken,
        creds.githubRepo
      );
      result.github = ghRes;
      result.workflow_run_id = ghRes.workflow_run_id;
      result.workflow_url = ghRes.workflow_url;
      result.message = ghRes.success
        ? '🌙 Gece IPTV Taraması başlatıldı!'
        : `⚠️ Tetikleme uyarısı: ${ghRes.error}`;
      result.details = {
        description: 'Online IPTV portalları taranıyor. Bulunan hesaplar NIM AI ile ayrıştırılıp test edildikten sonra havuza ekleniyor.',
        next_steps: ['Portal URL\'leri taranacak', 'NIM hesap çıkarması yapılacak', 'Canlı test ve havuz ekleme'],
        related_page: '/pool',
        related_page_label: 'IPTV Havuzu',
      };
      runStatus = ghRes.success ? 'running' : 'failed';

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
          result.details = {
            description: `Toplam ${accounts.length} IPTV hesabı Cloudflare Edge KV'ye push edildi.`,
            next_steps: ['TigerStream uygulaması güncel havuzu alacak'],
            stats: { total: accounts.length, synced: syncRes.ok ? accounts.length : 0 },
          };
          runStatus = syncRes.ok ? 'success' : 'failed';
        } catch (e: any) {
          result.kv = { success: false, error: e?.message };
          result.message = `❌ KV bağlantı hatası: ${e?.message}`;
          runStatus = 'failed';
        }
      } else {
        result.message = '⚠️ Senkronize edilecek havuz verisi bulunamadı.';
        result.details = { description: 'Lokal havuz dosyası bulunamadı veya boş.' };
        runStatus = 'failed';
      }
    } else if (action === 'test_nim') {
      // NIM API bağlantı testi
      const nimKey = creds.nimApiKey;
      if (!nimKey) {
        result.nim = { success: false, error: 'NVIDIA NIM anahtarı bulunamadı (forge_settings veya env)' };
        result.message = '⚠️ NVIDIA NIM API anahtarı tanımlanmamış. Lütfen Supabase ayarlarına ekleyin.';
        result.details = { description: 'NIM API key eksik. API & Token Ayarları\'ndan ekleyin.' };
        runStatus = 'failed';
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
            result.message = `🧠 NVIDIA NIM aktif ve çalışıyor! Yanıt süresi: ${latency}ms`;
            result.details = {
              description: `Model: ${creds.nimModel}\nYanıt: "${reply.trim()}"\nGecikme: ${latency}ms`,
              stats: { latency_ms: latency, model: creds.nimModel, response: reply.trim() },
            };
            runStatus = 'success';
          } else {
            result.nim = { success: false, status: nimRes.status, latencyMs: latency };
            result.message = `⚠️ NIM API hatası: HTTP ${nimRes.status}`;
            runStatus = 'failed';
          }
        } catch (e: any) {
          result.nim = { success: false, error: e?.message };
          result.message = `❌ NIM bağlantı hatası: ${e?.message}`;
          runStatus = 'failed';
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
      result.details = {
        description: 'Credentials Supabase forge_settings tablosuna yazıldı. Tüm otomasyonlar otomatik olarak yeni anahtarları kullanacak.',
        stats: updates,
      };
      runStatus = 'success';
    } else {
      return NextResponse.json({ error: 'Geçersiz eylem' }, { status: 400 });
    }

    // Supabase automation_runs tablosuna detaylı kayıt yaz
    try {
      await supabase.from('automation_runs').insert({
        run_type: action,
        status: runStatus,
        summary: result,
        started_at: new Date().toISOString(),
        finished_at: runStatus === 'success' || runStatus === 'failed' ? new Date().toISOString() : null,
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
