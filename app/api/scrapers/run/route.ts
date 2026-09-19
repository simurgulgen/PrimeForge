import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sanitizeRegex, cleanSemver, parseVersion, isNewerVersion, validateDownloadUrlSafety, parseLiteApksPage } from '@/lib/scraper-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { listing_id, rule_id } = body;

    let targetRule: any = null;
    let targetListing: any = null;

    if (rule_id) {
      const { data: r } = await supabase.from('scraper_rules').select('*').eq('id', rule_id).single();
      targetRule = r;
    }

    if (listing_id) {
      const { data: l } = await supabase
        .from('listings')
        .select('id, title, packageName, version, logoUrl, fileUrl, variants, githubSourceRepo')
        .eq('id', listing_id)
        .single();
      targetListing = l;
    }

    // If no rule explicitly passed, find rule for listing
    if (!targetRule && targetListing) {
      const pkg = targetListing.packageName || '';
      const fileUrl = targetListing.fileUrl || '';
      const ghRepo = targetListing.githubSourceRepo || '';

      const { data: rules } = await supabase.from('scraper_rules').select('*').eq('is_active', true);
      targetRule = (rules || []).find((r: any) => {
        if (pkg && r.package_name && r.package_name.toLowerCase() === pkg.toLowerCase()) return true;
        if (r.domain_pattern) {
          const pat = r.domain_pattern.toLowerCase();
          if (fileUrl.toLowerCase().includes(pat) || ghRepo.toLowerCase().includes(pat)) return true;
        }
        if (r.target_url) {
          try {
            const host = new URL(r.target_url).hostname.replace(/^www\./, '').toLowerCase();
            if (host && (fileUrl.toLowerCase().includes(host) || ghRepo.toLowerCase().includes(host))) return true;
          } catch (_) {}
        }
        return false;
      });
    }

    if (!targetRule) {
      return NextResponse.json({
        success: false,
        error: 'Bu uygulama için henüz bir Web Scraper kuralı atanmamış.',
        has_rule: false,
      });
    }

    const targetUrl = targetRule.target_url;
    if (!targetUrl) {
      return NextResponse.json({
        success: false,
        error: 'Scraper kuralında geçerli bir hedef URL bulunamadı.',
      });
    }

    const isLiteApks = targetUrl.includes('liteapks') || targetListing?.fileUrl?.includes('liteapks');

    // Scrape target site with browser headers
    const reqHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'tr,en-US;q=0.9,en;q=0.8',
    };
    if (isLiteApks) {
      reqHeaders['Referer'] = 'https://liteapks.com/';
    }

    const res = await fetch(targetUrl, {
      headers: reqHeaders,
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        error: `Hedef web sitesi HTTP ${res.status} hatası döndürdü.`,
      });
    }

    const html = await res.text();
    let newVersion: string | null = null;
    let downloadUrl: string | null = null;

    if (isLiteApks) {
      const parsedLite = parseLiteApksPage(html);
      if (parsedLite.version) {
        newVersion = parsedLite.version;
      }
    }

    const linkRegexStr = sanitizeRegex(targetRule.link_regex) || 'href=["\']([^"\']+\\.apk[^"\']*)["\']';
    let linkMatch: RegExpMatchArray | null = null;
    try {
      const linkRegex = new RegExp(linkRegexStr, 'i');
      linkMatch = html.match(linkRegex);
    } catch (e: any) {
      return NextResponse.json({ success: false, error: `Link Regex Hatası: ${e.message}` });
    }

    if (linkMatch) {
      let rawUrl = linkMatch[1] || linkMatch[0];
      if (rawUrl.startsWith('//')) {
        downloadUrl = 'https:' + rawUrl;
      } else if (rawUrl.startsWith('/')) {
        const u = new URL(targetUrl);
        downloadUrl = `${u.protocol}//${u.host}${rawUrl}`;
      } else if (!rawUrl.startsWith('http')) {
        downloadUrl = new URL(rawUrl, targetUrl).toString();
      } else {
        downloadUrl = rawUrl;
      }
    } else if (targetListing?.fileUrl) {
      // Fallback to existing fileUrl if version changed on page
      downloadUrl = targetListing.fileUrl;
    }

    if (!downloadUrl) {
      return NextResponse.json({
        success: false,
        error: 'Sayfada belirtilen regex deseni ile eşleşen APK indirme bağlantısı bulunamadı.',
      });
    }

    // 🛡️ STRICT SECURITY CHECK: Reject malware, fake buttons, and adware redirects
    const safetyCheck = validateDownloadUrlSafety(downloadUrl);
    if (!safetyCheck.safe) {
      return NextResponse.json({
        success: false,
        error: safetyCheck.reason || 'Güvenlik engeli: İndirme bağlantısı şüpheli reklam/virüs sitesine yönlendiriyor.',
        is_security_blocked: true,
      });
    }

    // Version match: APK filename first if not found yet
    if (!newVersion) {
      const fn = downloadUrl.split('?')[0].split('/').pop() || '';
      const fnMatch = fn.match(/([0-9]+(?:\.[0-9]+)+)/);
      if (fnMatch) {
        newVersion = fnMatch[1];
      }
    }

    if (!newVersion) {
      const versionRegexStr = sanitizeRegex(targetRule.version_regex) || '(?:v|sürüm|version)?\\s*([0-9]+(?:\\.[0-9]+)+)';
      try {
        const cleanHtml = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
        const vRegex = new RegExp(versionRegexStr, 'i');
        const vMatch = cleanHtml.match(vRegex);
        if (vMatch) {
          newVersion = vMatch[1] || vMatch[0];
        }
      } catch (e: any) {
        return NextResponse.json({ success: false, error: `Sürüm Regex Hatası: ${e.message}` });
      }
    }

    if (!newVersion) {
      return NextResponse.json({
        success: false,
        error: 'APK bağlantısı bulundu fakat sürüm numarası tespit edilemedi.',
        download_url: downloadUrl,
      });
    }

    const currentVer = targetListing?.version || '1.0';
    const isNewer = isNewerVersion(currentVer, newVersion);

    // Also check for saved guide/profile
    let savedGuide: any = null;
    if (targetListing?.packageName) {
      const { data: p } = await supabase
        .from('forge_profiles')
        .select('profile_name, auto_apply')
        .eq('package_name', targetListing.packageName)
        .maybeSingle();
      savedGuide = p;
    }

    return NextResponse.json({
      success: true,
      has_update: isNewer,
      rule_name: targetRule.name,
      current_version: currentVer,
      latest_version: newVersion,
      download_url: downloadUrl,
      is_newer: isNewer,
      update_item: targetListing
        ? {
            listing_id: targetListing.id,
            title: targetListing.title,
            logoUrl: targetListing.logoUrl,
            packageName: targetListing.packageName,
            current_version: currentVer,
            latest_version: newVersion,
            latest_tag: newVersion,
            source_type: 'WEB_SCRAPER',
            source_name: `Web: ${targetRule.name}`,
            download_url: downloadUrl,
            has_guide: Boolean(savedGuide),
            guide_name: savedGuide?.profile_name,
            auto_apply: savedGuide?.auto_apply ?? false,
            variants_needing_update: [
              {
                platform: 'UNIVERSAL',
                architecture: 'UNIVERSAL',
                current_version: currentVer,
                new_version: newVersion,
                suggested_url: downloadUrl,
              },
            ],
          }
        : null,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.name === 'TimeoutError' || err.message?.includes('timeout')
        ? 'Hedef web sitesine erişim zaman aşımına uğradı.'
        : err.message,
    });
  }
}
