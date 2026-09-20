import { NextResponse } from 'next/server';
import { sanitizeRegex, fetchResilientHtml } from '@/lib/scraper-utils';

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

    // Fetch target URL with automatic 403 proxy fallback
    const fetchResult = await fetchResilientHtml(cleanTargetUrl, 10000);

    if (!fetchResult.ok || !fetchResult.html) {
      return NextResponse.json({
        success: false,
        status: fetchResult.status,
        statusText: fetchResult.proxied ? 'Proxied Error' : 'Error',
        error: fetchResult.error || `Hedef web sitesi HTTP ${fetchResult.status} hatası döndürdü.`,
        duration_ms: Date.now() - startTime,
      });
    }

    const status = 200;
    const statusText = 'OK';
    const html = fetchResult.html;

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
