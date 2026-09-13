import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const tvOnly =
      searchParams.get('tv_only') === 'true' ||
      searchParams.get('hide_mobile') === 'true' ||
      searchParams.get('tvOnly') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('listings')
      .select('id, title, packageName, version, categoryName, categoryId, categoryIds, variants, logoUrl, fileUrl, file_size, status, type, updatedAt, is_featured', { count: 'exact' });

    if (search) {
      query = query.or(`title.ilike.%${search}%,packageName.ilike.%${search}%`);
    }

    if (category && category !== 'all') {
      // Support filtering by categoryId (e.g. apk_cat_6) or categoryName (e.g. Film-Dizi Sinema)
      if (category.startsWith('apk_cat_') || category.startsWith('m3u_cat_')) {
        query = query.or(`categoryId.eq.${category},categoryName.eq.${category}`);
      } else {
        query = query.or(`categoryName.ilike.%${category}%,categoryId.eq.${category}`);
      }
    }

    query = query
      .order('updatedAt', { ascending: false, nullsFirst: false });

    // If no client-side TV filter is needed, paginate directly in database
    // But when tvOnly is requested, we will filter with dynamic profile compatibility
    if (!tvOnly) {
      query = query.range(offset, offset + limit - 1);
    } else {
      // Fetch broader window to filter TV apps accurately
      query = query.limit(300);
    }

    const { data: apps, count, error } = await query;

    if (error) {
      console.error('Error fetching listings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also get existing profile package names & compatibility from forge_profiles
    const { data: profiles } = await supabase
      .from('forge_profiles')
      .select('package_name, auto_apply, profile_yaml');

    // Also get latest job and analysis for each package
    const { data: recentJobs } = await supabase
      .from('forge_jobs')
      .select('id, package_name, status, action, analysis_report, created_at')
      .order('created_at', { ascending: false })
      .limit(150);

    const jobMap = new Map<string, any>();
    for (const j of recentJobs || []) {
      if (j.package_name && !jobMap.has(j.package_name)) {
        jobMap.set(j.package_name, j);
      }
    }

    const profileMap = new Map<string, any>();
    for (const p of profiles || []) {
      if (!p.package_name) continue;
      let compat: any = null;
      if (p.profile_yaml) {
        try {
          // Simple regex search for compatibility block in profile YAML
          const tvMatch = p.profile_yaml.match(/tv:\s*(true|false)/i);
          const mobMatch = p.profile_yaml.match(/mobile:\s*(true|false)/i);
          const tabMatch = p.profile_yaml.match(/tablet:\s*(true|false)/i);
          const verMatch = p.profile_yaml.match(/verified_by_emulator:\s*(true|false)/i);
          if (tvMatch || mobMatch || tabMatch) {
            compat = {
              tv: tvMatch ? tvMatch[1].toLowerCase() === 'true' : null,
              mobile: mobMatch ? mobMatch[1].toLowerCase() === 'true' : null,
              tablet: tabMatch ? tabMatch[1].toLowerCase() === 'true' : null,
              verified_by_emulator: verMatch ? verMatch[1].toLowerCase() === 'true' : true,
            };
          }
        } catch {
          // ignore parsing error
        }
      }
      profileMap.set(p.package_name, {
        auto_apply: p.auto_apply,
        compatibility: compat,
        profile_yaml: p.profile_yaml,
      });
    }

    const enrichedApps = (apps || []).map((app: any) => {
      const prof = app.packageName ? profileMap.get(app.packageName) : null;
      const latestJob = app.packageName ? jobMap.get(app.packageName) : null;
      const variants: any[] = Array.isArray(app.variants) ? app.variants : [];
      const platforms = variants.map((v) => (v && v.platform ? String(v.platform).toUpperCase() : '')).filter(Boolean);

      const isPlaylist = app.type === 'M3U' || app.type === 'M3U8' || app.type === 'M3U_PLUS';
      const hasTvVariant = platforms.includes('TV') || platforms.includes('UNIVERSAL') || platforms.includes('TV_BOX');
      const testVerifiedTv = prof?.compatibility?.tv === true;
      const testFailedTv = prof?.compatibility?.tv === false;

      // TV Compatible logic:
      // 1. Playlists are always TV compatible
      // 2. Has TV variant
      // 3. Tested and passed by PrimeForge emulator test!
      // (Unless test definitively failed TV compatibility)
      let isTvCompatible = false;
      if (isPlaylist) {
        isTvCompatible = true;
      } else if (testVerifiedTv) {
        isTvCompatible = true; // Dynamically verified as TV compatible by test!
      } else if (hasTvVariant && !testFailedTv) {
        isTvCompatible = true;
      }

      const isMobileCompatible = isPlaylist || platforms.includes('MOBILE') || platforms.length === 0 || prof?.compatibility?.mobile === true;
      const isTabletCompatible = isPlaylist || platforms.includes('TABLET') || prof?.compatibility?.tablet === true || platforms.includes('UNIVERSAL');

      return {
        ...app,
        iconUrl: app.logoUrl,
        has_profile: Boolean(prof),
        profile_yaml: prof?.profile_yaml || null,
        analysis_report: latestJob?.analysis_report || null,
        latest_job_id: latestJob?.id || null,
        latest_job_status: latestJob?.status || null,
        is_tv_compatible: isTvCompatible,
        is_mobile_compatible: isMobileCompatible,
        is_tablet_compatible: isTabletCompatible,
        verified_by_test: Boolean(prof?.compatibility?.verified_by_emulator),
        device_platforms: Array.from(new Set([
          ...(isTvCompatible ? ['TV'] : []),
          ...(isMobileCompatible ? ['MOBILE'] : []),
          ...(isTabletCompatible ? ['TABLET'] : []),
        ])),
      };
    });

    // Apply TV Only filter if requested
    let finalApps = enrichedApps;
    if (tvOnly) {
      finalApps = enrichedApps.filter((a) => a.is_tv_compatible);
    }

    const paginatedApps = tvOnly ? finalApps.slice(offset, offset + limit) : finalApps;

    return NextResponse.json({
      apps: paginatedApps,
      total: tvOnly ? finalApps.length : (count || enrichedApps.length),
      page,
      limit,
      tv_only: tvOnly,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

