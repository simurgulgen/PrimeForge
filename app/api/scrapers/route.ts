import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function parseOwnerAndRepo(url: string | null | undefined): boolean {
  if (!url) return false;
  const match = url.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  if (match) return true;
  const parts = url.trim().split('/');
  return parts.length === 2 && !url.includes('://');
}

export async function GET() {
  try {
    // 1. Fetch active and inactive scraper rules
    const { data: rules, error: rulesErr } = await supabase
      .from('scraper_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (rulesErr) {
      return NextResponse.json({ error: rulesErr.message }, { status: 500 });
    }

    // 2. Fetch all listings
    const { data: listings, error: listErr } = await supabase
      .from('listings')
      .select('id, title, packageName, version, logoUrl, fileUrl, githubSourceRepo, updatedAt, type')
      .in('type', ['APK', 'APP', 'apk', 'app'])
      .order('title', { ascending: true });

    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    const scraperRules = rules || [];

    // Map apps to their matched scraper rule (if any) or identify as scraper candidate
    const scraperApps = (listings || []).map((app) => {
      const pkg = app.packageName || '';
      const fileUrl = app.fileUrl || '';
      const ghRepo = app.githubSourceRepo || '';

      const hasGitHub = parseOwnerAndRepo(ghRepo) || parseOwnerAndRepo(fileUrl);

      // Match scraper rule
      const matchedRule = scraperRules.find((r) => {
        if (pkg && r.package_name && r.package_name.toLowerCase() === pkg.toLowerCase()) {
          return true;
        }
        if (r.domain_pattern) {
          const pat = r.domain_pattern.toLowerCase();
          if (fileUrl.toLowerCase().includes(pat) || ghRepo.toLowerCase().includes(pat)) {
            return true;
          }
        }
        if (r.target_url) {
          try {
            const host = new URL(r.target_url).hostname.replace(/^www\./, '').toLowerCase();
            if (host && (fileUrl.toLowerCase().includes(host) || ghRepo.toLowerCase().includes(host))) {
              return true;
            }
          } catch (_) {}
        }
        return false;
      });

      return {
        listing_id: app.id,
        title: app.title,
        packageName: app.packageName,
        current_version: app.version || '1.0',
        logoUrl: app.logoUrl,
        fileUrl: app.fileUrl,
        githubSourceRepo: app.githubSourceRepo,
        hasGitHub,
        is_candidate: Boolean(matchedRule) || !hasGitHub,
        matched_rule: matchedRule || null,
      };
    });

    return NextResponse.json({
      success: true,
      rules: scraperRules,
      scraper_apps: scraperApps.filter((a) => a.is_candidate),
      all_apps: scraperApps,
    });
  } catch (err: any) {
    console.error('Error fetching scrapers:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      name,
      package_name,
      target_url,
      link_regex,
      version_regex,
      domain_pattern,
      is_active = true,
    } = body;

    if (!name || !target_url) {
      return NextResponse.json(
        { error: 'Kural adı ve hedef URL alanları zorunludur.' },
        { status: 400 }
      );
    }

    // Call primeforge_upsert_scraper_rule RPC
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('primeforge_upsert_scraper_rule', {
      p_id: id || null,
      p_name: name,
      p_package_name: package_name || '',
      p_target_url: target_url,
      p_link_regex: link_regex || '',
      p_version_regex: version_regex || '',
      p_domain_pattern: domain_pattern || null,
      p_is_active: Boolean(is_active),
    });

    if (rpcErr) {
      console.error('RPC scraper upsert error:', rpcErr);
      return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Scraper kuralı başarıyla kaydedildi.',
      rule: rpcRes?.rule,
    });
  } catch (err: any) {
    console.error('Error saving scraper rule:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
