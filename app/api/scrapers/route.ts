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

const GENERIC_HOSTS = new Set([
  'github.com',
  'raw.githubusercontent.com',
  'gitlab.com',
  'sourceforge.net',
  'catbox.moe',
  'files.catbox.moe',
  'pixeldrain.com',
  'drive.google.com',
  'dropbox.com',
  'mediafire.com',
  'mega.nz',
  'liteapks.com',
  'liteapks.dev',
  'download.liteapks.dev',
  'download-old.liteapks.dev',
]);

function extractGithubSlug(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (match) return `${match[1]}/${match[2]}`.toLowerCase();
  const parts = url.trim().split('/');
  if (parts.length === 2 && !url.includes('://')) {
    return `${parts[0]}/${parts[1]}`.toLowerCase();
  }
  return null;
}

function isScraperRuleMatch(r: any, pkg: string, fileUrl: string, ghRepo: string): boolean {
  // 1. Strict package match
  if (pkg && r.package_name && r.package_name.trim().toLowerCase() === pkg.trim().toLowerCase()) {
    return true;
  }

  // 2. Domain pattern match
  if (r.domain_pattern) {
    const pat = r.domain_pattern.trim().toLowerCase();
    if (pat) {
      if (pat.includes('github.com/') || (pat.split('/').length === 2 && !pat.includes('.'))) {
        const patSlug = pat.replace(/^.*github\.com\//, '').replace(/^www\./, '');
        const fileSlug = extractGithubSlug(fileUrl);
        const ghSlug = extractGithubSlug(ghRepo);
        if (fileSlug === patSlug || ghSlug === patSlug) return true;
      } else if (!GENERIC_HOSTS.has(pat) && pat !== 'github.com') {
        if (fileUrl.toLowerCase().includes(pat) || ghRepo.toLowerCase().includes(pat)) {
          return true;
        }
      }
    }
  }

  // 3. Target URL match (generic hosts like github.com must never match by hostname alone)
  if (r.target_url) {
    try {
      const u = new URL(r.target_url);
      const host = u.hostname.replace(/^www\./, '').toLowerCase();
      if (host && !GENERIC_HOSTS.has(host)) {
        if (fileUrl.toLowerCase().includes(host) || ghRepo.toLowerCase().includes(host)) {
          return true;
        }
      } else if (host === 'github.com') {
        const targetSlug = extractGithubSlug(r.target_url);
        const fileSlug = extractGithubSlug(fileUrl);
        const ghSlug = extractGithubSlug(ghRepo);
        if (targetSlug && (fileSlug === targetSlug || ghSlug === targetSlug)) {
          return true;
        }
      }
    } catch (_) {}
  }
  return false;
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

      // Match scraper rule (only active rules)
      const matchedRule = scraperRules.find((r) => r.is_active !== false && isScraperRuleMatch(r, pkg, fileUrl, ghRepo));

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
