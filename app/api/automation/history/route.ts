import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '30'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const runType = url.searchParams.get('type'); // filter by run_type

    let query = supabase
      .from('automation_runs')
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (runType) {
      query = query.eq('run_type', runType);
    }

    const { data: runs, count, error } = await query;

    if (error) {
      console.error('automation_runs fetch error:', error);
      return NextResponse.json({ runs: [], total: 0, error: error.message });
    }

    // Enrich with readable labels
    const enriched = (runs || []).map((run: any) => {
      const summary = run.summary || {};
      return {
        id: run.id,
        run_type: run.run_type,
        status: run.status || 'triggered',
        started_at: run.started_at,
        finished_at: run.finished_at,
        label: getRunLabel(run.run_type),
        icon: getRunIcon(run.run_type),
        color: getRunColor(run.run_type),
        message: summary.message || null,
        github_success: summary.github?.success ?? null,
        github_error: summary.github?.error ?? null,
        nim_success: summary.nim?.success ?? null,
        nim_latency: summary.nim?.latencyMs ?? null,
        kv_success: summary.kv?.success ?? null,
        kv_count: summary.kv?.count ?? null,
        workflow_run_id: summary.workflow_run_id ?? null,
        workflow_url: summary.workflow_url ?? null,
        raw_summary: summary,
      };
    });

    return NextResponse.json({
      runs: enriched,
      total: count || 0,
      limit,
      offset,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'History fetch failed', runs: [], total: 0 },
      { status: 500 }
    );
  }
}

function getRunLabel(type: string): string {
  const labels: Record<string, string> = {
    check_updates: 'Güncelleme Taraması',
    health_check: 'IPTV Sağlık Kontrolü',
    nightly_scan: 'Gece IPTV Taraması',
    sync_kv: 'KV Havuz Senkronizasyonu',
    test_nim: 'NVIDIA NIM Testi',
    save_credentials: 'API Anahtarı Güncelleme',
  };
  return labels[type] || type;
}

function getRunIcon(type: string): string {
  const icons: Record<string, string> = {
    check_updates: 'RefreshCw',
    health_check: 'Activity',
    nightly_scan: 'Flame',
    sync_kv: 'Cloud',
    test_nim: 'Sparkles',
    save_credentials: 'Key',
  };
  return icons[type] || 'Zap';
}

function getRunColor(type: string): string {
  const colors: Record<string, string> = {
    check_updates: 'blue',
    health_check: 'rose',
    nightly_scan: 'purple',
    sync_kv: 'teal',
    test_nim: 'violet',
    save_credentials: 'amber',
  };
  return colors[type] || 'slate';
}
