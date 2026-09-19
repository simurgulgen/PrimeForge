import { NextResponse } from 'next/server';
import { sanitizeRegex } from '@/lib/scraper-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { target_url, link_regex, version_regex } = body;

    if (!target_url) {
      return NextResponse.json(
        { success: false, error: 'Hedef web sayfası URL adresi zorunludur.' },
        { status: 400 }
      );
    }

    const cleanTargetUrl = target_url.trim();

    // Fetch target URL with timeout
    const res = await fetch(cleanTargetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr,en-US;q=0.9,en;q=0.8',
      },
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });

    const status = res.status;
    const statusText = res.statusText;

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        status,
        statusText,
        error: `Hedef web sitesi HTTP ${status} (${statusText}) hatası döndürdü.`,
        duration_ms: Date.now() - startTime,
      });
    }

    const html = await res.text();

    // 1. Link matching
    const sanitizedLinkRegexStr = sanitizeRegex(link_regex) || 'href=["\']([^"\']+\\.apk[^"\']*)["\']';
    let matchedDownloadUrl: string | null = null;
    let linkRegexError: string | null = null;

    try {
      const linkRegex = new RegExp(sanitizedLinkRegexStr, 'i');
      const linkMatch = html.match(linkRegex);
      if (linkMatch) {
        let rawUrl = linkMatch[1] || linkMatch[0];
        // Normalize URL
        if (rawUrl.startsWith('//')) {
          matchedDownloadUrl = 'https:' + rawUrl;
        } else if (rawUrl.startsWith('/')) {
          const u = new URL(cleanTargetUrl);
          matchedDownloadUrl = `${u.protocol}//${u.host}${rawUrl}`;
        } else if (!rawUrl.startsWith('http')) {
          matchedDownloadUrl = new URL(rawUrl, cleanTargetUrl).toString();
        } else {
          matchedDownloadUrl = rawUrl;
        }
      }
    } catch (e: any) {
      linkRegexError = `Geçersiz Link Regex: ${e.message}`;
    }

    // 2. Version matching
    let matchedVersion: string | null = null;
    let versionRegexError: string | null = null;

    // Check APK URL filename first for reliable semver (e.g. app-v2.3.4.apk)
    if (matchedDownloadUrl) {
      const fn = matchedDownloadUrl.split('?')[0].split('/').pop() || '';
      const fnMatch = fn.match(/([0-9]+(?:\.[0-9]+)+)/);
      if (fnMatch) {
        matchedVersion = fnMatch[1];
      }
    }

    // If filename didn't match version, match from HTML body
    if (!matchedVersion) {
      const sanitizedVersionRegexStr = sanitizeRegex(version_regex) || '(?:v|sürüm|version)?\\s*([0-9]+(?:\\.[0-9]+)+)';
      try {
        const cleanHtml = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
        const vRegex = new RegExp(sanitizedVersionRegexStr, 'i');
        const vMatch = cleanHtml.match(vRegex);
        if (vMatch) {
          matchedVersion = vMatch[1] || vMatch[0];
        }
      } catch (e: any) {
        versionRegexError = `Geçersiz Sürüm Regex: ${e.message}`;
      }
    }

    const duration_ms = Date.now() - startTime;
    const cleanPreview = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 400);

    return NextResponse.json({
      success: Boolean(matchedDownloadUrl),
      status,
      statusText,
      matched_download_url: matchedDownloadUrl,
      matched_version: matchedVersion,
      link_regex_error: linkRegexError,
      version_regex_error: versionRegexError,
      html_preview: cleanPreview,
      duration_ms,
      error: !matchedDownloadUrl
        ? 'İndirme linki regex deseni sayfada herhangi bir APK bağlantısıyla eşleşmedi.'
        : !matchedVersion
        ? 'APK linki bulundu fakat geçerli bir sürüm numarası tespit edilemedi.'
        : null,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.name === 'TimeoutError' || err.message?.includes('timeout')
        ? 'Hedef web sayfası 8 saniye içinde yanıt vermedi (Zaman aşımı).'
        : `Scraper test hatası: ${err.message}`,
      duration_ms: Date.now() - startTime,
    });
  }
}
