import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import path from 'path';
import fs from 'fs';

import { getAppCredentials } from '@/lib/credentials';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
};

function getPoolData() {
  const candidates = [
    path.join(process.cwd(), 'data', 'wars_iptv_pool.json'),
    path.join(process.cwd(), '..', 'data', 'wars_iptv_pool.json'),
    path.join(process.cwd(), 'scratch', 'wars_iptv_pool.json'),
    path.join(process.cwd(), '..', 'scratch', 'wars_iptv_pool.json'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(raw);
        const accounts = Array.isArray(parsed) ? parsed : (parsed.accounts || []);
        const active = accounts.filter((a: any) => a.status === 'Active' || a.status === 'active').length;
        const full = accounts.filter((a: any) => a.status === 'Full' || a.status === 'full').length;
        const degraded = accounts.filter((a: any) => a.status === 'Degraded').length;
        const hasTr = accounts.filter((a: any) => a.has_tr).length;
        return {
          total: accounts.length,
          active,
          full,
          degraded,
          hasTr,
          updated_at: parsed.updated_at || Date.now(),
          accounts: accounts.slice(0, 50), // İlk 50 örnek
        };
      } catch (_) {}
    }
  }

  return { total: 0, active: 0, full: 0, degraded: 0, hasTr: 0, updated_at: 0, accounts: [] };
}

export async function GET() {
  try {
    // 1. Supabase - Recent Jobs & NIM Verifications
    let jobs: any[] = [];
    let recentVerifications: any[] = [];
    let pendingJobsCount = 0;

    try {
      const { data: jobRows } = await supabase
        .from('forge_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (jobRows) {
        jobs = jobRows;
        pendingJobsCount = jobRows.filter((j: any) => j.status === 'pending' || j.status === 'queued').length;
        recentVerifications = jobRows
          .filter((j: any) => j.nim_verification && typeof j.nim_verification === 'object')
          .slice(0, 10);
      }
    } catch (e) {
      console.error('Supabase jobs fetch error:', e);
    }

    // 2. Supabase - Automation Runs
    let automationRuns: any[] = [];
    try {
      const { data: runRows } = await supabase
        .from('automation_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);
      if (runRows) {
        automationRuns = runRows;
      }
    } catch (_) {}

    // 3. IPTV Pool Verileri
    const pool = getPoolData();

    // 4. Cloudflare Gateway Durumu
    let gatewayOnline = false;
    let gatewayStats: any = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const gwRes = await fetch('https://api.primestore.world/health', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (gwRes.ok) {
        gatewayOnline = true;
        gatewayStats = await gwRes.json().catch(() => null);
      }
    } catch (_) {}

    // 5. Credentials & NIM AI Motor Yapılandırması
    const creds = await getAppCredentials();
    const nimConfig = {
      provider: 'NVIDIA NIM',
      model: creds.nimModel,
      endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
      isActive: Boolean(creds.nimApiKey),
      features: [
        'Akıllı Güncelleme Doğrulama (Sürüm & Güvenlik)',
        'IPTV Düzensiz Metin & Dosya Ayrıştırma',
        'IPTV Havuz Sağlık Analizi & Skorlama',
      ],
    };

    const credentials = {
      github: {
        configured: Boolean(creds.githubToken),
        repo: creds.githubRepo,
        maskedToken: creds.githubToken ? `${creds.githubToken.slice(0, 4)}...${creds.githubToken.slice(-4)}` : null,
      },
      nim: {
        configured: Boolean(creds.nimApiKey),
        maskedKey: creds.nimApiKey ? `${creds.nimApiKey.slice(0, 7)}...${creds.nimApiKey.slice(-4)}` : null,
        model: creds.nimModel,
      },
    };

    // 6. Zamanlanmış Otomasyon Görevleri (Crons)
    const crons = [
      {
        id: 'stream_health_check',
        name: 'TigerStream IPTV Sağlık Kontrolü',
        interval: 'Her 4 Saatte Bir (17 */4 * * *)',
        target: 'Ölü hesap temizliği, gecikme testi, KV senkronizasyonu',
        status: 'active',
        platform: 'GitHub Actions',
      },
      {
        id: 'scheduled_update_check',
        name: 'Uygulama Güncelleme Denetçisi (NIM)',
        interval: 'Her 6 Saatte Bir (0 */6 * * *)',
        target: 'Profil ve katalog güncelleme taraması, sahte sürüm koruması',
        status: 'active',
        platform: 'GitHub Actions',
      },
      {
        id: 'nightly_iptv_scan',
        name: 'Gece IPTV Portal Taraması',
        interval: 'Her Gece 03:00 UTC (0 3 * * *)',
        target: 'Portal taraması, KısaLinkAtla reklam baypas, NIM fallback',
        status: 'active',
        platform: 'GitHub Actions',
      },
      {
        id: 'worker_kv_cron',
        name: 'Cloudflare Worker Önbellek Yenileme',
        interval: 'Günde 2 Kez (0 0,12 * * *)',
        target: 'Edge KV önbelleğini canlı tutma ve yayın yönlendirme',
        status: 'active',
        platform: 'Cloudflare Worker',
      },
      {
        id: 'telegram_bot_webhook',
        name: 'Telegram Bot & Dosya İşleyici',
        interval: 'Anlık / Sürekli (Webhook)',
        target: 'TXT/M3U dosya yükleme, /health, /streams, /mod komutları',
        status: 'active',
        platform: 'Vercel Serverless',
      },
    ];

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        nim: nimConfig,
        credentials,
        iptv: {
          total: pool.total,
          active: pool.active,
          full: pool.full,
          degraded: pool.degraded,
          hasTr: pool.hasTr,
          healthScore: pool.total > 0 ? Math.round(((pool.active + pool.full) / pool.total) * 100) : 100,
          updatedAt: pool.updated_at,
          gatewayOnline,
          gatewayStats,
        },
        jobs: {
          total: jobs.length,
          pending: pendingJobsCount,
          recent: jobs.slice(0, 8),
          verifications: recentVerifications,
        },
        crons,
        automationRuns,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Automation status fetch failed' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
