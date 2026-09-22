import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

function getScratchPath(filename: string) {
  // PrimeStore root / data veya scratch dizini ya da Vercel data dizini
  const candidate1 = path.join(process.cwd(), 'data', filename);
  const candidate2 = path.join(process.cwd(), '..', 'data', filename);
  const candidate3 = path.join(process.cwd(), 'scratch', filename);
  const candidate4 = path.join(process.cwd(), '..', 'scratch', filename);
  if (fs.existsSync(candidate1)) return candidate1;
  if (fs.existsSync(candidate2)) return candidate2;
  if (fs.existsSync(candidate3)) return candidate3;
  if (fs.existsSync(candidate4)) return candidate4;
  return candidate1;
}

function getScriptsPath(filename: string) {
  const candidate1 = path.join(process.cwd(), '..', 'scripts', filename);
  const candidate2 = path.join(process.cwd(), 'scripts', filename);
  return fs.existsSync(candidate1) ? candidate1 : candidate2;
}

export async function GET() {
  try {
    const poolPath = getScratchPath('wars_iptv_pool.json');
    const registryPath = getScratchPath('scraped_links_registry.json');

    let poolData: any = { accounts: [], updated_at: 0, count: 0 };
    if (fs.existsSync(poolPath)) {
      try {
        const raw = fs.readFileSync(poolPath, 'utf-8');
        const parsed = JSON.parse(raw);
        poolData = Array.isArray(parsed) ? { accounts: parsed, updated_at: Date.now(), count: parsed.length } : parsed;
      } catch (_) {}
    }

    let registryData: any = { resolved_links: {}, updated_at: 0 };
    if (fs.existsSync(registryPath)) {
      try {
        const raw = fs.readFileSync(registryPath, 'utf-8');
        registryData = JSON.parse(raw);
      } catch (_) {}
    }

    let accounts = poolData.accounts || [];

    // Canlı havuz verisi ve kullanıcı claim (tanımlı) durumunu Cloudflare KV Gateway'den çek
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const gwRes = await fetch('https://api.primestore.world/iptv/pool-status', {
        headers: {
          'X-PrimeStore-Client': 'primeforge',
          'X-PrimeStore-Secret': 'primestore_admin_2026',
          'User-Agent': 'PrimeForge/2.0'
        },
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (gwRes.ok) {
        const gwData = await gwRes.json();
        if (Array.isArray(gwData.accounts) && gwData.accounts.length > 0) {
          accounts = gwData.accounts;
          poolData.updated_at = gwData.last_synced ? new Date(gwData.last_synced).getTime() : Date.now();
        }
      }
    } catch (_) {
      // Gateway geçici olarak yanıt vermezse diskteki havuzu kullan
    }

    const total = accounts.length;
    const active = accounts.filter((a: any) => (a.status || '').toLowerCase() === 'active' && !a.claimed).length;
    const claimed = accounts.filter((a: any) => a.claimed).length;
    const full = accounts.filter((a: any) => (a.status || '').toLowerCase() === 'full').length;
    const dead = accounts.filter((a: any) => ['dead', 'expired', 'pasif'].includes((a.status || '').toLowerCase())).length;
    const tr = accounts.filter((a: any) => a.has_tr).length;

    const resolvedMap = registryData.links || registryData.resolved_links || {};
    const resolvedCount = Object.keys(resolvedMap).length;

    return NextResponse.json({
      success: true,
      stats: {
        total,
        active,
        claimed,
        full,
        dead,
        tr,
        resolved_links_count: resolvedCount,
        last_updated: poolData.updated_at || 0
      },
      accounts,
      registry: resolvedMap
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { action } = body;

    const scraperScript = getScriptsPath('wars_iptv_scraper.py');
    const rootDir = path.resolve(scraperScript, '..', '..');

    // Vercel Serverless Ortamı: Python scripti doğrudan çalıştırılamazsa GitHub Actions Workflow'unu tetikle
    if (!fs.existsSync(scraperScript)) {
      if (action === 'scan' || action === 'scan_unscraped') {
        const ghToken = process.env.GITHUB_TOKEN;
        if (!ghToken) {
          return NextResponse.json({
            success: false,
            action,
            error: 'GitHub Actions tetiklemesi için Vercel ortamında GITHUB_TOKEN tanımlanmalıdır.',
            output: '[i] Vercel Serverless: Havuz verileri Cloudflare KV üzerinden canlı senkronize edilmektedir.'
          }, { status: 400 });
        }
        try {
          const ghRes = await fetch('https://api.github.com/repos/simurgulgen/PrimeStore/actions/workflows/nightly_iptv_pool_scan.yml/dispatches', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${ghToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'PrimeForge-Pool-Dispatcher',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ref: 'main' })
          });

          if (ghRes.ok || ghRes.status === 204) {
            return NextResponse.json({
              success: true,
              action,
              output: '[✔] GitHub Actions Cloud Runner Başlatıldı!\nİş Akışı: nightly_iptv_pool_scan.yml (simurgulgen/PrimeStore)\nTaranmamış tüm içerikler GitHub bulut ortamında taranıp havuza ve Cloudflare KV\'ye eklenecektir.\nDurumu GitHub Actions panelinden veya birkaç dakika sonra sayfayı yenileyerek görebilirsiniz.'
            });
          } else {
            const errText = await ghRes.text();
            return NextResponse.json({
              success: false,
              action,
              error: `GitHub Actions tetiklenemedi (${ghRes.status}): ${errText}`
            }, { status: 500 });
          }
        } catch (ghErr: any) {
          return NextResponse.json({
            success: false,
            action,
            error: `GitHub API hatası: ${ghErr.message}`
          }, { status: 500 });
        }
      }

      return NextResponse.json({
        success: false,
        action,
        error: 'Bu işlem için yerel terminal veya CI/CD runner gereklidir.',
        output: '[i] Vercel Serverless ortamı: Havuz verileri Cloudflare KV Gateway üzerinden canlı senkronize edilmektedir.'
      });
    }

    let args = [scraperScript];
    if (action === 'scan' || action === 'scan_unscraped') {
      args.push('--scan-portal', '--only-unscraped', '--sync-kv');
    } else if (action === 'scan_all') {
      args.push('--scan-portal', '--sync-kv');
    } else if (action === 'clean') {
      args.push('--clean-dead', '--sync-kv');
    } else if (action === 'sync') {
      args.push('--sync-kv');
    } else {
      args.push('--test-pool');
    }

    return new Promise<NextResponse>((resolve) => {
      const proc = spawn('python', args, {
        cwd: rootDir,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        resolve(NextResponse.json({
          success: code === 0,
          action,
          exit_code: code,
          output: stdout || stderr
        }));
      });

      proc.on('error', (err) => {
        resolve(NextResponse.json({
          success: false,
          action,
          error: err.message
        }, { status: 500 }));
      });
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
