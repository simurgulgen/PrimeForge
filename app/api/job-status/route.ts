import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    const supabaseUrl = process.env.SUPABASE_URL || 'https://mdorxlwvitfixbzajksw.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kb3J4bHd2aXRmaXhiemFqa3N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NzE2NTcsImV4cCI6MjEwMTQ0NzY1N30.HXoHD3JGXmq_kIkcJ0XJJaMX_BCyukwG7EawZb738mw';

    if (id) {
      const { data, error } = await supabase.from('forge_jobs').select('*').eq('id', id).single();
      if (!error && data) {
        return NextResponse.json({ job: data }, { headers: NO_CACHE_HEADERS });
      }

      // Fallback to direct REST API
      const res = await fetch(`${supabaseUrl}/rest/v1/forge_jobs?id=eq.${id}&select=*`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          return NextResponse.json({ job: rows[0] }, { headers: NO_CACHE_HEADERS });
        }
      }
      return NextResponse.json({ error: error?.message || 'Job not found' }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    const { data, error } = await supabase
      .from('forge_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (data && data.length > 0) {
      return NextResponse.json({ jobs: data }, { headers: NO_CACHE_HEADERS });
    }

    // Direct REST query fallback if supabase client returns empty or errors
    const res = await fetch(`${supabaseUrl}/rest/v1/forge_jobs?select=*&order=created_at.desc&limit=50`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      cache: 'no-store',
    });

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows)) {
        return NextResponse.json({ jobs: rows }, { headers: NO_CACHE_HEADERS });
      }
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
    return NextResponse.json({ jobs: [] }, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
