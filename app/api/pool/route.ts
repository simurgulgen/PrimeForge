import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

function getScratchPath(filename: string) {
  // PrimeStore root / scratch dizini
  const candidate1 = path.join(process.cwd(), '..', 'scratch', filename);
  const candidate2 = path.join(process.cwd(), 'scratch', filename);
  return fs.existsSync(candidate1) ? candidate1 : (fs.existsSync(candidate2) ? candidate2 : candidate1);
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

    // Vercel Serverless veya yerel dosyanın olmadığı durumlarda Cloudflare KV Gateway'den çek
    if (accounts.length === 0) {
      try {
        const gwRes = await fetch('https://primestore-gateway.simurgulgen.workers.dev/iptv/pool-status', {
          headers: {
            'X-PrimeStore-Client': 'primeforge',
            'X-PrimeStore-Secret': 'primestore_admin_2026'
          },
          cache: 'no-store'
        });
        if (gwRes.ok) {
          const gwData = await gwRes.json();
          if (Array.isArray(gwData.accounts)) {
            accounts = gwData.accounts;
            poolData.updated_at = gwData.last_synced ? new Date(gwData.last_synced).getTime() : Date.now();
          }
        }
      } catch (_) {}
    }

    const total = accounts.length;
    const active = accounts.filter((a: any) => (a.status || '').toLowerCase() === 'active' && !a.claimed).length;
    const claimed = accounts.filter((a: any) => a.claimed).length;
    const full = accounts.filter((a: any) => (a.status || '').toLowerCase() === 'full').length;
    const dead = accounts.filter((a: any) => ['dead', 'expired', 'pasif'].includes((a.status || '').toLowerCase())).length;
    const tr = accounts.filter((a: any) => a.has_tr).length;

    const resolvedCount = Object.keys(registryData.resolved_links || {}).length;

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
      registry: registryData.resolved_links || {}
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

    if (!fs.existsSync(scraperScript)) {
      return NextResponse.json({
        success: false,
        action,
        error: 'Scraper yerel sunucu veya CI/CD makinesinde çalıştırılmalıdır (Vercel Serverless ortamında Python ve betik yer almaz).',
        output: '[i] Vercel Serverless ortamı: Havuz verileri Cloudflare KV Gateway üzerinden canlı senkronize edilmektedir.'
      });
    }

    let flag = '--test-pool';
    if (action === 'scan') flag = '--scan-portal';
    else if (action === 'clean') flag = '--clean-dead';
    else if (action === 'sync') flag = '--sync-kv';
    else if (action === 'test') flag = '--test-pool';

    const args = [scraperScript, flag];
    if (action === 'scan') {
      args.push('--sync-kv'); // Tarama sonrası otomatik KV'ye de yaz
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
