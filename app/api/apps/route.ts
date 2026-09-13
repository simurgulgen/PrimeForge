import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('listings')
      .select('id, title, packageName, version, categoryName, logoUrl, fileUrl, file_size, status, type, updatedAt, is_featured', { count: 'exact' });

    if (search) {
      query = query.or(`title.ilike.%${search}%,packageName.ilike.%${search}%`);
    }

    if (category && category !== 'all') {
      query = query.eq('categoryName', category);
    }

    query = query
      .order('updatedAt', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    const { data: apps, count, error } = await query;

    if (error) {
      console.error('Error fetching listings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also get existing profile package names from forge_profiles to mark which apps have profiles
    const { data: profiles } = await supabase
      .from('forge_profiles')
      .select('package_name, auto_apply');

    const profileMap = new Set((profiles || []).map((p) => p.package_name));

    const enrichedApps = (apps || []).map((app) => ({
      ...app,
      has_profile: app.packageName ? profileMap.has(app.packageName) : false,
    }));

    return NextResponse.json({
      apps: enrichedApps,
      total: count || 0,
      page,
      limit,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
